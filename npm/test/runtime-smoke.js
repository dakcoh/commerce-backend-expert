const {temporaryDirectory, isolatedJavaEnvironment} = require("./support/fixtures");
// Real vendor archive, OS extraction and executable; unit tests use small synthetic fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {execFile} = require("node:child_process");
const {promisify} = require("node:util");
const {runtimeInfo, runtimePaths, verifiedRuntime} = require("../lib/managed-runtime");

async function main() {
  const {dir: cacheDir, cleanup} = temporaryDirectory("commerce-runtime-한글-🧪-real-");
  try {
    const env = isolatedJavaEnvironment(cacheDir);
    const script = `const {ensureRuntime}=require(process.argv[1]);
      ensureRuntime({cacheDir:process.argv[2],...(process.argv[3]==='offline'
        ? {download:async()=>{throw Error('offline: unexpected network access');}} : {})})
        .then(p=>console.log(JSON.stringify(p))).catch(e=>{console.error(e);process.exitCode=1});`;
    const run = async (mode) => {
      const result = await promisify(execFile)(process.execPath, ["-e", script,
        require.resolve("../lib/managed-runtime"), cacheDir, mode], {env, windowsHide: true, timeout: 660_000});
      return JSON.parse(result.stdout);
    };
    const started = Date.now();
    // Wait for both workers before cleanup, including a failed cold start.
    const results = await Promise.allSettled([run("cold"), run("cold")]);
    for (const result of results) if (result.status === "rejected") throw result.reason;
    const [one, two] = results.map(result => result.value);
    assert.equal(one, two);
    const info = runtimeInfo(), paths = runtimePaths(cacheDir, info);
    const launched = fs.statSync(one, {bigint: true}), installed = fs.statSync(paths.javaPath, {bigint: true});
    assert.deepEqual([launched.dev, launched.ino], [installed.dev, installed.ino]);
    assert.ok(verifiedRuntime(paths, info));
    const coldMs = Date.now() - started;
    assert.equal(await run("offline"), one);
    // Damage an installed file without modifying a potentially locked Windows executable.
    const release = path.join(path.dirname(path.dirname(one)), "release");
    const original = fs.readFileSync(release);
    fs.appendFileSync(release, "\ncorrupt-cache-fixture\n");
    fs.unlinkSync(path.join(paths.root, `${path.basename(new URL(info.url).pathname)}.sha256`));
    assert.equal(verifiedRuntime(paths, info), false);
    assert.equal(await run("offline"), one);
    assert.deepEqual(fs.readFileSync(release), original);
    assert.ok(verifiedRuntime(paths, info));
    console.log(`Managed runtime smoke passed: ${process.platform}/${process.arch}, two processes, no system Java, offline reuse/repair without sidecar, cold=${coldMs}ms`);
  } finally {
    cleanup();
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
