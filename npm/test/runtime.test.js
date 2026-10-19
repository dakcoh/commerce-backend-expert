const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const {createHash} = require("node:crypto");
const {ensureRuntime, runtimePaths, runtimeInfo, verifiedRuntime} = require("../lib/managed-runtime");
const {validateEntries} = require("../lib/runtime-archive");
const {run} = require("../lib/commands");
const {cachePaths} = require("../lib/jar-cache");
const {releaseInfo} = require("../lib/release-client");
const manifest = require("../lib/runtime-manifest.json");
const {javaExecutable} = require("../lib/java-runtime");
const digest = value => createHash("sha256").update(value).digest("hex");

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-runtime-"));
  t.after(() => {
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith("commerce-runtime-"));
    fs.rmSync(dir, {recursive: true, force: true});
  });
  const bytes = "verified-runtime-archive";
  const info = {id: "test-runtime", version: "21.0.12.1+1", java: "jre/bin/java",
    url: "https://github.com/example/runtime.zip", size: Buffer.byteLength(bytes), sha256: digest(bytes)};
  let downloads = 0, extracts = 0, executions = 0;
  const options = {cacheDir: dir, info, lockOptions: {pollMs: 2, waitMs: 2000},
    download: async (_url, target) => { downloads++; await new Promise(r => setTimeout(r, 5)); fs.writeFileSync(target, bytes); },
    extract: (_archive, target) => {extracts++; fs.mkdirSync(path.dirname(path.join(target, info.java)), {recursive: true}); fs.writeFileSync(path.join(target, info.java), "java executable");},
    spawn: (command) => {executions++; assert.ok(path.isAbsolute(command)); assert.notEqual(command, "java"); return {status: 0, stderr: 'openjdk version "21.0.12.1"'};}};
  return {dir, info, options, paths: runtimePaths(dir, info), counts: () => ({downloads, extracts, executions})};
}

