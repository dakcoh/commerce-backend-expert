const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");

// Capture the unauthenticated boundary, never count it as skill discovery.
assert.ok(process.argv[2] && process.argv[3], "Usage: node scripts/probe-cursor.js /path/to/packaged/node /path/to/index.js");
const binary = path.resolve(process.argv[2]), entry = path.resolve(process.argv[3]);
const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, "output"), {recursive: true});
const output = fs.mkdtempSync(path.join(root, "output/cursor-probe-"));
const env = {...process.env};
for (const key of Object.keys(env)) if (key.startsWith("CURSOR_")) delete env[key];
Object.assign(env, {CURSOR_CONFIG_DIR: path.join(output, "config"), CURSOR_DATA_DIR: path.join(output, "data"), NO_OPEN_BROWSER: "1"});
const work = path.join(output, "work"); fs.mkdirSync(work);
function run(label, args) {
  const result = spawnSync(binary, [entry, ...args], {cwd: work, env, encoding: "utf8", windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024});
  fs.writeFileSync(path.join(output, label + ".stdout"), result.stdout || "");
  fs.writeFileSync(path.join(output, label + ".stderr"), result.stderr || "");
  assert.ifError(result.error);
  return result;
}
function blocked(label, args) {
  const result = run(label, args);
  assert.notEqual(result.status, 0, "Unexpected authentication; this probe must not use an account");
  assert.match(result.stderr, /Authentication required/i, "Unexpected failure; inspect probe evidence");
}
const version = run("version", ["--version"]); assert.equal(version.status, 0);
blocked("marketplace", ["plugin", "marketplace", "list", "--format", "json"]);
const checks = [];
for (const selected of [["commerce-backend-expert"], ["commerce-review"], ["commerce-backend-expert", "commerce-review"]]) {
  const fixture = path.join(output, selected.join("+"));
  for (const relative of ["LICENSE", ".cursor-plugin/plugin.json", ".cursor/rules"]) {
    const destination = path.join(fixture, relative); fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.cpSync(path.join(root, relative), destination, {recursive: true});
  }
  for (const name of selected) fs.cpSync(path.join(root, "skills", name), path.join(fixture, "skills", name), {recursive: true});
  blocked(selected.join("+"), ["--print", "--mode", "ask", "--workspace", work, "--plugin-dir", fixture, "List locally available commerce skills without editing files."]);
  checks.push({skills: selected, result: "authentication-required", discoveryVerified: false});
}
const summary = {version: version.stdout.trim(), platform: process.platform, checks, discoveryVerified: false, modelApplicationVerified: false};
fs.writeFileSync(path.join(output, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({output, ...summary}, null, 2));
