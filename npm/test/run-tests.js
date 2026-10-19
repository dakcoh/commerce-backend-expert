const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { parseJavaMajor, javaStatus } = require("../lib/java-runtime");
const { parseChecksum, sha256OfFile, verifyFile } = require("../lib/checksum");
const { releaseInfo } = require("../lib/release-client");
const { cachePaths, verifyCached, ensureJar } = require("../lib/jar-cache");
const { serverArguments } = require("../lib/server-process");
const { grade } = require("./grade-ai-transcripts");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("parses current and legacy Java versions", () => {
  assert.strictEqual(parseJavaMajor('openjdk version "17.0.19" 2026-04-21 LTS'), 17);
  assert.strictEqual(parseJavaMajor('java version "1.8.0_401"'), 8);
  assert.strictEqual(parseJavaMajor("unknown"), null);
});

test("checks an explicit Java executable and rejects missing or incompatible runtimes", () => {
  const java = (major, status = 0) => command => {
    assert.strictEqual(command, "/private/runtime/java");
    return {status, stderr: `openjdk version "${major}.0.1"`};
  };
  for (const major of [8, 17, 20]) assert.strictEqual(javaStatus("/private/runtime/java", java(major)).ok, false);
  for (const major of [21, 25]) assert.strictEqual(javaStatus("/private/runtime/java", java(major)).ok, true);
  assert.strictEqual(javaStatus("/private/runtime/java", java(21, 1)).ok, false);
  assert.strictEqual(javaStatus("/private/runtime/java", () => ({status: null, error: new Error("ENOENT")})).ok, false);
});

test("grades observed AI transcripts without treating missing human checks or metrics as passes", () => {
  const row = {taskId: "AI-01", model: "test-fixture", client: "unit-test", run: 1,
    finalAnswer: "테스트용 답변", toolCalls: [{result: {results: [{ruleId: "webhook-handling"}]}}]};
  assert.strictEqual(grade(row).status, "pending");
  assert.strictEqual(grade(row).inputTokens, null);
  const checked = {...row, reviewedBy: "unit-test-fixture", reviewedAt: "2026-10-19",
    humanChecks: {grounded: true, conditionsChecked: true, noFalseDefect: true}};
  assert.strictEqual(grade(checked).status, "passed");
  assert.strictEqual(grade({...checked, toolCalls: []}).status, "failed");
  assert.strictEqual(grade({...checked, humanChecks: {...checked.humanChecks, noFalseDefect: false}}).status, "failed");
  assert.throws(() => grade({...row, taskId: "unknown"}), /Unknown taskId/);
});

test("AI transcript CLI reports incomplete coverage and failures separately", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-ai-eval-cli-"));
  const input = path.join(dir, "synthetic-grader-test.jsonl");
  try {
    const row = {taskId: "AI-01", model: "test-fixture", client: "unit-test", run: 1,
      finalAnswer: "테스트용 답변", toolCalls: [{result: {rule: {id: "webhook-handling"}}}],
      reviewedBy: "unit-test-fixture", reviewedAt: "2026-10-19",
      humanChecks: {grounded: true, conditionsChecked: true, noFalseDefect: true}};
    fs.writeFileSync(input, "\uFEFF" + JSON.stringify(row) + "\n");
    const run = () => spawnSync(process.execPath, [path.join(__dirname, "grade-ai-transcripts.js"), input], {encoding: "utf8"});
    const incomplete = run();
    assert.strictEqual(incomplete.status, 2);
    assert.strictEqual(JSON.parse(incomplete.stdout).missingTasks.length, 11);
    fs.writeFileSync(input, JSON.stringify({...row, toolCalls: []}) + "\n");
    assert.strictEqual(run().status, 1);
    fs.writeFileSync(input, JSON.stringify(row) + "\n" + JSON.stringify(row) + "\n");
    assert.match(run().stderr, /Duplicate/);
  } finally {
    fs.unlinkSync(input);
    fs.rmdirSync(dir);
  }
});

test("builds versioned release URLs", () => {
  const info = releaseInfo({ version: "1.2.3" });
  assert.strictEqual(info.jarName, "context-engine-1.2.3.jar");
  assert.ok(info.checksumUrl.endsWith("context-engine-1.2.3.jar.sha256"));
});

test("parses and verifies SHA-256", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-context-test-"));
  try {
    const file = path.join(dir, "sample.jar");
    fs.writeFileSync(file, "verified-content");
    const hash = sha256OfFile(file);
    assert.strictEqual(parseChecksum(`${hash}  sample.jar\n`), hash);
    assert.strictEqual(verifyFile(file, hash), hash);
    assert.throws(() => verifyFile(file, "0".repeat(64)), /Checksum mismatch/);
    assert.throws(() => parseChecksum("bad"), /Malformed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("accepts only a cache with matching local checksum", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-context-cache-"));
  try {
    const info = releaseInfo({ version: "1.2.3" });
    const paths = cachePaths(info, dir);
    fs.writeFileSync(paths.jarPath, "jar-content");
    fs.writeFileSync(paths.checksumPath, `${sha256OfFile(paths.jarPath)}  ${info.jarName}\n`);
    assert.strictEqual(verifyCached(paths).ok, true);
    fs.writeFileSync(paths.jarPath, "tampered");
    assert.strictEqual(verifyCached(paths).ok, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("replaces a corrupt versioned cache with a verified download", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-context-recovery-"));
  try {
    const info = releaseInfo({ version: "0.1.0" });
    const paths = cachePaths(info, dir);
    const expectedContent = "verified-jar-content";
    const source = path.join(dir, "source.jar");
    fs.writeFileSync(source, expectedContent);
    const expectedHash = sha256OfFile(source);

    fs.writeFileSync(paths.jarPath, "corrupt");
    fs.writeFileSync(paths.checksumPath, `${"0".repeat(64)}  ${info.jarName}\n`);

    const resolved = await ensureJar(info, {
      cacheDir: dir,
      fetchText: async () => `${expectedHash}  ${info.jarName}\n`,
      download: async (_url, destination) => {
        fs.writeFileSync(destination, expectedContent);
      },
    });

    assert.strictEqual(resolved, paths.jarPath);
    assert.strictEqual(fs.readFileSync(paths.jarPath, "utf8"), expectedContent);
    assert.strictEqual(verifyCached(paths).ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("starts Java stdio with UTF-8 before the jar argument", () => {
  assert.deepStrictEqual(serverArguments("server.jar", ["--example=true"]), [
    "-Dfile.encoding=UTF-8",
    "-jar",
    "server.jar",
    "--example=true",
  ]);
});

test("ships the repository MIT license in the npm package", () => {
  const packageRoot = path.resolve(__dirname, "..");
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const packagedLicense = fs.readFileSync(path.join(packageRoot, "LICENSE"), "utf8");
  const repositoryLicense = fs.readFileSync(path.resolve(packageRoot, "..", "LICENSE"), "utf8");

  assert.ok(packageJson.files.includes("LICENSE"));
  assert.strictEqual(packagedLicense.replace(/\r\n/g, "\n"), repositoryLicense.replace(/\r\n/g, "\n"));
});

(async () => {
  let failed = 0;
  for (const entry of tests) {
    try {
      await entry.fn();
      console.log(`ok - ${entry.name}`);
    } catch (error) {
      failed += 1;
      console.error(`not ok - ${entry.name}`);
      console.error(error.stack || error);
    }
  }
  if (failed > 0) {
    process.exit(1);
  }
  console.log(`${tests.length} npm launcher tests passed`);
})();