test("pins six platform archives and rejects unsupported CPUs", () => {
  assert.equal(Object.keys(manifest.assets).length, 6);
  for (const asset of Object.values(manifest.assets)) {
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.ok(asset.size > 1_000_000);
    assert.match(asset.url, /^https:\/\/github.com\/adoptium\/temurin21-binaries\/releases\/download\//);
  }
  assert.throws(() => runtimeInfo("linux", "ia32"), /Unsupported/);
  assert.throws(() => runtimeInfo("freebsd", "x64"), /Unsupported/);
});

test("Windows Unicode runtime paths use a short alias without interpolating paths into PowerShell", () => {
  const long = "C:\\사용자\\한글-🧪\\java.exe";
  const short = "C:\\Users\\USER~1\\java.exe";
  const fail = () => {throw Error("unexpected process");};
  assert.equal(javaExecutable("C:\\private\\java.exe", fail, "win32"), "C:\\private\\java.exe");
  assert.equal(javaExecutable(long, fail, "linux"), long);
  assert.equal(javaExecutable(long, (_command, args, options) => {
    assert.equal(options.env.COMMERCE_RUNTIME_LONG_PATH, long);
    assert.equal(args.includes(long), false);
    assert.equal(args.at(-1).includes(long), false);
    assert.equal(options.windowsHide, true);
    return {status: 0, stdout: short};
  }, "win32"), short);
  for (const result of [{status: 1}, {status: 0, stdout: long}, {status: 0, stdout: "relative"}]) {
    assert.throws(() => javaExecutable(long, () => result, "win32"), /COMMERCE_CONTEXT_CACHE_DIR/);
  }
});

test("the private cache directory can be selected without changing system Java", () => {
  const previous = process.env.COMMERCE_CONTEXT_CACHE_DIR;
  try {
    process.env.COMMERCE_CONTEXT_CACHE_DIR = path.resolve("private-runtime-cache");
    assert.equal(cachePaths({jarName: "server.jar"}).cacheDir, path.resolve("private-runtime-cache"));
  } finally {
    if (previous === undefined) delete process.env.COMMERCE_CONTEXT_CACHE_DIR;
    else process.env.COMMERCE_CONTEXT_CACHE_DIR = previous;
  }
});

test("concurrent first use publishes one runtime; warm use is offline", async t => {
  const f = fixture(t);
  const [one, two] = await Promise.all([ensureRuntime(f.options), ensureRuntime(f.options)]);
  assert.equal(one, two);
  assert.deepEqual(f.counts(), {downloads: 1, extracts: 1, executions: 2});
  assert.equal(await ensureRuntime({...f.options, download: () => {throw Error("offline");}}), one);
  assert.ok(verifiedRuntime(f.paths, f.info));
});

test("damaged installation and damaged archive recover against the pinned checksum", async t => {
  const f = fixture(t);
  await ensureRuntime(f.options);
  fs.writeFileSync(f.paths.javaPath, "corrupt");
  assert.equal(verifiedRuntime(f.paths, f.info), false);
  await ensureRuntime(f.options);
  assert.equal(f.counts().downloads, 1);
  fs.writeFileSync(f.paths.javaPath, "corrupt again");
  const archive = path.join(f.paths.root, "runtime.zip");
  fs.writeFileSync(archive, "bad archive");
  fs.writeFileSync(archive + ".sha256", digest("bad archive"));
  await ensureRuntime(f.options);
  assert.equal(f.counts().downloads, 2);
  assert.ok(verifiedRuntime(f.paths, f.info));
});

test("a missing archive sidecar does not prevent offline runtime repair", async t => {
  const f = fixture(t);
  await ensureRuntime(f.options);
  fs.unlinkSync(f.paths.javaPath);
  fs.unlinkSync(path.join(f.paths.root, "runtime.zip.sha256"));
  const repaired = await ensureRuntime({...f.options, download: async () => {throw Error("offline");}});
  assert.equal(repaired, f.paths.javaPath);
  assert.equal(f.counts().downloads, 1);
  assert.ok(verifiedRuntime(f.paths, f.info));
});

test("doctor fails on a missing or damaged JAR and succeeds only with both caches ready", async t => {
  const f = fixture(t);
  const actual = runtimeInfo();
  f.info.id = actual.id;
  f.info.java = actual.java;
  await ensureRuntime(f.options);
  const paths = runtimePaths(f.dir, actual);
  const inventoryPath = path.join(paths.home, ".inventory.json");
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  inventory.archive = actual.sha256;
  fs.writeFileSync(inventoryPath, JSON.stringify(inventory));
  assert.ok(verifiedRuntime(paths, actual));
  const pkg = require("../package.json");
  const jar = cachePaths(releaseInfo(pkg), f.dir);
  const previousExitCode = process.exitCode;
  const print = console.log;
  console.log = () => {};
  try {
    process.exitCode = 0;
    await run(["doctor"], pkg, {cacheDir: f.dir});
    assert.equal(process.exitCode, 1, "a missing server JAR must fail doctor");
    fs.writeFileSync(jar.jarPath, "server");
    fs.writeFileSync(jar.checksumPath, digest("server"));
    await run(["doctor"], pkg, {cacheDir: f.dir});
    assert.equal(process.exitCode, 0, "a fully prepared cache must pass doctor");
    fs.writeFileSync(jar.jarPath, "damaged");
    await run(["doctor"], pkg, {cacheDir: f.dir});
    assert.equal(process.exitCode, 1);
  } finally { console.log = print; process.exitCode = previousExitCode; }
});

test("dead lock and interrupted extraction recover without retaining partial installation", async t => {
  const f = fixture(t);
  fs.mkdirSync(f.paths.root, {recursive: true});
  const exited = spawnSync(process.execPath, ["-e", ""], {windowsHide: true});
  fs.writeFileSync(f.paths.lockPath, JSON.stringify({pid: exited.pid, host: os.hostname(), token: "interrupted"}));
  const stale = f.paths.home + ".stage-interrupted";
  fs.mkdirSync(stale); fs.writeFileSync(path.join(stale, "partial"), "partial");
  const token = "12345678-1234-1234-1234-123456789abc";
  const archive = path.join(f.paths.root, "runtime.zip");
  fs.writeFileSync(archive + ".lock", JSON.stringify({pid: exited.pid, host: os.hostname(), token}));
  const partial = `${archive}.${token}.1.tmp`;
  fs.writeFileSync(partial, "interrupted transfer");
  await ensureRuntime(f.options);
  assert.equal(fs.existsSync(stale), false);
  assert.equal(fs.existsSync(partial), false);
  assert.equal(fs.existsSync(f.paths.lockPath), false);
});

test("extraction failure is retryable and cleans stage and lock", async t => {
  const f = fixture(t);
  await assert.rejects(ensureRuntime({...f.options, extract: (_file, stage) => {
    fs.mkdirSync(stage); throw Error("interrupted extraction");
  }}), /interrupted extraction/);
  assert.equal(fs.existsSync(f.paths.home), false);
  assert.equal(fs.readdirSync(f.paths.root).some(name => name.includes(".stage-") || name.endsWith(".lock")), false);
  await ensureRuntime(f.options);
});

test("checksum failure has three attempts and never extracts or executes", async t => {
  const f = fixture(t); let attempts = 0;
  await assert.rejects(ensureRuntime({...f.options, download: async (_url, target) => {attempts++; fs.writeFileSync(target, "bad");}}), /Checksum mismatch/);
  assert.equal(attempts, 3);
  assert.equal(f.counts().extracts, 0);
  assert.equal(f.counts().executions, 0);
  assert.equal(fs.existsSync(f.paths.home), false);
});

test("ownership loss keeps the original deadline and preserves replacement lock", async t => {
  const f = fixture(t); let now = 0;
  const replacement = JSON.stringify({pid: process.pid, host: os.hostname(), token: "replacement"});
  await assert.rejects(ensureRuntime({...f.options,
    lockOptions: {waitMs: 100, pollMs: 20, now: () => now, sleep: async ms => {now += ms;}},
    extract: (...args) => {f.options.extract(...args); now = 80; fs.writeFileSync(f.paths.lockPath, replacement);}
  }), /Timed out/);
  assert.equal(now, 100);
  assert.equal(fs.readFileSync(f.paths.lockPath, "utf8"), replacement);
  assert.equal(fs.existsSync(f.paths.home), false);
});

function entries(rows) {
  return validateEntries(rows.map(([name]) => name).join("\n"),
    rows.map(([name, type = "-", target]) => `${type}rwxr-xr-x 0 root root 0 Jan 1 00:00 ${name}${target ? ` -> ${target}` : ""}`).join("\n"), "jre");
}

test("archive validation accepts internal file links and rejects escaping and ambiguous paths", () => {
  const base = [["jre/", "d"], ["jre/bin/", "d"], ["jre/bin/java"]];
  assert.equal(entries([...base, ["jre/link", "l", "bin/java"]]).size, 4);
  for (const name of ["../outside", "/outside", "jre/../outside", "jre/C:ads", "jre/back\\slash", "jre/CON", "jre/file."]) {
    assert.throws(() => entries([...base, [name]]));
  }
  assert.throws(() => entries([...base, ["jre/BIN/java"]]), /Duplicate/);
  assert.throws(() => entries([...base, ["jre/link", "l", "../../outside"]]), /escapes/);
  assert.throws(() => entries([...base, ["jre/link", "l", "bin/java"], ["jre/link/child"]]), /ancestor/);
  assert.throws(() => entries([...base, ["jre/device", "c"]]), /Unsupported/);
  assert.throws(() => entries([...base, ["jre/hardlink", "h"]]), /Unsupported/);
});
