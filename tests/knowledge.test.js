const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {parseRule, validateRules, validateSkill, compareBaseline} = require("../scripts/validate-skills");
const {skillRoot: root} = require("./helpers");
const loaded = validateSkill();
const copyRules = () => structuredClone(loaded.rules);
const payment = rules => rules.find(rule => rule.id === "payment-idempotency");

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

test("applicability headings cannot disappear and assumptions cannot be emptied", () => {
  for (const [domain, id, heading] of [
    ["payment", "partial-refund", "전제"],
    ["coupon", "coupon-issuance-compensation", "적용하지 않는 조건"],
  ]) {
    const source = fs.readFileSync(path.join(root, "references", domain, id + ".md"), "utf8").replaceAll("\r\n", "\n");
    const start = source.indexOf("## " + heading + "\n"), end = source.indexOf("\n## ", start + 4);
    assert.ok(start >= 0 && end > start);
    assert.throws(() => parseRule(source.slice(0, start) + source.slice(end + 1)), new RegExp(`${id}: missing ${heading}`));
  }
  const rules = copyRules(); payment(rules).applicability.assumptions = [];
  assert.throws(() => validateRules(rules), /payment-idempotency: missing assumptions/);
  const unchanged = copyRules();
  assert.ok(unchanged.some(rule => !rule.applicability.doesNotApplyWhen.length));
  validateRules(unchanged);
});

test("each document format rejects deleted or empty core guidance", () => {
  const formats = {
    "partial-refund": ["guidance", "avoid-patterns"],
    "commerce-order-lifecycle": ["invariants", "workflow", "technical-guidance", "failure-scenarios"],
    "spring-commerce-transaction-boundary": ["spring-guidance", "avoid-patterns"],
  };
  for (const [id, sections] of Object.entries(formats)) {
    for (const section of sections) for (const value of [undefined, []]) {
      const rules = copyRules(), rule = rules.find(item => item.id === id);
      if (value === undefined) delete rule.sections[section];
      else rule.sections[section] = value;
      assert.throws(() => validateRules(rules), new RegExp(`${id}: missing ${section}`));
    }
    if (id === "partial-refund") continue;
    const rules = copyRules(); rules.find(item => item.id === id).content = "";
    assert.throws(() => validateRules(rules), new RegExp(`${id}: missing content`));
  }
  const checklists = copyRules().filter(rule => rule.category === "checklist");
  assert.equal(checklists.length, 4);
  assert.ok(checklists.every(rule => !rule.content && !Object.keys(rule.sections).length));
  validateRules(checklists);
});

test("review metadata does not turn unreviewed high-risk guidance into an active rule", () => {
  const rules = copyRules(); payment(rules).status = "active";
  assert.throws(() => validateRules(rules), /unreviewed high risk/);
  payment(rules).verifiedBy = "named-reviewer";
  assert.throws(() => validateRules(rules), /incomplete review/);
});

test("evidence dates must be real ISO dates and cannot be in the future", () => {
  const today = new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Seoul"}).format(new Date());
  const tomorrow = new Date(today + "T00:00:00Z"); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  validateRules(copyRules(), today);
  for (const value of ["2026-02-30", "2026-13-01", tomorrow.toISOString().slice(0, 10), "2026,10,21"]) {
    const rules = copyRules(); rules[0].evidence[0].accessedAt = value;
    assert.throws(() => validateRules(rules, today));
  }
});

test("external evidence requires a safe URL, access date and consistent evidence level", () => {
  for (const mutate of [
    evidence => evidence.accessedAt = null,
    evidence => evidence.source = "javascript:alert(1)",
    evidence => evidence.source = "https://user:password@example.com/docs",
  ]) {
    const rules = copyRules(), rule = rules.find(item => item.evidenceLevel === "external-source");
    mutate(rule.evidence.find(evidence => /^https?:/.test(evidence.source))); assert.throws(() => validateRules(rules));
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

test("omitting a repeated rationale preserves all parsed knowledge fields", () => {
  for (const id of ["partial-refund", "commerce-order-lifecycle"]) {
    const rule = loaded.rules.find(item => item.id === id);
    const file = path.join(root, "references", rule.domain, id + ".md");
    const source = fs.readFileSync(file, "utf8");
    const repeated = source.replace("## 적용 조건", "## 판단 근거\n\n" + rule.rationale + "\n\n## 적용 조건");
    assert.deepEqual(parseRule(source), parseRule(repeated));
  }
});
