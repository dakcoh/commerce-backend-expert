const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {releaseInfo} = require("../lib/release-client");
const {cachePaths, ensureJar, acquireLock, verifyCached} = require("../lib/jar-cache");
const {execFile, spawnSync} = require("node:child_process");
const {promisify} = require("node:util");
const {sha256OfFile} = require("../lib/checksum");

function cacheFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-boundary-"));
  const info = releaseInfo({version: "0.1.0"});
  const paths = cachePaths(info, dir);
  const source = path.join(dir, "source.jar");
  fs.writeFileSync(source, "verified-test-content");
  const checksum = sha256OfFile(source);
  return {dir, info, paths, source, checksum,
    publish() {fs.copyFileSync(source, paths.jarPath); fs.writeFileSync(paths.checksumPath, checksum);},
    cleanup() {
      for (const file of fs.readdirSync(dir)) {
        const target = path.resolve(dir, file);
        assert.equal(path.dirname(target), path.resolve(dir));
        fs.unlinkSync(target);
      }
      fs.rmdirSync(dir);
    }};
}

test("an old lock held by a live process is not stolen", async () => {
  const f = cacheFixture(); let downloads = 0;
  fs.writeFileSync(f.paths.lockPath, String(process.pid));
  const old = new Date(Date.now() - 180_000); fs.utimesSync(f.paths.lockPath, old, old);
  const completed = setTimeout(() => f.publish(), 30);
  try {
    await ensureJar(f.info, {cacheDir: f.dir, fetchText: async () => f.checksum,
      download: async (_url, destination) => {downloads++; fs.copyFileSync(f.source, destination);}});
    assert.equal(downloads, 0);
    assert.equal(fs.readFileSync(f.paths.lockPath, "utf8"), String(process.pid));
  } finally {clearTimeout(completed); f.cleanup();}
});

test("ownership loss preserves the new lock and the original wait budget", async () => {
  const f = cacheFixture(); const replacement = JSON.stringify({pid: process.pid, token: "replacement-owner", host: os.hostname()});
  let now = 0;
  try {
    await assert.rejects(ensureJar(f.info, {cacheDir: f.dir, fetchText: async () => f.checksum,
      lockOptions: {waitMs: 100, pollMs: 30, now: () => now, sleep: async ms => {now += ms;}},
      download: async (_url, destination) => {
        now += 40;
        fs.copyFileSync(f.source, destination);
        fs.writeFileSync(f.paths.lockPath, replacement);
      }}), /Timed out/);
    assert.equal(now, 100);
    assert.equal(fs.readFileSync(f.paths.lockPath, "utf8"), replacement);
    assert.equal(fs.existsSync(f.paths.jarPath), false);
    assert.equal(fs.readdirSync(f.dir).filter(file => file.endsWith(".tmp")).length, 0);
  } finally {f.cleanup();}
});

test("ownership loss recovers when the replacement owner has terminated", async () => {
  const f = cacheFixture(); let downloads = 0;
  const exited = spawnSync(process.execPath, ["-e", ""], {windowsHide: true});
  assert.equal(exited.status, 0);
  try {
    await ensureJar(f.info, {cacheDir: f.dir, fetchText: async () => f.checksum,
      download: async (_url, destination) => {
        fs.copyFileSync(f.source, destination);
        if (++downloads === 1) fs.writeFileSync(f.paths.lockPath, String(exited.pid));
      }});
    assert.equal(downloads, 2);
    assert.equal(verifyCached(f.paths).ok, true);
    assert.equal(fs.existsSync(f.paths.lockPath), false);
    assert.equal(fs.readdirSync(f.dir).filter(file => file.endsWith(".tmp")).length, 0);
  } finally {f.cleanup();}
});

