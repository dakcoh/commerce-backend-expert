const assert = require("node:assert/strict");
const {test} = require("node:test");
const {temporaryDirectory} = require("./support/fixtures");
const os = require("node:os");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { parseJavaMajor, javaStatus } = require("../lib/java-runtime");
const { parseChecksum, sha256OfFile, verifyFile } = require("../lib/checksum");
const { releaseInfo } = require("../lib/release-client");
const { cachePaths, verifyCached, ensureJar } = require("../lib/jar-cache");
const { serverArguments } = require("../lib/server-process");
const { grade, evaluate } = require("./grade-ai-transcripts");

test("fixture cleanup preserves linked targets and the original temporary root", t => {
  const fixture = temporaryDirectory("commerce-cleanup-");
  const outside = temporaryDirectory("commerce-preserved-");
  t.after(outside.cleanup);
  t.after(fixture.cleanup);
  const preserved = path.join(outside.dir, "preserved.txt");
  fs.writeFileSync(preserved, "preserved");
  fs.symlinkSync(outside.dir, path.join(fixture.dir, "linked"), process.platform === "win32" ? "junction" : "dir");
  t.mock.method(os, "tmpdir", () => outside.dir);
  fixture.cleanup();
  fixture.cleanup();
  assert.equal(fs.existsSync(fixture.dir), false);
  assert.equal(fs.readFileSync(preserved, "utf8"), "preserved");
  assert.throws(() => temporaryDirectory("../outside"));
});

test("fixture cleanup refuses a replaced root", t => {
  const fixture = temporaryDirectory("commerce-replaced-");
  const outside = temporaryDirectory("commerce-preserved-");
  t.after(outside.cleanup);
  fs.rmdirSync(fixture.dir);
  fs.symlinkSync(outside.dir, fixture.dir, process.platform === "win32" ? "junction" : "dir");
  try { assert.throws(fixture.cleanup, /replaced fixture root/); }
  finally { fs.unlinkSync(fixture.dir); }
});

test("a failing fixture setup still runs its registered cleanup", t => {
  const {dir, cleanup} = temporaryDirectory("commerce-hook-test-");
  t.after(cleanup);
  const script = path.join(dir, "failure.test.cjs");
  fs.writeFileSync(script, `const {test}=require('node:test');
    const {temporaryDirectory}=require(${JSON.stringify(require.resolve("./support/fixtures"))});
    test('expected fixture setup failure',t=>{
      temporaryDirectory('commerce-hook-child-',t);
      throw Error('injected fixture setup failure');
    });`);
  const env = {...process.env, TEMP: dir, TMP: dir, TMPDIR: dir};
  delete env.NODE_TEST_CONTEXT; // This child is an independent test run, not another test worker.
  const result = spawnSync(process.execPath, ["--test", script], {
    encoding: "utf8", windowsHide: true, env, timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /injected fixture setup failure/);
  assert.deepEqual(fs.readdirSync(dir), ["failure.test.cjs"]);
});

for (const mode of ["missing-jar", "environment-failure", "launcher-failure"]) {
  test(`smoke preparation cleans its cache after ${mode}`, t => {
    const {dir, cleanup} = temporaryDirectory("commerce-smoke-failure-");
    t.after(cleanup);
    const target = path.join(__dirname, mode === "environment-failure" ? "runtime-smoke.js" : "mcp-smoke.js");
    let launcherRoot = path.resolve(__dirname, ".."), jar = path.join(dir, "missing.jar");
    if (mode === "launcher-failure") {
      launcherRoot = path.join(dir, "fake-launcher");
      fs.mkdirSync(path.join(launcherRoot, "lib"), {recursive: true});
      fs.writeFileSync(path.join(launcherRoot, "package.json"), JSON.stringify({version: "0.2.0"}));
      fs.writeFileSync(path.join(launcherRoot, "lib/commands.js"), "exports.run=async()=>{throw Error('injected launcher startup failure');};");
      jar = path.join(dir, "fixture.jar");
      fs.writeFileSync(jar, "fixture");
    }
    const script = mode !== "environment-failure" ? "require(process.argv[1]);" : `
      const fs=require('fs'),path=require('path'),mkdir=fs.mkdirSync;
      fs.mkdirSync=(file,...args)=>{
        if(path.basename(file)==='tools')throw Error('injected environment setup failure');
        return mkdir(file,...args);
      };require(process.argv[1]);`;
    const result = spawnSync(process.execPath, ["-e", script, target, jar], {
      encoding: "utf8", windowsHide: true, timeout: 10_000,
      env: {...process.env, TEMP: dir, TMP: dir, TMPDIR: dir, MCP_LAUNCHER_ROOT: launcherRoot},
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    const expectedError = {"missing-jar": /ENOENT/, "environment-failure": /injected environment setup failure/,
      "launcher-failure": /injected launcher startup failure/};
    assert.match(result.stderr, expectedError[mode]);
    assert.doesNotMatch(result.stderr, /Launcher must report the owned Java PID/);
    assert.deepEqual(fs.readdirSync(dir).sort(), mode === "launcher-failure" ? ["fake-launcher", "fixture.jar"] : []);
  });
}

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
  const {report, exitCode} = evaluate([checked, {...checked, client: "second-client"}]);
  assert.equal(exitCode, 2);
  assert.equal(report.executedTranscripts, 2);
  assert.equal(report.missingTasks.filter(task => task.client === checked.client).length, 11);
  assert.equal(report.missingTasks.filter(task => task.client === "second-client").length, 11);
  assert.throws(() => evaluate([checked, checked]), /Duplicate/);
  assert.throws(() => evaluate([]), /No transcripts/);
});

test("agent reviews require answer evidence and cannot conceal failed model execution", () => {
  const row = {taskId: "AI-01", model: "test-fixture", client: "unit-test", run: 1,
    finalAnswer: "실제 테스트 답변", toolCalls: [{result: {rule: {id: "webhook-handling"}}}],
    reviewType: "agent", reviewedBy: "unit-test-agent", reviewedAt: "2026-10-20",
    executionCode: 0, turnCompleted: true,
    agentChecks: Object.fromEntries(["grounded", "conditionsChecked", "noFalseDefect"].map(key =>
      [key, {passed: true, quote: "테스트 답변", rationale: "합성 채점기 검증 근거"}]))};
  const result = grade(row);
  assert.equal(result.status, "passed");
  assert.equal(result.reviewType, "agent");
  assert.deepEqual(result.pendingHumanChecks, []);
  for (const check of [{passed: true}, {passed: true, quote: "없는 문구", rationale: "근거"},
    {passed: true, quote: "테스트 답변", rationale: ""}]) {
    assert.equal(grade({...row, agentChecks: {...row.agentChecks, grounded: check}}).status, "pending");
  }
  assert.equal(grade({...row, agentChecks: undefined, humanChecks: {grounded: true}}).status, "pending");
  assert.equal(grade({...row, agentChecks: {...row.agentChecks, grounded: {...row.agentChecks.grounded, passed: false}}}).status, "failed");
  assert.equal(grade({...row, executionCode: 1}).status, "failed");
  assert.equal(grade({...row, turnCompleted: false}).status, "failed");
  assert.equal(grade({...row, reviewType: "human", agentChecks: row.agentChecks}).status, "pending");
  assert.throws(() => grade({...row, reviewType: "automatic"}), /reviewType/);
});

test("error recovery requires an actual failed call followed by success, including Codex status errors", () => {
  const row = {taskId: "AI-12", model: "test-fixture", client: "unit-test", run: 1,
    finalAnswer: "테스트 답변", reviewedBy: "unit-test-fixture", reviewedAt: "2026-10-20",
    humanChecks: {grounded: true, errorRecovered: true}};
  const success = {status: "completed", result: {results: []}};
  for (const failure of [{status: "failed", error: null, result: {content: [{type: "text", text: "Invalid arguments"}]}},
    {error: {message: "transport failed"}}, {result: {isError: true}}]) {
    assert.equal(grade({...row, toolCalls: [failure, success]}).status, "passed");
    assert.equal(grade({...row, toolCalls: [failure, success]}).toolErrorCount, 1);
    assert.equal(grade({...row, toolCalls: [success, failure]}).status, "failed");
  }
  assert.equal(grade({...row, toolCalls: [success]}).status, "failed");
});

test("AI transcript CLI reports incomplete coverage and failures separately", () => {
  const {dir, cleanup} = temporaryDirectory("commerce-ai-eval-cli-");
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
    cleanup();
  }
});

