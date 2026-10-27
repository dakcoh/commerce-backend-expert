const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {temporaryDirectory} = require("./helpers");
const {readFixture, comparisonSchedule, summarizeMeasurements, selectCases, snapshotSources, taskInstructions, unavailableCall} = require("../scripts/evaluate-behavior");

test("evaluation reader bounds real paths and file sizes before returning contents", t => {
  const directory = temporaryDirectory(t);
  const inside = path.join(directory, "work"); fs.mkdirSync(inside);
  fs.writeFileSync(path.join(inside, "input.txt"), "synthetic");
  fs.writeFileSync(path.join(directory, "outside.txt"), "PRIVATE");
  const roots = [{path: inside, label: "workspace"}];
  assert.deepEqual(readFixture("input.txt", inside, roots), {
    text: "synthetic", path: "workspace/input.txt",
    sha256: require("node:crypto").createHash("sha256").update("synthetic").digest("hex"),
  });
  assert.throws(() => readFixture("../outside.txt", inside, roots), /outside evaluation/);
  fs.mkdirSync(path.join(inside, "subdir"));
  assert.throws(() => readFixture("subdir", inside, roots), /evaluation limit/);
  fs.writeFileSync(path.join(inside, "large.txt"), "x".repeat(65537));
  assert.throws(() => readFixture("large.txt", inside, roots), /evaluation limit/);
  const link = path.join(inside, "escape");
  fs.symlinkSync(directory, link, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => readFixture("escape/outside.txt", inside, roots), /outside evaluation/);
});

test("comparison pairs each case and repetition and counterbalances arm order", () => {
  const jobs = comparisonSchedule([{id: "a"}, {id: "b"}], 3);
  assert.equal(jobs.length, 12);
  for (const id of ["a", "b"]) for (const repeat of [1, 2, 3]) {
    assert.deepEqual(jobs.filter(item => item.id === id && item.repeat === repeat).map(item => item.arm).sort(), ["baseline", "skill"]);
  }
  assert.deepEqual(jobs.slice(0, 4).map(item => item.arm), ["baseline", "skill", "skill", "baseline"]);
  assert.deepEqual(jobs.slice(4, 6).map(item => item.arm), ["skill", "baseline"]);
  assert.throws(() => comparisonSchedule([], 0));
  assert.throws(() => comparisonSchedule([], 6));
  assert.throws(() => comparisonSchedule([], 1, 2));
  const first = comparisonSchedule([{id: "pilot"}], 1);
  const rest = comparisonSchedule(Array.from({length: 11}, (_, i) => ({id: String(i)})), 1, 1);
  const firstArms = [...first.filter((_,i)=>i%2===0), ...rest.filter((_,i)=>i%2===0)].map(item => item.arm);
  assert.equal(firstArms.filter(arm=>arm==="baseline").length, 6);
  assert.equal(firstArms.filter(arm=>arm==="skill").length, 6);
});

test("follow-up cases run only when selected and unknown IDs cannot trigger model calls", () => {
  const cases = [{id: "main"}, {id: "followup", default: false}];
  assert.deepEqual(selectCases(cases, []), [cases[0]]);
  assert.deepEqual(selectCases(cases, ["followup"]), [cases[1]]);
  assert.throws(() => selectCases(cases, ["typo"]), /Unknown evaluation case/);
});

test("public case defaults keep the eight-case request budget and match complete frozen criteria", () => {
  const root = path.resolve(__dirname, ".."), cases = JSON.parse(fs.readFileSync(path.join(root, "benchmarks/cases.json"))), rubric = JSON.parse(fs.readFileSync(path.join(root, "benchmarks/rubric.json")));
  assert.equal(new Set(cases.map(item => item.id)).size, cases.length);
  assert.deepEqual(selectCases(cases, []).map(item => item.id).sort(), ["refund-overlap", "webhook-async", "webhook-sync", "lock-watchdog", "payment-uncertain", "coupon-redelivery", "retry-rollback-only", "frontend-scope"].sort());
  assert.deepEqual(Object.keys(rubric.cases).sort(), cases.map(item => item.id).sort());
  assert.ok(rubric.criticalErrorGate.length >= 5 && rubric.criticalErrorGate.every(item => typeof item === "string" && item.trim()));
  for (const item of cases) {
    assert.equal(rubric.cases[item.id].length, 4);
    assert.ok(item.prompt.trim());
    assert.ok(["commerce-backend-expert", "commerce-review"].includes(item.skill));
    const fixtures = fs.realpathSync(path.join(root, "benchmarks/fixtures"));
    for (const file of item.files) assert.ok(Buffer.byteLength(readFixture(file, fixtures, [{path: fixtures, label: "fixtures"}]).text) > 0);
  }
});

