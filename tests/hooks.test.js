const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {spawn, spawnSync} = require("node:child_process");
const {handleEvent} = require("../hooks/session");
const {validateEdit} = require("../hooks/validate-knowledge");
const {validateRepository} = require("../scripts/validate-skills");
const {skillRoot: root, repositoryFixture, temporaryDirectory} = require("./helpers");

function fixture(t) {
  const dataRoot = temporaryDirectory(t);
  const cwd = path.resolve(dataRoot, "project");
  const start = {hook_event_name: "SessionStart", session_id: "session-a", cwd, source: "startup"};
  const run = event => handleEvent({...start, ...event}, {dataRoot});
  const prompt = (text, extra = {}) => run({hook_event_name: "UserPromptSubmit", prompt: text, ...extra});
  return {dataRoot, cwd, run, prompt};
}
const context = result => result.hookSpecificOutput.additionalContext;

test("startup emits bounded skill routing without loading the rule catalog or writing state", t => {
  const f = fixture(t), result = f.run({});
  assert.equal(result.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(context(result), /COMMERCE MODE ON/);
  assert.match(context(result), /commerce-review/);
  assert.ok(Buffer.byteLength(context(result)) < 2048);
  assert.doesNotMatch(context(result), /## 구현 가이드|id: partial-refund/);
  assert.deepEqual(fs.readdirSync(f.dataRoot), []);
});

test("explicit off survives resume and compaction, while other sessions and projects stay on", t => {
  const f = fixture(t);
  assert.match(context(f.prompt("commerce off")), /COMMERCE MODE OFF/);
  for (const source of ["resume", "compact"]) assert.match(context(f.run({source})), /COMMERCE MODE OFF/);
  assert.match(context(f.run({session_id: "session-b"})), /COMMERCE MODE ON/);
  assert.match(context(f.run({cwd: path.resolve(f.dataRoot, "other")})), /COMMERCE MODE ON/);
  assert.match(context(f.prompt("commerce status")), /COMMERCE MODE OFF/);
  assert.match(context(f.prompt("commerce on")), /COMMERCE MODE ON/);
  assert.match(context(f.run({source: "compact"})), /COMMERCE MODE ON/);
});

test("ordinary, quoted and negated prompts do not switch mode or repeat context", t => {
  const f = fixture(t);
  for (const prompt of ["결제 웹훅을 리뷰해줘", "CSS padding 수정", "예시: commerce off", "commerce off 하지 마", "```\ncommerce off\n```", "a\ncommerce off"]) {
    assert.equal(f.prompt(prompt), null);
  }
  assert.match(context(f.run({})), /COMMERCE MODE ON/);
  assert.equal(f.run({hook_event_name: "Stop"}), null);
});

test("state stores only a boolean and session identifiers cannot escape its directory", t => {
  const f = fixture(t);
  f.prompt("commerce off", {session_id: "../../private/session", transcript_path: "PRIVATE_TRANSCRIPT"});
  const files = fs.readdirSync(path.join(f.dataRoot, "sessions"));
  assert.equal(files.length, 1); assert.match(files[0], /^[a-f0-9]{64}\.json$/);
  assert.equal(fs.readFileSync(path.join(f.dataRoot, "sessions", files[0]), "utf8"), '{"enabled":false}');
  assert.throws(() => f.run({session_id: ""}), /session identity/);
  assert.throws(() => f.run({cwd: "relative"}), /session identity/);
  assert.throws(() => handleEvent({hook_event_name: "SessionStart", session_id: "a", cwd: f.cwd}, {dataRoot: "relative"}), /state directory/);
});

test("CLI releases an unfinished input stream before the client hook deadline", {timeout: 6000}, async t => {
  const f = fixture(t), script = path.resolve(__dirname, "../hooks/session.js");
  const child = spawn(process.execPath, [script], {windowsHide: true, env: {...process.env, PLUGIN_DATA: f.dataRoot}});
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  child.stdin.on("error", () => {});
  child.stdin.write('{"PRIVATE_INCOMPLETE_INPUT":');
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  assert.equal(code, 0); assert.equal(stdout, "");
  assert.match(stderr, /hook skipped/); assert.doesNotMatch(stderr, /PRIVATE_INCOMPLETE_INPUT/);
});

test("corrupt state never silently re-enables a disabled session", t => {
  const f = fixture(t); f.prompt("commerce off");
  const directory = path.join(f.dataRoot, "sessions"), file = path.join(directory, fs.readdirSync(directory)[0]);
  fs.writeFileSync(file, '{"enabled":"false"}');
  assert.throws(() => f.run({source: "compact"}), /Invalid session state/);
});

test("CLI produces one hook output, stays quiet for unrelated prompts and fails open without echoing payloads", t => {
  const f = fixture(t), script = path.resolve(__dirname, "../hooks/session.js");
  const run = input => spawnSync(process.execPath, [script], {
    input, encoding: "utf8", windowsHide: true, timeout: 5000, env: {...process.env, PLUGIN_DATA: f.dataRoot},
  });
  const event = {hook_event_name: "SessionStart", session_id: "cli", cwd: f.cwd};
  const started = run(JSON.stringify(event));
  assert.ifError(started.error); assert.equal(started.status, 0); assert.equal(started.stderr, "");
  assert.equal(started.stdout.trim().split("\n").length, 1); assert.match(context(JSON.parse(started.stdout)), /COMMERCE MODE ON/);
  const quiet = run(JSON.stringify({...event, hook_event_name: "UserPromptSubmit", prompt: "버튼 스타일 수정"}));
  assert.equal(quiet.status, 0); assert.equal(quiet.stdout, ""); assert.equal(quiet.stderr, "");
  for (const payload of ["PRIVATE_PAYLOAD", "x".repeat(65537)]) {
    const invalid = run(payload); assert.ifError(invalid.error); assert.equal(invalid.status, 0);
    assert.equal(invalid.stdout, ""); assert.match(invalid.stderr, /hook skipped/); assert.doesNotMatch(invalid.stderr, /PRIVATE_PAYLOAD/);
  }
});

test("repository validation and edit hook catch a removed refund guide", t => {
  const isolated = repositoryFixture(t);
  const file = path.join(isolated, "skills/commerce-backend-expert/references/payment/partial-refund.md");
  const source = fs.readFileSync(file, "utf8");
  const changed = source.replace(/## 구현 가이드\r?\n[\s\S]*?(?=## )/, "");
  assert.notEqual(changed, source);
  fs.writeFileSync(file, changed);
  assert.throws(() => validateRepository(isolated), /partial-refund: missing guidance/);
  assert.throws(() => validateEdit({file_path: file}, isolated), /partial-refund: missing guidance/);
  assert.equal(fs.readFileSync(file, "utf8"), changed);
});

test("optional edit hook validates its own knowledge and ignores other project files", () => {
  assert.deepEqual(validateEdit(null), {checked: false});
  assert.deepEqual(validateEdit({file_path: "relative.md"}), {checked: false});
  assert.deepEqual(validateEdit({file_path: path.resolve(root, "../../customer-service.java")}), {checked: false});
  assert.deepEqual(validateEdit({tool_input: {file_path: path.join(root, "references/payment/partial-refund.md")}}), {checked: true, rules: 70});
  assert.deepEqual(validateEdit({file_path: path.resolve(root, "../commerce-review/SKILL.md")}), {checked: true, rules: 70});
});

test("optional hook reports invalid knowledge without editing it", t => {
  const isolated = repositoryFixture(t), file = path.join(isolated, "skills/commerce-backend-expert/references/payment/partial-refund.md");
  const changed = fs.readFileSync(file, "utf8").replace("severity: high", "severity: invalid"); fs.writeFileSync(file, changed);
  assert.throws(() => validateEdit({file_path: file}, isolated));
  assert.equal(fs.readFileSync(file, "utf8"), changed);
});

test("hook CLI stays quiet, bounds input and does not echo malformed payloads", () => {
  const script = path.resolve(__dirname, "../hooks/validate-knowledge.js");
  const run = input => spawnSync(process.execPath, [script], {input, encoding: "utf8", windowsHide: true, timeout: 10000});
  const skipped = run("{}"); assert.ifError(skipped.error); assert.equal(skipped.status, 0); assert.equal(skipped.stdout, "");
  const ownEdit = run(JSON.stringify({file_path: path.join(root, "SKILL.md")}));
  assert.ifError(ownEdit.error); assert.equal(ownEdit.status, 0, ownEdit.stderr); assert.equal(ownEdit.stdout, "");
  const invalid = run("PRIVATE_PAYLOAD"); assert.ifError(invalid.error); assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Invalid hook JSON/); assert.doesNotMatch(invalid.stderr, /PRIVATE_PAYLOAD/);
  const large = run("x".repeat(65537)); assert.ifError(large.error); assert.equal(large.status, 1); assert.match(large.stderr, /exceeds 64 KiB/);
});
