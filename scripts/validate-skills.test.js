const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const {parseRule, validateRules, validateLinks, validateSkill, validateRepository, compareBaseline} = require("./validate-skills");
const {validateEdit} = require("../hooks/validate-knowledge");

const root = path.resolve(__dirname, "../skills/commerce-backend-expert");
const loaded = validateSkill();
const copyRules = () => structuredClone(loaded.rules);
const payment = rules => rules.find(rule => rule.id === "payment-idempotency");

function temporaryDirectory(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(parent, "commerce-skill-test-"));
  t.after(() => {
    assert.equal(path.dirname(dir), parent); assert.ok(path.basename(dir).startsWith("commerce-skill-test-"));
    assert.ok(!fs.lstatSync(dir).isSymbolicLink()); fs.rmSync(dir, {recursive: true, force: true});
  });
  return dir;
}

function copySkill(destination) {
  fs.mkdirSync(destination, {recursive: true});
  fs.copyFileSync(path.join(root, "SKILL.md"), path.join(destination, "SKILL.md"));
  for (const domain of new Set(loaded.rules.map(rule => rule.domain))) {
    const relative = path.join("references", domain);
    fs.mkdirSync(path.join(destination, relative), {recursive: true});
    for (const name of fs.readdirSync(path.join(root, relative))) fs.copyFileSync(path.join(root, relative, name), path.join(destination, relative, name));
  }
}

function repositoryFixture(t) {
  const destination = path.join(temporaryDirectory(t), "repository");
  copySkill(path.join(destination, "skills/commerce-backend-expert"));
  for (const relative of ["README.md", "README.ko.md", "CONTRIBUTING.md", "CONTRIBUTING.ko.md", "LICENSE", "tests/behavior-cases.md", "package.json", "plugin.json", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json", ".cursor-plugin/plugin.json", ".cursor/rules/commerce-backend.mdc", ".openclaw/skills.example.json", "hooks/claude.json", "hooks/cursor.json"]) {
    fs.mkdirSync(path.dirname(path.join(destination, relative)), {recursive: true});
    fs.copyFileSync(path.join(root, "../..", relative), path.join(destination, relative));
  }
  return destination;
}

test("catalog retains 70 unique rules, six indexes, and resolved references", () => {
  assert.equal(loaded.rules.length, 70); assert.equal(new Set(loaded.rules.map(rule => rule.id)).size, 70);
  assert.equal(loaded.indexes, 6); assert.equal(loaded.files, 77);
  assert.ok(loaded.rules.some(rule => rule.relatedRuleIds.length));
});

test("baseline comparison catches lost conditions and changes to individual evidence fields", () => {
  const baseline = {rules: loaded.rules};
  for (const mutate of [
    rules => payment(rules).applicability.assumptions.pop(),
    rules => rules.find(rule => rule.applicability.doesNotApplyWhen.length).applicability.doesNotApplyWhen.pop(),
    rules => rules.find(rule => rule.evidenceLevel === "external-source").evidence[0].note = "altered scope",
    rules => payment(rules).sections.guidance.reverse(),
  ]) {
    const rules = copyRules(); mutate(rules); assert.throws(() => compareBaseline(rules, baseline), /differs from baseline/);
  }
});

test("required applicability, duplicate IDs, evidence and related references cannot disappear silently", () => {
  for (const mutate of [
    rules => rules[1].id = rules[0].id,
    rules => rules[0].applicability.appliesWhen = [],
    rules => rules[0].evidence = [],
    rules => rules[0].relatedRuleIds.push("missing-rule"),
  ]) {
    const rules = copyRules(); mutate(rules); assert.throws(() => validateRules(rules));
  }
});

test("review metadata does not turn unreviewed high-risk guidance into an active rule", () => {
  const rules = copyRules(); payment(rules).status = "active";
  assert.throws(() => validateRules(rules), /unreviewed high risk/);
  payment(rules).verifiedBy = "named-reviewer";
  assert.throws(() => validateRules(rules), /incomplete review/);
});

test("evidence dates must be real ISO dates and cannot be in the future", () => {
  for (const value of ["2026-02-30", "2026-13-01", "2027-01-01", "2026,10,21"]) {
    const rules = copyRules(); rules[0].evidence[0].accessedAt = value;
    assert.throws(() => validateRules(rules, "2026-10-22"));
  }
});

test("external evidence requires a safe URL, access date and consistent evidence level", () => {
  for (const mutate of [
    evidence => evidence.accessedAt = null,
    evidence => evidence.source = "javascript:alert(1)",
    evidence => evidence.source = "https://user:password@example.com/docs",
  ]) {
    const rules = copyRules(), rule = rules.find(item => item.evidenceLevel === "external-source");
    mutate(rule.evidence[0]); assert.throws(() => validateRules(rules));
  }
  const rules = copyRules(); payment(rules).evidenceLevel = "project-guidance";
  assert.throws(() => validateRules(rules), /inconsistent evidence level/);
});

test("Markdown parser rejects duplicate metadata and sections instead of overwriting them", () => {
  const source = fs.readFileSync(path.join(root, "references/payment/payment-idempotency.md"), "utf8");
  assert.throws(() => parseRule(source.replace("- domain: payment", "- domain: payment\n- domain: payment")), /Duplicate metadata/);
  assert.throws(() => parseRule(source + "\n## 적용 조건\n\n- replaced\n"), /Duplicate heading/);
});

test("Markdown parser preserves multiline items and ignores code-fenced headings", () => {
  const source = fs.readFileSync(path.join(root, "references/payment/payment-idempotency.md"), "utf8");
  const changed = source.replace("## 적용 조건\n\n", "## 적용 조건\n\n- first\n  continued\n");
  assert.equal(parseRule(changed).applicability.appliesWhen[0], "first\ncontinued");
  const fenced = source + "\n\n## 업무 맥락\n\n```java\n## not-a-section\n```\n";
  assert.equal(parseRule(fenced).content, "```java\n## not-a-section\n```");
});

test("packaged Markdown validates in isolation with no Java or npm on PATH", t => {
  const dir = temporaryDirectory(t), isolated = path.join(dir, "skill");
  copySkill(isolated);
  const code = "require(process.argv[1]).validateSkill(process.argv[2])";
  const result = spawnSync(process.execPath, ["-e", code, path.join(__dirname, "validate-skills.js"), isolated], {
    cwd: dir, env: {...process.env, PATH: "", JAVA_HOME: path.join(dir, "no-java")}, encoding: "utf8", windowsHide: true, timeout: 10000,
  });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  const index = path.join(isolated, "references/payment/INDEX.md");
  fs.writeFileSync(index, fs.readFileSync(index, "utf8").replace(/\]\(payment-idempotency\.md\)/, "](missing.md)"));
  assert.throws(() => validateSkill(isolated), /index\/rules mismatch/);
});