test("repeated ownership loss cannot reset the recovery deadline", async () => {
  const f = cacheFixture(); let now = 0, downloads = 0;
  const exited = spawnSync(process.execPath, ["-e", ""], {windowsHide: true});
  assert.equal(exited.status, 0);
  try {
    await assert.rejects(ensureJar(f.info, {cacheDir: f.dir, fetchText: async () => f.checksum,
      lockOptions: {waitMs: 100, now: () => now},
      download: async (_url, destination) => {
        downloads++; now += 60;
        fs.copyFileSync(f.source, destination);
        fs.writeFileSync(f.paths.lockPath, String(exited.pid));
      }}), /Timed out/);
    assert.equal(downloads, 2);
    assert.equal(now, 120);
    assert.equal(verifyCached(f.paths).ok, false);
    assert.equal(fs.readdirSync(f.dir).filter(file => file.endsWith(".tmp")).length, 0);
  } finally {f.cleanup();}
});

test("two processes recovering a dead lock both obtain the verified winner cache", {timeout: 30_000}, async () => {
  const f = cacheFixture();
  const exited = spawnSync(process.execPath, ["-e", ""], {windowsHide: true});
  assert.equal(exited.status, 0);
  fs.writeFileSync(f.paths.lockPath, String(exited.pid));
  const marker = (name, stage) => path.join(f.dir, `${name}.${stage}`);
  const script = `const fs=require('fs'),path=require('path');
    const {ensureJar,cachePaths}=require(process.argv[1]);
    const dir=process.argv[2],checksum=process.argv[3],name=process.argv[4];
    const info={jarName:'context-engine-0.1.0.jar',releaseUrl:'fixture',checksumUrl:'fixture'};
    const lock=cachePaths(info,dir).lockPath,marker=stage=>path.join(dir,name+'.'+stage);
    const unlink=fs.unlinkSync;let paused=false;
    fs.unlinkSync=file=>{
      if(file===lock&&!paused){paused=true;fs.writeFileSync(marker('ready'),'');
        const end=Date.now()+15000;
        while(!fs.existsSync(marker('go'))){if(Date.now()>end)throw Error('barrier timeout');
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}}
      return unlink(file);
    };
    ensureJar(info,{cacheDir:dir,lockOptions:{waitMs:10000,pollMs:10},fetchText:async()=>checksum,
      download:async(_url,dest)=>{fs.copyFileSync(path.join(dir,'source.jar'),dest);
        fs.writeFileSync(marker('download'),'');const end=Date.now()+15000;
        while(!fs.existsSync(marker('finish'))){if(Date.now()>end)throw Error('transfer timeout');
          await new Promise(r=>setTimeout(r,10));}}
    }).catch(e=>{console.error(e);process.exitCode=1});`;
  const runs = Promise.allSettled(["a", "b"].map(name => promisify(execFile)(process.execPath,
    ["-e", script, require.resolve("../lib/jar-cache"), f.dir, f.checksum, name], {windowsHide: true, timeout: 20_000})));
  const waitFor = async file => {
    const end = Date.now() + 10_000;
    while (!fs.existsSync(file)) {
      assert.ok(Date.now() < end, `Timed out waiting for ${file}`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  try {
    await Promise.all(["a", "b"].map(name => waitFor(marker(name, "ready"))));
    fs.writeFileSync(marker("a", "go"), ""); await waitFor(marker("a", "download"));
    fs.writeFileSync(marker("b", "go"), ""); await waitFor(marker("b", "download"));
    for (const name of ["a", "b"]) fs.writeFileSync(marker(name, "finish"), "");
    for (const run of await runs) assert.equal(run.status, "fulfilled", run.reason?.stderr);
    assert.equal(verifyCached(f.paths).ok, true);
    assert.equal(fs.existsSync(f.paths.lockPath), false);
    assert.equal(fs.readdirSync(f.dir).filter(file => file.endsWith(".tmp")).length, 0);
  } finally {
    for (const name of ["a", "b"]) for (const stage of ["go", "finish"]) fs.writeFileSync(marker(name, stage), "");
    await runs;
    f.cleanup();
  }
});

test("multiple processes share one verified transfer", async () => {
  const f = cacheFixture();
  const script = `const fs=require('fs'),path=require('path');
    const {ensureJar}=require(process.argv[1]);
    ensureJar({jarName:'context-engine-0.1.0.jar',releaseUrl:'fixture',checksumUrl:'fixture'}, {
      cacheDir:process.argv[2],fetchText:async()=>process.argv[3],
      download:async(_url,dest)=>{fs.appendFileSync(path.join(process.argv[2],'transfers'),'1');
        await new Promise(r=>setTimeout(r,100));fs.copyFileSync(path.join(process.argv[2],'source.jar'),dest);}
    }).catch(e=>{console.error(e);process.exitCode=1});`;
  try {
    const runs = await Promise.allSettled(Array.from({length: 4}, () => promisify(execFile)(process.execPath,
      ["-e", script, require.resolve("../lib/jar-cache"), f.dir, f.checksum], {windowsHide: true})));
    for (const run of runs) assert.equal(run.status, "fulfilled", run.reason?.stderr);
    assert.equal(fs.readFileSync(path.join(f.dir, "transfers"), "utf8"), "1");
    assert.equal(verifyCached(f.paths).ok, true);
    assert.equal(fs.existsSync(f.paths.lockPath), false);
  } finally { f.cleanup(); }
});

test("default lock budget survives a simulated 36-second live transfer", async () => {
  const f = cacheFixture(); let now = 0;
  fs.writeFileSync(f.paths.lockPath, String(process.pid));
  try {
    const lease = await acquireLock(f.paths, {now: () => now, sleep: async () => {
      now += 12_000;
      if (now === 36_000) f.publish();
    }});
    assert.equal(lease, null);
    assert.equal(now, 36_000);
    assert.equal(fs.readFileSync(f.paths.lockPath, "utf8"), String(process.pid));
  } finally {f.cleanup();}
});

test("a terminated local PID lock is recovered but foreign and malformed locks are preserved", async () => {
  const f = cacheFixture();
  const exited = spawnSync(process.execPath, ["-e", ""], {windowsHide: true});
  assert.equal(exited.status, 0);
  try {
    for (const content of [String(exited.pid), JSON.stringify({pid: exited.pid, host: os.hostname(), token: "dead-owner"})]) {
      fs.writeFileSync(f.paths.lockPath, content);
      const lease = await acquireLock(f.paths);
      lease.assertOwned(); lease.release();
      assert.equal(fs.existsSync(f.paths.lockPath), false);
    }
    for (const content of ["", "invalid-owner", JSON.stringify({pid: exited.pid}),
      JSON.stringify({pid: exited.pid, host: "foreign-host", token: "foreign-owner"})]) {
      fs.writeFileSync(f.paths.lockPath, content);
      await assert.rejects(acquireLock(f.paths, {waitMs: 15, pollMs: 5}), /Timed out/);
      assert.equal(fs.readFileSync(f.paths.lockPath, "utf8"), content);
    }
  } finally {f.cleanup();}
});

test("checksum mismatch cleans all three attempts and the following run succeeds", async () => {
  const f = cacheFixture(); let downloads = 0;
  try {
    await assert.rejects(ensureJar(f.info, {cacheDir: f.dir, fetchText: async () => f.checksum,
      download: async (_url, destination) => {downloads++; fs.writeFileSync(destination, "corrupt");}}), /Checksum mismatch/);
    assert.equal(downloads, 3);
    assert.equal(verifyCached(f.paths).ok, false);
    assert.deepEqual(fs.readdirSync(f.dir), ["source.jar"]);
    await ensureJar(f.info, {cacheDir: f.dir, fetchText: async () => f.checksum,
      download: async (_url, destination) => fs.copyFileSync(f.source, destination)});
    assert.equal(verifyCached(f.paths).ok, true);
  } finally {f.cleanup();}
});
