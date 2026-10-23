const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const {validateFrontmatter, validateLinks, validateSkill} = require("../scripts/validate-skills");
const {skillRoot: root, repositoryRoot, temporaryDirectory, copySkill} = require("./helpers");

test("packaged Markdown validates in isolation with no Java or npm on PATH", t => {
  const dir = temporaryDirectory(t), isolated = path.join(dir, "skill");
  copySkill(isolated);
  const code = "require(process.argv[1]).validateSkill(process.argv[2])";
  const result = spawnSync(process.execPath, ["-e", code, path.join(repositoryRoot, "scripts/validate-skills.js"), isolated], {
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

test("each skill is usable when an installer copies only its selected directory", t => {
  for (const name of ["commerce-backend-expert", "commerce-review"]) {
    const destination = path.join(temporaryDirectory(t), name);
    fs.cpSync(path.resolve(root, "..", name), destination, {recursive: true});
    validateFrontmatter(fs.readFileSync(path.join(destination, "SKILL.md"), "utf8"), name);
    validateLinks(path.join(destination, "SKILL.md"), destination);
    assert.equal(fs.readFileSync(path.join(destination, "LICENSE"), "utf8"), fs.readFileSync(path.resolve(root, "../../LICENSE"), "utf8"));
    if (name === "commerce-backend-expert") assert.equal(validateSkill(destination).rules.length, 70);
  }
});

test("skill YAML accepts standard optional metadata and folded descriptions", () => {
  const fields = validateFrontmatter('---\nlicense: MIT\nmetadata:\n  author: dakcoh\n  tags: payments, refunds\ncompatibility: Markdown reader\nname: commerce-review\ndescription: >\n  Review payment\n  and refund code.\nallowed-tools: Read\n---\n# Review\n', "commerce-review");
  assert.equal(fields.description, "Review payment and refund code.\n");
  assert.deepEqual(fields.metadata, {author: "dakcoh", tags: "payments, refunds"});
});

test("skill YAML rejects invalid types, malformed documents, duplicate keys and wrong names", () => {
  for (const source of [
    'name: commerce-review\ndescription: [payment, refund]',
    'name: commerce-review\ndescription: null',
    'name: commerce-review\ndescription: "unfinished',
    'name: commerce-review\ndescription: first\ndescription: second',
    'name: commerce-review\ndescription: "   "',
    'name: commerce-review\ndescription: ' + 'a'.repeat(1025),
    'name: other\ndescription: Review payments',
    'name: commerce-review\ndescription: Review payments\nmetadata:\n  tags: [payment, refund]',
    '- commerce-review\n- Review payments',
  ]) assert.throws(() => validateFrontmatter('---\n' + source + '\n---\n', "commerce-review"));
});
