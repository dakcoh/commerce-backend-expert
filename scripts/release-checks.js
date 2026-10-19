const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const {execFileSync} = require("node:child_process");
const {parseChecksum, verifyFile} = require("../npm/lib/checksum");

const root = path.resolve(__dirname, "..");
const packageFiles = ["LICENSE", "README.md", "bin/index.js", "lib/checksum.js", "lib/commands.js",
  "lib/jar-cache.js", "lib/java-runtime.js", "lib/release-client.js", "lib/server-process.js", "package.json"];
const wrapperSha256 = "7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172";
const distributionSha256 = "6f74b601422d6d6fc4e1f9a1ab6522f642c2fdcbc15ae33ebd30ba3d7198e854";
const digest = (file, algorithm = "sha256", encoding = "hex") => crypto.createHash(algorithm).update(fs.readFileSync(file)).digest(encoding);

function releaseVersion(pkg, tag = "") {
  const numeric = "(?:0|[1-9][0-9]*)";
  const identifier = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)";
  const semver = new RegExp(`^${numeric}\\.${numeric}\\.${numeric}(?:-${identifier}(?:\\.${identifier})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);
  assert.ok(semver.test(pkg.version), "Invalid package semantic version");
  if (tag) assert.equal(tag, `v${pkg.version}`, "Release tag must match npm package version exactly");
  assert.equal(pkg.name, "commerce-context-mcp");
  assert.equal(pkg.engines.node, ">=22");
  for (const key of ["dependencies", "optionalDependencies"]) assert.equal(Object.keys(pkg[key] || {}).length, 0, "Launcher must remain dependency-free");
  return {version: pkg.version, npmTag: pkg.version.split("+")[0].includes("-") ? "next" : "latest"};
}

function verifyWrapper(base = root) {
  assert.equal(digest(path.join(base, "gradle/wrapper/gradle-wrapper.jar")), wrapperSha256, "Gradle wrapper checksum mismatch");
  const properties = fs.readFileSync(path.join(base, "gradle/wrapper/gradle-wrapper.properties"), "utf8");
  assert.match(properties, /^distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-8\.14\.5-bin\.zip\r?$/m);
  assert.ok(properties.split(/\r?\n/).includes(`distributionSha256Sum=${distributionSha256}`), "Gradle distribution checksum missing or changed");
}

function verifyPack(pack, directory, pkg, source = path.join(root, "npm")) {
  releaseVersion(pkg);
  assert.equal(pack.name, pkg.name); assert.equal(pack.version, pkg.version);
  assert.equal(pack.filename, `${pkg.name}-${pkg.version}.tgz`);
  assert.deepEqual(pack.files.map(file => file.path).sort(), [...packageFiles].sort(), "Unexpected npm package file list");
  const archive = path.join(directory, pack.filename);
  assert.equal(pack.integrity, `sha512-${digest(archive, "sha512", "base64")}`, "npm tarball integrity mismatch");
  // GNU tar treats a Windows drive prefix as a remote host; open the filename in its directory.
  const entries = execFileSync("tar", ["-tzf", pack.filename], {cwd: directory, encoding: "utf8"}).trim().split(/\r?\n/);
  assert.deepEqual(entries.sort(), packageFiles.map(file => `package/${file}`).sort(), "Actual tarball contents differ");
  for (const file of packageFiles) {
    const packaged = execFileSync("tar", ["-xOzf", pack.filename, `package/${file}`], {cwd: directory});
    assert.deepEqual(packaged, fs.readFileSync(path.join(source, file)), `Tarball source differs: ${file}`);
  }
  return pack.filename;
}

function verifyBundle(directory, pkg) {
  const {version} = releaseVersion(pkg);
  const jar = `context-engine-${version}.jar`;
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "bundle.json"), "utf8"));
  assert.equal(manifest.version, version);
  const pack = JSON.parse(fs.readFileSync(path.join(directory, "npm-pack.json"), "utf8"))[0];
  const tarball = verifyPack(pack, directory, pkg);
  const names = [jar, `${jar}.sha256`, tarball, "npm-pack.json", "runtime-inventory.tsv"];
  assert.deepEqual(Object.keys(manifest.sha256).sort(), names.sort());
  for (const name of names) assert.equal(digest(path.join(directory, name)), manifest.sha256[name], `Bundle file changed: ${name}`);
  verifyFile(path.join(directory, jar), parseChecksum(fs.readFileSync(path.join(directory, `${jar}.sha256`), "utf8")));
  return {jar, tarball, version};
}

async function main(command) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "npm/package.json"), "utf8"));
  const {version, npmTag} = releaseVersion(pkg, process.env.RELEASE_TAG || "");
  const directory = path.join(root, "build/release");
  const jar = `context-engine-${version}.jar`;
  if (command === "version") { console.log(`version=${version}\nnpm-tag=${npmTag}`); return; }
  if (command === "wrapper") { verifyWrapper(); return; }
  if (command === "stage") {
    fs.mkdirSync(directory, {recursive: true});
    fs.copyFileSync(path.join(root, "build/libs", jar), path.join(directory, jar), fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(path.join(directory, `${jar}.sha256`), `${digest(path.join(directory, jar))}  ${jar}\n`, {flag: "wx"});
    return;
  }
  if (command === "seal") {
    const pack = JSON.parse(fs.readFileSync(path.join(directory, "npm-pack.json"), "utf8"))[0];
    const tarball = verifyPack(pack, directory, pkg);
    const names = [jar, `${jar}.sha256`, tarball, "npm-pack.json", "runtime-inventory.tsv"];
    fs.writeFileSync(path.join(directory, "bundle.json"), JSON.stringify({version,
      sha256: Object.fromEntries(names.map(name => [name, digest(path.join(directory, name))]))}, null, 2), {flag: "wx"});
    verifyBundle(directory, pkg); return;
  }
  if (command === "verify") { console.log(JSON.stringify(verifyBundle(process.argv[3] || directory, pkg))); return; }
  if (command === "registry") {
    const response = await fetch(`https://registry.npmjs.org/${pkg.name}/${encodeURIComponent(version)}`, {signal: AbortSignal.timeout(15_000)});
    await response.body?.cancel();
    assert.equal(response.status, 404, `Expected unpublished npm version; registry returned ${response.status}`);
    return;
  }
  throw new Error("Usage: node scripts/release-checks.js version|wrapper|stage|seal|verify [directory]|registry");
}

if (require.main === module) main(process.argv[2]).catch(error => {console.error(error); process.exitCode = 1;});
module.exports = {releaseVersion, verifyWrapper, verifyPack, verifyBundle, packageFiles};
