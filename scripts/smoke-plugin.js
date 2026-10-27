const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");

// Offline packaging/lifecycle check. No model calls, credentials, or user-profile changes.
const root = path.resolve(__dirname, "..");
const codex = process.argv[2] || (process.platform === "win32" ? "codex.exe" : "codex");
const baselineRef = process.argv[3];
fs.mkdirSync(path.join(root, "output"), {recursive: true});
const output = fs.mkdtempSync(path.join(root, "output/plugin-smoke-"));
const profile = path.join(output, "profile"), marketplace = path.join(output, "marketplace");
const plugin = path.join(marketplace, "plugins/commerce-backend-expert"), cwd = path.join(output, "work");
const marketplaceName = "commerce-context-mcp";
const pluginId = "commerce-backend-expert@" + marketplaceName;
const runtimePaths = ["plugin.json", "package.json", "LICENSE", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json", ".cursor-plugin/plugin.json", ".cursor/rules/commerce-backend.mdc", "skills", "hooks/session.json", "hooks/session.js"];

function copyRuntime(source) {
  for (const relative of runtimePaths) {
    const destination = path.join(plugin, relative); fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.cpSync(path.join(source, relative), destination, {recursive: true});
  }
}

function run(label, args) {
  const result = spawnSync(codex, args, {cwd, env: {...process.env, CODEX_HOME: profile}, encoding: "utf8", windowsHide: true, timeout: 30000});
  fs.writeFileSync(path.join(output, label + ".log"), result.stdout || "");
  fs.writeFileSync(path.join(output, label + ".stderr"), result.stderr || "");
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function compareFiles(source, cached) {
  let count = 0;
  assert.deepEqual(fs.readdirSync(cached).sort(), fs.readdirSync(source).sort(), "Cached file set differs");
  for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
    const from = path.join(source, entry.name), to = path.join(cached, entry.name);
    if (entry.isDirectory()) count += compareFiles(from, to);
    else { assert.deepEqual(fs.readFileSync(to), fs.readFileSync(from), entry.name); count++; }
  }
  return count;
}

try {
  fs.mkdirSync(plugin, {recursive: true}); fs.mkdirSync(cwd); fs.mkdirSync(profile);
  let baselineRoot;
  if (baselineRef) {
    baselineRoot = path.join(output, "baseline"); fs.mkdirSync(baselineRoot);
    const repository = spawnSync("git", ["rev-parse", "--show-toplevel"], {cwd: root, encoding: "utf8", windowsHide: true, timeout: 10000});
    assert.ifError(repository.error); assert.equal(repository.status, 0, "Baseline checks require an accessible Git checkout");
    const revision = spawnSync("git", ["rev-parse", "--verify", "--end-of-options", baselineRef + "^{commit}"], {cwd: root, encoding: "utf8", windowsHide: true, timeout: 10000});
    assert.ifError(revision.error); assert.equal(revision.status, 0, revision.stderr);
    const archive = path.join(output, "baseline.tar");
    for (const [command, args] of [["git", ["-C", repository.stdout.trim(), "-c", "core.autocrlf=false", "-c", "core.eol=lf", "archive", "--format=tar", "--output", archive, revision.stdout.trim()]], ["tar", ["-xf", archive, "-C", baselineRoot]]]) {
      const result = spawnSync(command, args, {cwd: root, encoding: "utf8", windowsHide: true, timeout: 10000});
      assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
    }
    assert.ok(fs.existsSync(path.join(baselineRoot, "plugin.json")), "Baseline archive must contain the repository root");
  }
  copyRuntime(baselineRoot || root);
  fs.mkdirSync(path.join(marketplace, ".agents/plugins"), {recursive: true});
  fs.writeFileSync(path.join(marketplace, ".agents/plugins/marketplace.json"), JSON.stringify({name: marketplaceName, plugins: [{name: "commerce-backend-expert", source: {source: "local", path: "./plugins/commerce-backend-expert"}, policy: {installation: "AVAILABLE", authentication: "ON_INSTALL"}, category: "Productivity"}]}));
  run("marketplace-add", ["plugin", "marketplace", "add", marketplace, "--json"]);
  const available = run("available", ["plugin", "list", "--marketplace", marketplaceName, "--available", "--json"]);
  let baselineInstalled;
  if (baselineRoot) {
    baselineInstalled = run("baseline-install", ["plugin", "add", pluginId, "--json"]);
    compareFiles(plugin, baselineInstalled.installedPath);
    assert.ok(path.resolve(plugin).startsWith(path.resolve(output) + path.sep));
    fs.renameSync(plugin, path.join(output, "baseline-runtime"));
    copyRuntime(root);
  }
  const installed = run("install", ["plugin", "add", pluginId, "--json"]);
  assert.equal(installed.version, JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8")).version);
  if (baselineInstalled) assert.notEqual(installed.version, baselineInstalled.version, "Baseline must differ from the candidate version");
  const comparedFiles = compareFiles(plugin, installed.installedPath);
  const listed = run("installed", ["plugin", "list", "--marketplace", marketplaceName, "--json"]);
  assert.ok(listed.installed.some(item => item.name === "commerce-backend-expert" && item.enabled));
  const entry = path.join(plugin, "skills/commerce-backend-expert/SKILL.md"), source = fs.readFileSync(entry, "utf8");
  fs.writeFileSync(entry, source + "\n<!-- local refresh probe -->\n");
  const refreshed = run("reinstall", ["plugin", "add", pluginId, "--json"]);
  compareFiles(plugin, refreshed.installedPath);
  fs.writeFileSync(entry, source);
  const nextVersion = installed.version + "-smoke.1";
  for (const relative of ["plugin.json", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json", ".cursor-plugin/plugin.json"]) {
    const file = path.join(plugin, relative), manifest = JSON.parse(fs.readFileSync(file, "utf8"));
    manifest.version = nextVersion; fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  }
  const upgraded = run("fixture-upgrade", ["plugin", "add", pluginId, "--json"]);
  assert.equal(upgraded.version, nextVersion); compareFiles(plugin, upgraded.installedPath);
  run("remove", ["plugin", "remove", pluginId, "--json"]);
  assert.equal(run("after-remove", ["plugin", "list", "--marketplace", marketplaceName, "--json"]).installed.length, 0);
  assert.ok(!fs.existsSync(upgraded.installedPath));
  run("marketplace-remove", ["plugin", "marketplace", "remove", marketplaceName, "--json"]);
  const summary = {output, comparedFiles, version: installed.version, baselineRef: baselineRef || null, baselineVersion: baselineInstalled?.version || null, baselineUpgrade: Boolean(baselineInstalled), fixtureUpgradeVersion: nextVersion, available, installed, sameVersionRefresh: true, differentVersionRefresh: true, removed: true, credentialsCopied: false, modelCalls: 0};
  fs.writeFileSync(path.join(output, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error("Local plugin check failed. Evidence: " + output + "\n" + error.message); process.exitCode = 1;
}
