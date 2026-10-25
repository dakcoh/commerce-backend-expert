const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {spawnSync} = require("node:child_process");
const {performance} = require("node:perf_hooks");

const repository = path.resolve(__dirname, "..");
const manifest = fs.readFileSync(path.join(repository, "hooks/session.json"));
const hooks = JSON.parse(manifest).hooks;
const expression = hooks.SessionStart[0].hooks[0].command.match(/^node -e "(.+)"$/)?.[1];
assert.ok(expression, "Unexpected hook command format");
assert.equal(hooks.UserPromptSubmit[0].hooks[0].command, hooks.SessionStart[0].hooks[0].command);
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-hook-benchmark-"));
const work = path.join(fixture, "work"), state = path.join(fixture, "state");
fs.mkdirSync(work);
const env = {...process.env, PLUGIN_ROOT: repository, PLUGIN_DATA: state};
const records = [];
const cases = [
  {id: "startup", event: "SessionStart", prompt: undefined},
  {id: "ordinary", event: "UserPromptSubmit", prompt: "버튼 CSS 간격만 바꿔줘."},
  {id: "off", event: "UserPromptSubmit", prompt: "commerce off"},
];
for (let repeat = 1; repeat <= 30; repeat++) for (const item of cases) {
  for (const arm of repeat % 2 ? ["control", "hook"] : ["hook", "control"]) {
    const start = performance.now();
    const result = spawnSync(process.execPath, ["-e", arm === "hook" ? expression : "process.stdin.resume()"], {
      cwd: work, env, windowsHide: true, encoding: "utf8", timeout: 10000,
      input: JSON.stringify({hook_event_name: item.event, session_id: item.id + "-" + repeat, cwd: work, ...(item.prompt ? {prompt: item.prompt} : {})}),
    });
    const elapsedMs = performance.now() - start;
    assert.ifError(result.error); assert.equal(result.status, 0); assert.equal(result.stderr, "");
    if (arm === "control" || item.id === "ordinary") assert.equal(result.stdout, "");
    else {
      const output = JSON.parse(result.stdout).hookSpecificOutput;
      assert.equal(output.hookEventName, item.event);
      assert.ok(output.additionalContext.includes(item.id === "off" ? "COMMERCE MODE OFF" : "COMMERCE MODE ON"));
    }
    records.push({id: item.id, repeat, arm, elapsedMs, stdoutBytes: Buffer.byteLength(result.stdout)});
  }
}
const states = fs.readdirSync(path.join(state, "sessions"));
assert.equal(states.length, 30);
for (const file of states) assert.deepEqual(JSON.parse(fs.readFileSync(path.join(state, "sessions", file))), {enabled: false});
const quantile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return p === 0.5 && sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.ceil(sorted.length * p) - 1];
};
assert.equal(quantile([2, 1], 0.5), 1.5);
assert.equal(quantile([1, 2], 0.95), 2);
const summary = cases.map(item => ({id: item.id, arms: Object.fromEntries(["control", "hook"].map(arm => {
  const samples = records.filter(record => record.id === item.id && record.arm === arm);
  return [arm, {runs: samples.length, p50Ms: quantile(samples.map(record => record.elapsedMs), 0.5), p95Ms: quantile(samples.map(record => record.elapsedMs), 0.95), stdoutBytes: [...new Set(samples.map(record => record.stdoutBytes))]}];
}))}));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const record = {recordedAt: new Date().toISOString(), node: process.version, platform: process.platform, arch: process.arch,
  cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(),
  hookSha256: hash(fs.readFileSync(path.join(repository, "hooks/session.js"))), manifestSha256: hash(manifest),
  scope: "Cold child-process wall time for the exact registered Node hook command versus empty Node stdin handling. No client dispatch, model call, RSS or invoice measurement. Unique fixture sessions and state only.",
  modelCalls: 0, normalSettingsChanged: false, summary, records};
fs.mkdirSync(path.join(repository, "output"), {recursive: true});
const output = fs.mkdtempSync(path.join(repository, "output/hook-performance-"));
fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify({output, summary}));