test("local links cannot escape the distributed skill folder", t => {
  const dir = temporaryDirectory(t), isolated = path.join(dir, "skill"); fs.mkdirSync(isolated);
  const file = path.join(isolated, "SKILL.md"); fs.writeFileSync(file, "[outside](../outside.md)\n");
  fs.writeFileSync(path.join(dir, "outside.md"), "outside");
  assert.throws(() => validateLinks(file, isolated), /escapes skill/);
  fs.writeFileSync(file, "[unsafe](javascript:alert)\n");
  assert.throws(() => validateLinks(file, isolated), /Unsafe link/);
});

test("document anchors resolve Unicode, duplicate headings and fenced examples", t => {
  const dir = temporaryDirectory(t), file = path.join(dir, "guide.md");
  fs.writeFileSync(file, "# 검증\n\n## 검증\n\n```md\n## hidden\n```\n\n[one](#검증) [two](#검증-1)\n");
  assert.equal(validateLinks(file, dir), 2);
  fs.appendFileSync(file, "[hidden](#hidden)\n");
  assert.throws(() => validateLinks(file, dir), /Missing anchor/);
});

test("repository rejects retired runtime paths and broken user documentation", t => {
  const isolated = repositoryFixture(t);
  assert.equal(validateRepository(isolated).rules.length, 70);
  for (const relative of ["src", "npm", "build.gradle.kts", ".mcp.json"]) {
    const file = path.join(isolated, relative); fs.writeFileSync(file, "legacy");
    assert.throws(() => validateRepository(isolated), /Removed runtime path returned/); fs.unlinkSync(file);
  }
  fs.appendFileSync(path.join(isolated, "README.md"), "\n[missing](missing.md)\n");
  assert.throws(() => validateRepository(isolated), /ENOENT/);
});

test("clients share one skill and cannot silently re-enable hooks or YAML knowledge", t => {
  const isolated = repositoryFixture(t), file = path.join(isolated, ".cursor-plugin/plugin.json");
  const original = fs.readFileSync(file, "utf8"), manifest = JSON.parse(original);
  manifest.skills = "./copied-skills/"; fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => validateRepository(isolated), /canonical skills/);
  manifest.skills = "./skills/"; manifest.hooks = "./hooks/cursor.json"; fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => validateRepository(isolated), /must not run by default/);
  fs.writeFileSync(file, original);
  fs.writeFileSync(path.join(isolated, "skills/commerce-backend-expert/references/payment/extra.yml"), "rules: []");
  assert.throws(() => validateRepository(isolated), /only Markdown knowledge/);
});

test("optional edit hook validates its own knowledge and ignores other project files", () => {
  assert.deepEqual(validateEdit(null), {checked: false});
  assert.deepEqual(validateEdit({file_path: "relative.md"}), {checked: false});
  assert.deepEqual(validateEdit({file_path: path.resolve(root, "../../customer-service.java")}), {checked: false});
  assert.deepEqual(validateEdit({tool_input: {file_path: path.join(root, "references/payment/partial-refund.md")}}), {checked: true, rules: 70});
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

test("developer scripts and hooks work inside an ES module host project", t => {
  const isolated = repositoryFixture(t);
  for (const relative of ["scripts/validate-skills.js", "hooks/validate-knowledge.js"]) {
    fs.mkdirSync(path.dirname(path.join(isolated, relative)), {recursive: true});
    fs.copyFileSync(path.resolve(__dirname, "..", relative), path.join(isolated, relative));
  }
  fs.writeFileSync(path.join(path.dirname(isolated), "package.json"), '{"type":"module"}');
  const validation = spawnSync(process.execPath, [path.join(isolated, "scripts/validate-skills.js")], {cwd: isolated, encoding: "utf8", windowsHide: true, timeout: 10000});
  assert.ifError(validation.error); assert.equal(validation.status, 0, validation.stderr);
  const hook = spawnSync(process.execPath, [path.join(isolated, "hooks/validate-knowledge.js")], {cwd: isolated, input: JSON.stringify({file_path: path.join(isolated, "skills/commerce-backend-expert/SKILL.md")}), encoding: "utf8", windowsHide: true, timeout: 10000});
  assert.ifError(hook.error); assert.equal(hook.status, 0, hook.stderr); assert.equal(hook.stdout, "");
});