test("refund contrast fixtures distinguish a real overlap from a valid reserved-state request", () => {
  const unsafe = require("../benchmarks/fixtures/refund"), safe = require("../benchmarks/fixtures/refund-safe");
  const unsafeRows = structuredClone(unsafe.refunds);
  assert.equal(unsafe.createRefund(unsafe.payment, unsafeRows, unsafe.request).status, "REQUESTED");
  const rows = structuredClone(safe.refunds), original = rows[0];
  assert.throws(() => safe.createRefund(safe.payment, rows, unsafe.request), /UNIT_RESERVED/);
  const created = safe.createRefund(safe.payment, rows, safe.request);
  assert.equal(created.status, "REQUESTED");
  assert.equal(original.status, "UNKNOWN");
  assert.equal(safe.createRefund(safe.payment, rows, safe.request), created);
  assert.throws(() => safe.createRefund(safe.payment, rows, {...safe.request, units: ["Y-1"]}), /KEY_CONFLICT/);
  assert.throws(() => safe.createRefund(safe.payment, rows, {...safe.request, key: "other"}), /UNIT_RESERVED/);
  assert.throws(() => safe.createRefund({...safe.payment, paid: 10000}, structuredClone(safe.refunds), safe.request), /REFUND_LIMIT/);
  assert.throws(() => safe.createRefund(safe.payment, rows, {key: "bad", units: ["Y-1", "Y-1"], amount: 13340}), /INVALID_REQUEST/);
});

test("variant comparisons freeze both skill sources, fixtures and rubric before inference", t => {
  const dir = temporaryDirectory(t), current = path.join(dir, "current"), original = path.join(dir, "original"), fixture = path.join(dir, "fixture");
  for (const [root, text] of [[current, "candidate"], [original, "original"]]) {
    fs.mkdirSync(path.join(root, "skills/example"), {recursive: true});
    fs.writeFileSync(path.join(root, "skills/example/SKILL.md"), text);
  }
  fs.mkdirSync(path.join(current, "benchmarks/fixtures"), {recursive: true});
  for (const name of ["cases.json", "rubric.json"]) fs.writeFileSync(path.join(current, "benchmarks", name), "{}");
  fs.writeFileSync(path.join(current, "benchmarks/fixtures/input.txt"), "frozen input");
  const roots = snapshotSources(current, fixture, [{skill: "example"}], original);
  fs.writeFileSync(path.join(current, "skills/example/SKILL.md"), "changed later");
  fs.writeFileSync(path.join(original, "skills/example/SKILL.md"), "changed later");
  fs.writeFileSync(path.join(current, "benchmarks/rubric.json"), "changed later");
  assert.equal(fs.readFileSync(path.join(roots.skill, "skills/example/SKILL.md"), "utf8"), "candidate");
  assert.equal(fs.readFileSync(path.join(roots.baseline, "skills/example/SKILL.md"), "utf8"), "original");
  assert.equal(fs.readFileSync(path.join(roots.skill, "rubric.json"), "utf8"), "{}");
  assert.equal(fs.readFileSync(path.join(roots.skill, "fixtures/input.txt"), "utf8"), "frozen input");
  assert.equal(snapshotSources(current, path.join(dir, "no-skill-control"), [{skill: "example"}]).baseline, null);
});

