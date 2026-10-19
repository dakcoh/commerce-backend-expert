const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const {execFileSync} = require("node:child_process");
const {releaseVersion, verifyWrapper, verifyPack, verifyBundle, packageFiles} = require("../../scripts/release-checks");
const source = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"));
const hash = (file, algorithm = "sha256", encoding = "hex") => crypto.createHash(algorithm).update(fs.readFileSync(file)).digest(encoding);

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-release-check-"));
  fs.mkdirSync(path.join(dir, "package"));
  for (const file of packageFiles) {
    fs.mkdirSync(path.dirname(path.join(dir, "package", file)), {recursive: true});
    fs.copyFileSync(path.join(source, file), path.join(dir, "package", file));
  }
  const filename = `${pkg.name}-${pkg.version}.tgz`;
  execFileSync("tar", ["-czf", filename, ...packageFiles.map(file => `package/${file}`)], {cwd: dir});
  const pack = {name: pkg.name, version: pkg.version, filename, files: packageFiles.map(file => ({path: file})),
    integrity: `sha512-${hash(path.join(dir, filename), "sha512", "base64")}`};
  return {dir, pack, cleanup() {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith("commerce-release-check-"));
    fs.rmSync(dir, {recursive: true, force: true});
  }};
}

test("release versions require exact safe tags and distinguish prerelease from build metadata", () => {
  assert.deepEqual(releaseVersion({...pkg, version: "1.2.3+build-dash"}, "v1.2.3+build-dash"), {version: "1.2.3+build-dash", npmTag: "latest"});
  assert.equal(releaseVersion({...pkg, version: "1.2.3-rc.1"}, "v1.2.3-rc.1").npmTag, "next");
  for (const version of ["01.2.3", "1.2.3-01", "1.2", "1.2.3/../../x", "1.2.3\n", "1.2.3;echo secret"]) {
    assert.throws(() => releaseVersion({...pkg, version}));
  }
  for (const tag of ["1.2.3", "v9.9.9", "v1.2.3\n"]) assert.throws(() => releaseVersion({...pkg, version: "1.2.3"}, tag));
  assert.throws(() => releaseVersion({...pkg, dependencies: {unexpected: "1"}}));
  assert.throws(() => releaseVersion({...pkg, engines: {node: ">=20"}}));
});

test("official wrapper and distribution checksums are required before Gradle execution", () => {
  verifyWrapper();
  const f = fixture();
  try {
    fs.mkdirSync(path.join(f.dir, "gradle/wrapper"), {recursive: true});
    fs.writeFileSync(path.join(f.dir, "gradle/wrapper/gradle-wrapper.jar"), "untrusted");
    assert.throws(() => verifyWrapper(f.dir), /checksum mismatch/);
    fs.copyFileSync(path.resolve(source, "../gradle/wrapper/gradle-wrapper.jar"), path.join(f.dir, "gradle/wrapper/gradle-wrapper.jar"));
    fs.writeFileSync(path.join(f.dir, "gradle/wrapper/gradle-wrapper.properties"), "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.5-bin.zip\n");
    assert.throws(() => verifyWrapper(f.dir), /checksum missing/);
  } finally {f.cleanup();}
});

test("actual tarball bytes and files must match the source, metadata and integrity", () => {
  const f = fixture();
  try {
    assert.equal(verifyPack(f.pack, f.dir, pkg), f.pack.filename);
    assert.throws(() => verifyPack({...f.pack, filename: "../outside.tgz"}, f.dir, pkg));
    assert.throws(() => verifyPack({...f.pack, files: [...f.pack.files, {path: ".env"}]}, f.dir, pkg), /file list/);
    fs.appendFileSync(path.join(f.dir, f.pack.filename), "tamper");
    assert.throws(() => verifyPack(f.pack, f.dir, pkg), /integrity mismatch/);
  } finally {f.cleanup();}
});

test("valid tar integrity cannot hide changed package source", () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.dir, "package/lib/commands.js"), "changed");
    execFileSync("tar", ["-czf", f.pack.filename, ...packageFiles.map(file => `package/${file}`)], {cwd: f.dir});
    f.pack.integrity = `sha512-${hash(path.join(f.dir, f.pack.filename), "sha512", "base64")}`;
    assert.throws(() => verifyPack(f.pack, f.dir, pkg), /Tarball source differs/);
  } finally {f.cleanup();}
});

test("sealed bundle rejects changed JARs and checksums instead of trusting downloaded checksums alone", () => {
  const f = fixture();
  try {
    const jar = `context-engine-${pkg.version}.jar`;
    fs.writeFileSync(path.join(f.dir, jar), "fixture JAR");
    fs.writeFileSync(path.join(f.dir, `${jar}.sha256`), hash(path.join(f.dir, jar)));
    fs.writeFileSync(path.join(f.dir, "npm-pack.json"), JSON.stringify([f.pack]));
    fs.writeFileSync(path.join(f.dir, "runtime-inventory.tsv"), "fixture inventory");
    const files = [jar, `${jar}.sha256`, f.pack.filename, "npm-pack.json", "runtime-inventory.tsv"];
    const manifest = {version: pkg.version, sha256: Object.fromEntries(files.map(file => [file, hash(path.join(f.dir, file))]))};
    fs.writeFileSync(path.join(f.dir, "bundle.json"), JSON.stringify(manifest));
    assert.equal(verifyBundle(f.dir, pkg).jar, jar);
    fs.writeFileSync(path.join(f.dir, jar), "tampered JAR");
    fs.writeFileSync(path.join(f.dir, `${jar}.sha256`), hash(path.join(f.dir, jar)));
    assert.throws(() => verifyBundle(f.dir, pkg), /Bundle file changed/);
  } finally {f.cleanup();}
});
