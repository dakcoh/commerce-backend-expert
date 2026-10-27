const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {temporaryDirectory} = require("./helpers");
const {localEndpoint, assessReadProbe, assessEditProbe, isolatedSkillEntries} = require("../scripts/probe-openclaw-model");

test("native model probe rejects nonlocal, credential and compatibility endpoints", () => {
  assert.equal(localEndpoint("http://127.0.0.1:11434"), "http://127.0.0.1:11434");
  assert.equal(localEndpoint("http://[::1]:11434/"), "http://[::1]:11434");
  for (const url of ["https://example.com", "http://192.168.0.1:11434", "http://localhost:11434/v1", "http://key@localhost:11434", "http://localhost:11434/?key=x"]) assert.throws(() => localEndpoint(url));
});

test("native ok and tool-call JSON cannot pass a file-read probe", () => {
  const valid = {ok: true, toolSummary: {calls: 1, failures: 0, tools: ["read"]}, final: "hidden-marker"};
  assert.deepEqual(assessReadProbe(valid, "hidden-marker"), {nativeOk: true, readReportedWithoutError: true, exactOutput: true});
  const fake = {ok: true, final: '[{"function":{"name":"read","arguments":{"path":"marker.txt"}}}]'};
  assert.deepEqual(assessReadProbe(fake, "hidden-marker"), {nativeOk: true, readReportedWithoutError: false, exactOutput: false});
  assert.equal(assessReadProbe({...valid, toolSummary: {...valid.toolSummary, failures: 1}}, "hidden-marker").readReportedWithoutError, false);
  assert.equal(assessReadProbe({...valid, toolSummary: {...valid.toolSummary, calls: 2}}, "hidden-marker").readReportedWithoutError, true);
  const optionalMissing = assessReadProbe({...valid, final: "Optional file not found: marker.txt."}, "hidden-marker");
  assert.equal(optionalMissing.readReportedWithoutError, true);
  assert.equal(Object.values(optionalMissing).every(Boolean), false);
});

test("native probe disables discovered custodian skills as well as bundled skills", () => {
  assert.deepEqual(isolatedSkillEntries([{name: "github"}, {name: "commerce-review"}, {name: "weather"}], ["commerce-review"]), {
    github: {enabled: false}, "commerce-review": {enabled: true}, weather: {enabled: false},
  });
  assert.throws(() => isolatedSkillEntries([{name: "github"}], ["missing"]), /not discovered/);
});

test("native CSS edits preserve the actual file and require completed edits to allowed paths", () => {
  const file = path.join(os.tmpdir(), "css-probe", "index.html");
  const original = '<style>button { padding: 0; } .buttons { gap: 0; }</style>\r\n<script>buy()</script><!-- hidden-marker -->\r\n';
  const expected = original.replace("padding: 0", "padding: 12px").replace("gap: 0", "gap: 8px");
  const native = {ok: true, toolSummary: {calls: 3, failures: 0, tools: ["read", "edit"]}, final: "changed padding and gap"};
  const calls = ["read", "edit", "edit"].map(name => ({name, path: file, completed: true, isError: false}));
  const check = (actual, trace = calls, result = native) => assessEditProbe(result, expected, actual, trace, file);
  assert.equal(Object.values(check(expected)).every(Boolean), true);
  assert.equal(check(original).exactFile, false);
  assert.equal(check(expected.replace("<!-- hidden-marker -->", "")).exactFile, false);
  assert.equal(check(expected.replaceAll("\r\n", "\n")).exactFile, false);
  assert.equal(check(expected, [...calls.slice(0, 2), {...calls[2], path: path.join(path.dirname(file), "skills/expert/SKILL.md")}]).taskFileScope, false);
  assert.equal(check(expected, [...calls.slice(0, 2), {...calls[2], path: path.join(path.dirname(file), "AGENTS.md")}]).taskFileScope, false);
  assert.equal(check(expected, calls.slice(0, 2)).taskFileScope, false);
  assert.equal(check(expected, calls.map(call => ({...call, name: "read"}))).taskFileScope, false);
  assert.equal(check(expected, calls.map(call => ({...call, completed: false}))).taskFileScope, false);
  assert.equal(check(expected, calls, {...native, toolSummary: {...native.toolSummary, failures: 1}}).editReportedWithoutError, false);
  assert.equal(check(expected, calls, {...native, toolSummary: {...native.toolSummary, tools: ["read", "write"]}}).editReportedWithoutError, false);
});