test("task resource inventory is identical across variants and explicitly includes an empty workspace", () => {
  const common = taskInstructions("/fixture", ["refund.js"], null, null);
  assert.ok(common.includes('["refund.js"]'));
  assert.ok(taskInstructions("/fixture", [], null, null).includes('[]'));
  for (const text of ["original", "candidate"]) {
    const instructions = taskInstructions("/fixture", ["refund.js"], {text}, "/skill");
    assert.ok(instructions.startsWith(text));
    assert.ok(instructions.endsWith(common));
  }
});

test("rejected calls stop at eight without unbounded logs or repeated post-abort counting", () => {
  const record = {blockedReads: 0, failedCallSamples: []};
  const call = {id: 0, params: {tool: "read_file", arguments: {}}};
  for (let i=1; i<=8; i++) assert.equal(unavailableCall(record, call, {path: "x".repeat(800)}, Error("x".repeat(500))), i===8);
  assert.equal(record.budgetAborted, true);
  assert.equal(record.failedCallSamples.length, 8);
  assert.equal(record.failedCallSamples[0].path.length, 512);
  assert.equal(record.failedCallSamples[0].error.length, 240);
  assert.equal(unavailableCall(record, call, {}, Error("again")), true);
  assert.equal(record.blockedReads, 8);
});

test("measurement summaries exclude failed runs and preserve missing token data", () => {
  const records = [
    {arm: "baseline", status: "completed", turnElapsedMs: 100, reads: [], tokenUsage: {total: {inputTokens: 20, cachedInputTokens: 8, outputTokens: 5}}},
    {arm: "baseline", status: "completed", turnElapsedMs: 300, reads: [{}], tokenUsage: {total: {inputTokens: 40, cachedInputTokens: 25, outputTokens: 9}}},
    {arm: "baseline", status: "failed", turnElapsedMs: 999, reads: []},
    {arm: "skill", status: "completed", clientError: "contaminated", turnElapsedMs: 999, reads: []},
    {arm: "skill", status: "completed", turnElapsedMs: 500, reads: []},
  ];
  const result = summarizeMeasurements(records);
  assert.equal(result.baseline.attempted, 3);
  assert.equal(result.baseline.completed, 2);
  assert.equal(result.baseline.medianTurnMs, 200);
  assert.equal(result.baseline.medianInputTokens, 30);
  assert.equal(result.baseline.totalInputTokens, 60);
  assert.equal(result.baseline.totalCachedInputTokens, 33);
  assert.equal(result.baseline.totalUncachedInputTokens, 27);
  assert.equal(result.baseline.cachedInputTokenMeasurements, 2);
  assert.equal(result.baseline.successfulReads, 1);
  assert.equal(result.skill.completed, 1);
  assert.equal(result.skill.medianInputTokens, null);
  assert.equal(result.skill.medianCachedInputTokens, null);
  assert.equal(result.skill.totalInputTokens, null);
  assert.equal(result.skill.totalCachedInputTokens, null);
  assert.equal(result.skill.totalUncachedInputTokens, null);
  assert.equal(result.skill.totalOutputTokens, null);
});

test("token totals retain zero and cannot hide missing or invalid cache measurements", () => {
  const run = total => ({arm: "skill", status: "completed", reads: [], tokenUsage: {total}});
  const zero = summarizeMeasurements([run({inputTokens: 10, cachedInputTokens: 0, outputTokens: 0})]).skill;
  assert.equal(zero.totalCachedInputTokens, 0);
  assert.equal(zero.totalUncachedInputTokens, 10);
  assert.equal(zero.totalOutputTokens, 0);
  assert.equal(summarizeMeasurements([]).skill.totalInputTokens, null);
  for (const invalid of [undefined, -1, 11, NaN, "5"]) {
    const result = summarizeMeasurements([run({inputTokens: 10, cachedInputTokens: invalid})]).skill;
    assert.equal(result.totalInputTokens, 10);
    assert.equal(result.totalCachedInputTokens, null);
    assert.equal(result.totalUncachedInputTokens, null);
  }
  const partial = summarizeMeasurements([run({inputTokens: 10, cachedInputTokens: 5}), run({})]).skill;
  assert.equal(partial.inputTokenMeasurements, 1);
  assert.equal(partial.totalInputTokens, null);
  assert.equal(partial.totalUncachedInputTokens, null);
});
