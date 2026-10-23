const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {temporaryDirectory} = require("./helpers");
const {readFixture} = require("../scripts/evaluate-behavior");

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