for (const failure of ["native-result", "client-exit", "native-timeout", "nonzero-success"]) test(`failed control (${failure}) persists evidence and skips CSS inference`, async t => {
  const root = temporaryDirectory(t);
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(path.join(__dirname, "../scripts/probe-openclaw-model.js"), path.join(root, "scripts/probe.js"));
  const cli = path.join(root, "client.cjs");
  fs.writeFileSync(cli, `
    const fs = require('node:fs'), path = require('node:path');
    fs.appendFileSync(path.join(__dirname, 'calls.jsonl'), JSON.stringify(process.argv.slice(2)) + '\\n');
    const command = process.argv[2];
    if (command === 'agent' && ${failure === "client-exit"}) {
      console.error(JSON.stringify({path: path.join(process.cwd(), 'marker.txt')}));
      process.exit(2);
    }
    if (command === 'agent' && ${failure === "native-timeout"}) {
      console.log(JSON.stringify({ok: false, status: 'timeout', error: {message: path.join(process.cwd(), 'marker.txt')}}));
      process.exit(2);
    }
    if (command === 'agent' && ${failure === "nonzero-success"}) {
      console.log(JSON.stringify({ok: true, model: 'fixture-local', provider: 'ollama', final: fs.readFileSync(path.join(process.cwd(), 'marker.txt'), 'utf8'), toolSummary: {calls: 1, failures: 0, tools: ['read']}}));
      process.exit(2);
    }
    console.log(command === '--version' ? 'fixture-client' : JSON.stringify(command === 'skills'
      ? {skills: []} : {ok: false, model: 'fixture-local', provider: 'ollama', final: '', toolSummary: {calls: 0, failures: 0, tools: []}}));
  `);
  t.mock.method(os, "tmpdir", () => root);
  t.mock.method(globalThis, "fetch", async url => ({ok: true, json: async () => url.endsWith("/api/tags")
    ? {models: [{name: "fixture-local", digest: "fixture-digest"}]} : url.endsWith("/api/show") ? {capabilities: ["tools"]} : {version: "fixture-server"}}));
  t.mock.method(console, "log", () => {});
  const previousExitCode = process.exitCode;
  try {
    await require(path.join(root, "scripts/probe.js")).probe(cli, "http://127.0.0.1:11434", "fixture-local");
    assert.equal(process.exitCode, 1);
    const directory = path.join(root, "output", fs.readdirSync(path.join(root, "output"))[0]);
    const result = JSON.parse(fs.readFileSync(path.join(directory, "result.json"), "utf8"));
    assert.equal(result.trials.length, 1);
    assert.equal(result.trials[0].passed, false);
    assert.equal(result.skipped[0].id, "frontend-scope");
    if (failure === "client-exit") {
      assert.match(result.trials[0].error, /<fixture>/);
      assert.ok(!result.trials[0].error.includes("commerce-openclaw-"));
    }
    if (failure === "native-timeout") {
      assert.equal(result.trials[0].native.status, "timeout");
      assert.equal(result.trials[0].process.exitCode, 2);
      assert.match(result.trials[0].native.error.message, /<fixture>/);
    }
    if (failure === "nonzero-success") {
      assert.equal(result.trials[0].checks.exactOutput, true);
      assert.equal(result.trials[0].checks.nativeOk, true);
      assert.equal(result.trials[0].checks.processExitedSuccessfully, false);
    }
    const calls = fs.readFileSync(path.join(root, "calls.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
    assert.equal(calls.filter(args => args[0] === "agent").length, 1);
  } finally { process.exitCode = previousExitCode; }
});
