const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function temporaryDirectory(prefix, testContext) {
  assert.ok(prefix.startsWith("commerce-") && path.basename(prefix) === prefix);
  const parent = path.resolve(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(parent, prefix));
  const fixture = {dir, cleanup() {
    assert.equal(path.dirname(dir), parent);
    assert.ok(path.basename(dir).startsWith(prefix));
    if (!fs.existsSync(dir)) return;
    assert.equal(fs.lstatSync(dir).isSymbolicLink(), false, "Refuse to clean a replaced fixture root");
    fs.rmSync(dir, {recursive: true, force: true});
  }};
  testContext?.after(fixture.cleanup);
  return fixture;
}

function isolatedJavaEnvironment(cacheDir) {
  const tools = path.join(cacheDir, "tools");
  fs.mkdirSync(tools);
  if (process.platform !== "win32") {
    for (const name of ["tar", "gzip"]) {
      fs.symlinkSync(fs.realpathSync(`/usr/bin/${name}`), path.join(tools, name));
    }
  }
  return {...process.env, PATH: tools, JAVA_HOME: path.join(cacheDir, "no-system-java"),
    TEMP: cacheDir, TMP: cacheDir, TMPDIR: cacheDir};
}

module.exports = {temporaryDirectory, isolatedJavaEnvironment};
