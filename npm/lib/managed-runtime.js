const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const manifest = require("./runtime-manifest.json");
const {cachePaths, ensureJar, acquireLock} = require("./jar-cache");
const {sha256OfFile} = require("./checksum");
const {download} = require("./release-client");
const {javaStatus} = require("./java-runtime");
const {extractRuntime} = require("./runtime-archive");

function runtimeInfo(platform = process.platform, arch = process.arch) {
  const key = `${platform}-${arch}`;
  const asset = manifest.assets[key];
  if (!asset || (platform === "linux" && process.platform === "linux" && !process.report.getReport().header.glibcVersionRuntime)) {
    throw new Error(`Unsupported Java runtime platform: ${key}. Supported: Windows/macOS/Linux glibc, x64/arm64.`);
  }
  return {...asset, version: manifest.version, id: `temurin-${manifest.version}-${key}`};
}

function runtimePaths(cacheDir, info = runtimeInfo()) {
  const root = path.resolve(cachePaths({jarName: "runtime"}, cacheDir).cacheDir, "runtimes");
  const home = path.join(root, info.id);
  return {root, home, lockPath: `${home}.lock`, javaPath: path.join(home, info.java)};
}

function inventory(directory, relative = "") {
  const result = {};
  for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
    if (!relative && name === ".inventory.json") continue;
    const child = relative ? `${relative}/${name}` : name;
    const absolute = path.join(directory, child);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      const resolved = fs.realpathSync(absolute);
      if (!resolved.startsWith(`${directory}${path.sep}`) || !fs.statSync(resolved).isFile()) throw new Error("Unsafe runtime cache link");
      result[child] = {link: fs.readlinkSync(absolute)};
    } else if (stat.isDirectory()) {
      result[child] = {directory: true};
      Object.assign(result, inventory(directory, child));
    } else if (stat.isFile()) result[child] = {sha256: sha256OfFile(absolute), executable: !!(stat.mode & 0o111)};
    else throw new Error("Unsupported runtime cache entry");
  }
  return result;
}

function verifiedRuntime(paths, info) {
  try {
    if (!fs.lstatSync(paths.home).isDirectory() || fs.lstatSync(paths.home).isSymbolicLink()) return false;
    const saved = JSON.parse(fs.readFileSync(path.join(paths.home, ".inventory.json"), "utf8"));
    return saved.archive === info.sha256 && saved.version === info.version &&
      JSON.stringify(saved.files) === JSON.stringify(inventory(paths.home));
  } catch { return false; }
}

function checkJava(javaPath, info, spawn = spawnSync) {
  const status = javaStatus(javaPath, spawn);
  if (!status.ok || status.major !== 21 || !status.output.includes(`"${info.version.split("+")[0]}"`)) {
    throw new Error(`Managed Java ${info.version} cannot run: ${status.output || "missing executable or OS libraries"}`);
  }
}

function removeOwnedChild(root, target) {
  if (path.dirname(path.resolve(target)) !== path.resolve(root)) throw new Error("Runtime cleanup escaped cache");
  fs.rmSync(target, {recursive: true, force: true});
}

async function ensureRuntime(options = {}) {
  const info = options.info || runtimeInfo();
  const paths = runtimePaths(options.cacheDir, info);
  if (fs.existsSync(paths.root) && fs.lstatSync(paths.root).isSymbolicLink()) throw new Error("Runtime cache must not be a symbolic link");
  const check = () => verifiedRuntime(paths, info);
  if (check()) { checkJava(paths.javaPath, info, options.spawn); return paths.javaPath; }
  fs.mkdirSync(paths.root, {recursive: true});
  if (fs.lstatSync(paths.root).isSymbolicLink()) throw new Error("Runtime cache must not be a symbolic link");
  const now = options.lockOptions?.now || Date.now;
  const deadline = now() + (options.lockOptions?.waitMs ?? 600_000);
  const remaining = () => {
    if (now() >= deadline) throw new Error("Timed out preparing Java runtime");
    return deadline - now();
  };
  for (;;) {
    const lease = await acquireLock(paths, {...options.lockOptions, now,
      waitMs: Math.max(0, deadline - now()), isComplete: check});
    if (!lease) { checkJava(paths.javaPath, info, options.spawn); return paths.javaPath; }
    const stage = `${paths.home}.stage-${lease.token}`;
    try {
      if (check()) { checkJava(paths.javaPath, info, options.spawn); return paths.javaPath; }
      lease.assertOwned();
      // Only the lock owner may remove interrupted extraction directories for this version/platform.
      for (const token of lease.abandonedTokens) removeOwnedChild(paths.root, `${paths.home}.stage-${token}`);
      const archive = await ensureJar({jarName: path.basename(new URL(info.url).pathname), releaseUrl: info.url,
        checksumUrl: info.url}, {cacheDir: paths.root, expectedChecksum: info.sha256, fetchText: async () => info.sha256,
        download: async (url, target) => (options.download || download)(url, target, received => {
          if (received > info.size) throw new Error("Runtime archive exceeds pinned size");
        }, {totalTimeoutMs: Math.min(120_000, remaining())}),
        lockOptions: {...options.lockOptions, now, waitMs: remaining()}});
      if (fs.statSync(archive).size !== info.size || sha256OfFile(archive) !== info.sha256) throw new Error("Runtime archive does not match pinned release");
      lease.assertOwned();
      (options.extract || extractRuntime)(archive, stage, info, Math.min(90_000, remaining()));
      const files = inventory(stage);
      if (!files[info.java]?.sha256) throw new Error("Java executable missing from runtime archive");
      fs.writeFileSync(path.join(stage, ".inventory.json"), JSON.stringify({version: info.version, archive: info.sha256, files}));
      lease.assertOwned();
      remaining();
      removeOwnedChild(paths.root, paths.home);
      fs.renameSync(stage, paths.home);
      checkJava(paths.javaPath, info, options.spawn);
      console.error(`Prepared Java ${info.version}: ${paths.javaPath}`);
      return paths.javaPath;
    } catch (error) {
      if (error.code !== "LOCK_OWNERSHIP_LOST") throw error;
    } finally {
      try { removeOwnedChild(paths.root, stage); }
      finally { lease.release(); }
    }
  }
}

module.exports = {runtimeInfo, runtimePaths, verifiedRuntime, ensureRuntime};
