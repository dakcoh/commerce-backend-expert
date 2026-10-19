const fs = require("fs");
const https = require("https");
const { Transform } = require("stream");
const { pipeline } = require("stream/promises");

const DEFAULT_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_CHECKSUM_BYTES = 64 * 1024;
const MAX_REDIRECTS = 5;
const ALLOWED_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);

function releaseInfo(pkg, repo = "dakcoh/commerce-context-mcp") {
  const jarName = `context-engine-${pkg.version}.jar`;
  const releaseUrl = `https://github.com/${repo}/releases/download/v${pkg.version}/${jarName}`;
  return { jarName, releaseUrl, checksumUrl: `${releaseUrl}.sha256` };
}

async function request(url, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, totalTimeoutMs = DOWNLOAD_TIMEOUT_MS,
    redirects = 0, signal, httpsGet = https.get } = options;
  const deadline = options.deadline ?? Date.now() + totalTimeoutMs;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Refusing untrusted release URL: ${url}`);
  }
  if (redirects > MAX_REDIRECTS) {
    throw new Error(`Too many redirects for ${url}`);
  }
  if (signal?.aborted) throw signal.reason || new Error("Release request aborted");
  if (deadline <= Date.now()) throw new Error(`Release transfer timed out: ${url}`);

  return new Promise((resolve, reject) => {
    let responseBody;
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => req.destroy(signal.reason || new Error("Release request aborted"));
    const req = httpsGet(url, { headers: { "User-Agent": "commerce-context-mcp" } }, (response) => {
      responseBody = response;
      response.once("end", cleanup);
      response.once("close", cleanup);
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        cleanup();
        response.destroy();
        try {
          const redirected = new URL(response.headers.location, url).toString();
          request(redirected, { ...options, deadline, redirects: redirects + 1 }).then(resolve, reject);
        } catch (error) { reject(error); }
        return;
      }
      resolve(response);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Request timed out after ${timeoutMs}ms: ${url}`)));
    req.on("error", (error) => {
      cleanup();
      responseBody?.destroy(error);
      reject(error);
    });
    timer = setTimeout(() => req.destroy(new Error(`Release transfer timed out after ${totalTimeoutMs}ms: ${url}`)), deadline - Date.now());
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

async function fetchText(url, options = {}) {
  const response = await request(url, { totalTimeoutMs: DEFAULT_TIMEOUT_MS, ...options });
  if (response.statusCode !== 200) {
    response.destroy();
    throw new Error(`Release checksum is not available. HTTP ${response.statusCode}`);
  }
  const chunks = [];
  let received = 0;
  for await (const chunk of response) {
    received += chunk.length;
    if (received > MAX_CHECKSUM_BYTES) {
      response.destroy();
      throw new Error(`Release checksum exceeds ${MAX_CHECKSUM_BYTES} bytes`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function download(url, destination, onProgress = () => {}, options = {}) {
  const response = await request(url, options);
  if (response.statusCode !== 200) {
    response.destroy();
    throw new Error(`Release asset is not available. HTTP ${response.statusCode}`);
  }
  const length = response.headers["content-length"];
  const expected = length === undefined ? 0 : Number(length);
  if (length !== undefined && (!/^\d+$/.test(length) || !Number.isSafeInteger(expected))) {
    response.destroy();
    throw new Error("Invalid release content-length");
  }
  let received = 0;
  let created = false;
  const file = fs.createWriteStream(destination, { flags: "wx" });
  file.once("open", () => { created = true; });
  const progress = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length;
      try { onProgress(received, expected); callback(null, chunk); }
      catch (error) { callback(error); }
    },
    flush(callback) {
      callback(length !== undefined && received !== expected
        ? new Error(`Incomplete download: received ${received} of ${expected} bytes`) : null);
    },
  });
  try {
    await pipeline(response, progress, file);
    return { received, expected };
  } catch (error) {
    // pipeline closes the Windows file handle before partial-file removal.
    if (created) fs.rmSync(destination, { force: true });
    throw error;
  }
}

module.exports = { releaseInfo, request, fetchText, download, ALLOWED_HOSTS };