test("builds versioned release URLs", () => {
  const info = releaseInfo({ version: "1.2.3" });
  assert.strictEqual(info.jarName, "context-engine-1.2.3.jar");
  assert.ok(info.checksumUrl.endsWith("context-engine-1.2.3.jar.sha256"));
});

test("parses and verifies SHA-256", () => {
  const {dir, cleanup} = temporaryDirectory("commerce-context-test-");
  try {
    const file = path.join(dir, "sample.jar");
    fs.writeFileSync(file, "verified-content");
    const hash = sha256OfFile(file);
    assert.strictEqual(parseChecksum(`${hash}  sample.jar\n`), hash);
    assert.strictEqual(verifyFile(file, hash), hash);
    assert.throws(() => verifyFile(file, "0".repeat(64)), /Checksum mismatch/);
    assert.throws(() => parseChecksum("bad"), /Malformed/);
  } finally {
    cleanup();
  }
});

test("accepts only a cache with matching local checksum", () => {
  const {dir, cleanup} = temporaryDirectory("commerce-context-cache-");
  try {
    const info = releaseInfo({ version: "1.2.3" });
    const paths = cachePaths(info, dir);
    fs.writeFileSync(paths.jarPath, "jar-content");
    fs.writeFileSync(paths.checksumPath, `${sha256OfFile(paths.jarPath)}  ${info.jarName}\n`);
    assert.strictEqual(verifyCached(paths).ok, true);
    fs.writeFileSync(paths.jarPath, "tampered");
    assert.strictEqual(verifyCached(paths).ok, false);
  } finally {
    cleanup();
  }
});

test("replaces a corrupt versioned cache with a verified download", async () => {
  const {dir, cleanup} = temporaryDirectory("commerce-context-recovery-");
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
    cleanup();
  }
});

test("starts Java stdio with UTF-8 before the jar argument", () => {
  assert.deepStrictEqual(serverArguments("server.jar", ["--example=true"]), [
    "-Dfile.encoding=UTF-8",
    "-Xlog:disable",
    "-Xlog:all=warning:stderr",
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
