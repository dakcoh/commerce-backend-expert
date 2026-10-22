const fs = require("fs");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const { download, fetchText } = require("./release-client");
const { parseChecksum, verifyFile } = require("./checksum");

const MAX_ATTEMPTS = 3;
// Checksum (15s), three transfers (120s each), and scheduling margin.
const LOCK_WAIT_MS = 405_000;

function cachePaths(info, cacheDir = process.env.COMMERCE_CONTEXT_CACHE_DIR || path.join(os.homedir(), ".commerce-context-mcp")) {
  cacheDir = path.resolve(cacheDir);
  const jarPath = path.join(cacheDir, info.jarName);
  return {
    cacheDir,
    jarPath,
    checksumPath: `${jarPath}.sha256`,
    lockPath: `${jarPath}.lock`,
  };
}

function verifyCached(paths, pinnedChecksum) {
  if (!fs.existsSync(paths.jarPath) || (!pinnedChecksum && !fs.existsSync(paths.checksumPath))) {
    return { ok: false, reason: "missing" };
  }
  try {
    const expected = pinnedChecksum || parseChecksum(fs.readFileSync(paths.checksumPath, "utf8"));
    const actual = verifyFile(paths.jarPath, expected);
    return { ok: true, actual };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

async function ensureJar(info, options = {}) {
  const paths = cachePaths(info, options.cacheDir);
  fs.mkdirSync(paths.cacheDir, { recursive: true });
  const check = () => verifyCached(paths, options.expectedChecksum);
  const cached = check();
  if (cached.ok) {
    console.error(`Using verified cached artifact: ${paths.jarPath}`);
    return paths.jarPath;
  }

  const { now = Date.now, waitMs = LOCK_WAIT_MS } = options.lockOptions || {};
  const deadline = now() + waitMs;
  for (;;) {
    const lease = await acquireLock(paths, { ...options.lockOptions, now,
      waitMs: Math.max(0, deadline - now()), isComplete: () => check().ok });
    if (!lease) {
      const completed = check();
      if (!completed.ok) {
        throw new Error(`Concurrent download did not produce a valid cache: ${completed.reason}`);
      }
      return paths.jarPath;
    }

    try {
      const rechecked = check();
      if (rechecked.ok) {
        return paths.jarPath;
      }
      lease.assertOwned();
      // A killed owner cannot run its finally block. Reclaim only our UUID temp-file format.
      for (const name of fs.readdirSync(paths.cacheDir)) {
        for (const destination of [paths.jarPath, paths.checksumPath]) {
          const prefix = `${path.basename(destination)}.`;
          const suffix = name.slice(prefix.length);
          if (name.startsWith(prefix) && /^[a-f0-9-]{36}\.\d+\.tmp$/.test(suffix) &&
              lease.abandonedTokens.includes(suffix.split(".")[0])) {
            lease.assertOwned();
            fs.unlinkSync(path.join(paths.cacheDir, name));
          }
        }
      }
      await downloadAndVerify(info, paths, options, lease);
      return paths.jarPath;
    } catch (error) {
      if (error.code !== "LOCK_OWNERSHIP_LOST") throw error;
      // Concurrent dead-owner recovery can replace our lock; reuse the original deadline.
      console.error("Cache lock changed; waiting for a verified cache or retrying.");
    } finally {
      lease.release();
    }
  }
}

async function downloadAndVerify(info, paths, options, lease) {
  const fetchChecksum = options.fetchText || fetchText;
  const downloadFile = options.download || download;
  const checksumText = await fetchChecksum(info.checksumUrl);
  const expected = parseChecksum(checksumText);
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const tempPath = `${paths.jarPath}.${lease.token}.${attempt}.tmp`;
    const checksumTempPath = `${paths.checksumPath}.${lease.token}.${attempt}.tmp`;
    try {
      console.error(`Downloading ${info.releaseUrl} (attempt ${attempt}/${MAX_ATTEMPTS})`);
      await downloadFile(info.releaseUrl, tempPath, options.onProgress);
      const actual = verifyFile(tempPath, expected);
      lease.assertOwned();
      replaceFile(tempPath, paths.jarPath);
      fs.writeFileSync(checksumTempPath, `${actual}  ${info.jarName}\n`, { encoding: "utf8" });
      lease.assertOwned();
      replaceFile(checksumTempPath, paths.checksumPath);
      console.error(`Cached verified artifact: ${paths.jarPath}`);
      return;
    } catch (error) {
      lastError = error;
      fs.rmSync(tempPath, { force: true });
      fs.rmSync(checksumTempPath, { force: true });
      if (error.code === "LOCK_OWNERSHIP_LOST") throw error;
      if (attempt < MAX_ATTEMPTS) {
        console.error(`Download attempt ${attempt} failed: ${error.message}. Retrying...`);
      }
    }
  }
  throw new Error(`Failed to download ${info.jarName}: ${lastError && lastError.message}`);
}

function replaceFile(source, destination) {
  try {
    fs.renameSync(source, destination);
  } catch (error) {
    if (!fs.existsSync(destination) || !["EEXIST", "EPERM", "EACCES"].includes(error.code)) {
      throw error;
    }
    // Windows does not consistently replace an existing destination with rename.
    // The destination is already known to be missing or invalid at this point.
    fs.rmSync(destination, { force: true });
    fs.renameSync(source, destination);
  }
}

function readLock(lockPath) {
  try {
    return { text: fs.readFileSync(lockPath, "utf8"), stat: fs.statSync(lockPath) };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function sameLock(left, right) {
  return left && right && left.text === right.text &&
    left.stat.ino === right.stat.ino && left.stat.dev === right.stat.dev;
}

function ownerIsDead(text) {
  let owner;
  try { owner = JSON.parse(text); } catch { return false; }
  // Support the previous PID-only format. Unknown/foreign owners fail closed.
  if (typeof owner === "number") owner = { pid: owner };
  else if (!owner || owner.host !== os.hostname() ||
      typeof owner.token !== "string" || !owner.token) return false;
  if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) return false;
  try { process.kill(owner.pid, 0); return false; }
  catch (error) { return error.code === "ESRCH"; }
}

async function acquireLock(paths, { waitMs = LOCK_WAIT_MS, pollMs = 250,
  now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  isComplete = () => verifyCached(paths).ok } = {}) {
  const started = now();
  const abandonedTokens = [];
  let permissionRetries = 0;
  while (now() - started < waitMs) {
    let descriptor;
    try {
      try {
        descriptor = fs.openSync(paths.lockPath, "wx");
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        const observed = readLock(paths.lockPath);
        if (!observed) continue;
        // shortcut: path checks are not OS lock CAS; use OS-backed locking for shared caches.
        if (ownerIsDead(observed.text) && sameLock(observed, readLock(paths.lockPath))) {
          const abandoned = JSON.parse(observed.text).token;
          if (abandoned) abandonedTokens.push(abandoned);
          try { fs.unlinkSync(paths.lockPath); }
          catch (unlinkError) { if (unlinkError.code !== "ENOENT") throw unlinkError; }
          continue;
        }
        if (isComplete()) return null;
        await sleep(pollMs);
        continue;
      }
      const token = randomUUID();
      const text = JSON.stringify({ pid: process.pid, host: os.hostname(), token });
      fs.writeFileSync(descriptor, text);
      const owned = { text, stat: fs.fstatSync(descriptor) };
      return { token, abandonedTokens,
        assertOwned() {
          if (!sameLock(owned, readLock(paths.lockPath))) {
            const error = new Error(`Cache lock ownership lost: ${paths.lockPath}`);
            error.code = "LOCK_OWNERSHIP_LOST";
            throw error;
          }
        },
        release() {
          fs.closeSync(descriptor);
          if (sameLock(owned, readLock(paths.lockPath))) fs.unlinkSync(paths.lockPath);
        },
      };
    } catch (error) {
      // Retry Windows cleanup races before ownership, including inspection of an existing lock.
      if (descriptor === undefined && process.platform === "win32" && error.code === "EPERM" && permissionRetries < 3) {
        permissionRetries++;
        if (isComplete()) return null;
        await sleep(Math.min(pollMs, Math.max(0, waitMs - (now() - started))));
        continue;
      }
      if (descriptor !== undefined) {
        const stat = fs.fstatSync(descriptor);
        fs.closeSync(descriptor);
        const current = readLock(paths.lockPath);
        if (current && current.stat.ino === stat.ino && current.stat.dev === stat.dev) {
          fs.unlinkSync(paths.lockPath);
        }
      }
      throw error;
    }
  }
  throw new Error(`Timed out waiting for cache lock: ${paths.lockPath}. Stop other clients before manually removing an unreadable or abandoned lock.`);
}

module.exports = { cachePaths, verifyCached, ensureJar, replaceFile, acquireLock };
