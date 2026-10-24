const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");

// Native discovery only: no gateway, credentials, or model requests.
const root = path.resolve(__dirname, "..");
assert.ok(process.argv[2], "Usage: node scripts/smoke-openclaw.js /absolute/path/to/openclaw.mjs");
const cli = path.resolve(process.argv[2]);
assert.ok(fs.existsSync(cli), "OpenClaw entry point does not exist");
fs.mkdirSync(path.join(root, "output"), {recursive: true});
const output = fs.mkdtempSync(path.join(root, "output/openclaw-discovery-"));
const names = ["commerce-backend-expert", "commerce-review"], checks = [];
let command = 0;
const env = {...process.env};
for (const key of Object.keys(env)) if (key.startsWith("OPENCLAW_")) delete env[key];
env.OPENCLAW_STATE_DIR = path.join(output, "state");
env.OPENCLAW_CONFIG_PATH = path.join(output, "openclaw.json");
fs.mkdirSync(path.join(output, "work"));
function configure(extraDirs) {
  fs.writeFileSync(env.OPENCLAW_CONFIG_PATH, JSON.stringify({
    agents: {defaults: {workspace: path.join(output, "work")}},
    skills: {load: {extraDirs}},
  }, null, 2));
}
function run(args, json = true) {
  const result = spawnSync(process.execPath, [cli, ...args], {env, cwd: output, encoding: "utf8", windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  const log = path.join(output, String(++command).padStart(2, "0"));
  fs.writeFileSync(log + ".stdout", result.stdout || "");
  fs.writeFileSync(log + ".stderr", result.stderr || "");
  assert.equal(result.error, undefined, "Client failed; see " + log);
  assert.equal(result.status, 0, "Client exited unsuccessfully; see " + log);
  return json ? JSON.parse(result.stdout) : result.stdout.trim();
}
function inventory(expected, source) {
  const found = run(["skills", "list", "--json"]).skills.filter(skill => names.includes(skill.name));
  assert.deepEqual(found.map(skill => skill.name).sort(), [...expected].sort());
  for (const skill of found) {
    for (const flag of ["eligible", "modelVisible", "commandVisible", "userInvocable"]) assert.equal(skill[flag], true, skill.name + ": " + flag);
    const info = run(["skills", "info", skill.name, "--json"]);
    assert.equal(info.eligible, true);
    assert.equal(fs.realpathSync(info.filePath), fs.realpathSync(path.join(info.baseDir, "SKILL.md")));
    if (source) assert.equal(fs.realpathSync(info.baseDir), fs.realpathSync(path.join(source, skill.name)));
    // Every installed file must match its independently installable source.
    function compare(relative = "") {
      for (const entry of fs.readdirSync(path.join(root, "skills", skill.name, relative), {withFileTypes: true})) {
        const child = path.join(relative, entry.name);
        if (entry.isDirectory()) compare(child);
        else assert.deepEqual(fs.readFileSync(path.join(info.baseDir, child)), fs.readFileSync(path.join(root, "skills", skill.name, child)), skill.name + ": " + child);
      }
    }
    compare();
  }
}
try {
configure([]);
const version = run(["--version"], false);
inventory([]);
for (const selected of [[names[0]], [names[1]], names]) {
  const directory = path.join(output, "skills-" + selected.join("+"));
  fs.mkdirSync(directory);
  for (const name of selected) fs.cpSync(path.join(root, "skills", name), path.join(directory, name), {recursive: true});
  configure([directory]);
  inventory(selected, directory);
  configure([]);
  inventory([]);
  checks.push({installation: "extraDirs", skills: selected, removed: true});
}
const bundle = path.join(output, "bundle");
for (const relative of ["plugin.json", "package.json", "LICENSE", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json", ".cursor-plugin/plugin.json", ".cursor/rules", "skills", "hooks/session.json", "hooks/session.js"]) {
  const destination = path.join(bundle, relative);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.cpSync(path.join(root, relative), destination, {recursive: true});
}
// Reviewed local fixture; these are the client's normal local-source/capability consents.
run(["plugins", "install", bundle, "--link", "--force", "--accept-capabilities"], false);
const plugin = run(["plugins", "list", "--json"]).plugins.find(item => item.id === names[0]);
assert.equal(plugin?.status, "loaded");
assert.equal(plugin.bundleFormat, "codex");
assert.equal(plugin.hookCount, 0); // Detection of foreign hooks does not mean execution.
inventory(names);
run(["plugins", "uninstall", names[0], "--force"], false);
assert.ok(!run(["plugins", "list", "--json"]).plugins.some(item => item.id === names[0]));
inventory([]);
assert.ok(fs.existsSync(path.join(bundle, "skills/commerce-review/SKILL.md")), "Unlink must retain fixture source");
checks.push({installation: "bundle-link", skills: names, removed: true, hostHooks: "not executed"});
fs.writeFileSync(path.join(output, "summary.json"), JSON.stringify({version, node: process.version, platform: process.platform, checks}, null, 2));
console.log(JSON.stringify({version, output, checks}, null, 2));
} catch (error) {
  console.error("OpenClaw discovery check failed. Evidence: " + output + "\n" + error.message);
  process.exitCode = 1;
}
