const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {temporaryDirectory} = require("./helpers");
const {readFixture, comparisonSchedule, summarizeMeasurements} = require("../scripts/evaluate-behavior");

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
});

test("measurement summaries exclude failed runs and preserve missing token data", () => {
  const records = [
    {arm: "baseline", status: "completed", turnElapsedMs: 100, reads: [], tokenUsage: {total: {inputTokens: 20, outputTokens: 5}}},
    {arm: "baseline", status: "completed", turnElapsedMs: 300, reads: [{}], tokenUsage: {total: {inputTokens: 40, outputTokens: 9}}},
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
  assert.equal(result.baseline.successfulReads, 1);
  assert.equal(result.skill.completed, 1);
  assert.equal(result.skill.medianInputTokens, null);
  assert.equal(result.skill.medianCachedInputTokens, null);
});
