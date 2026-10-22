#!/usr/bin/env node

const assert = require("assert");
const path = require("path");
const readline = require("readline");
const { spawn } = require("child_process");
const fs = require("fs");
const {temporaryDirectory, isolatedJavaEnvironment} = require("./support/fixtures");
const {sha256OfFile} = require("../lib/checksum");

const jarPath = process.argv[2] && path.resolve(process.argv[2]);
if (!jarPath) {
  console.error("Usage: node test/mcp-smoke.js <server.jar>");
  process.exit(2);
}

const launcherRoot = process.env.MCP_LAUNCHER_ROOT;
let cacheDir, cleanupCache;
let launcherEnv = {...process.env};
if (launcherRoot) {
  ({dir: cacheDir, cleanup: cleanupCache} = temporaryDirectory("commerce-한글-🧪-smoke-"));
  try {
    const pkg = require(path.join(path.resolve(launcherRoot), "package.json"));
    const cachedJar = path.join(cacheDir, `context-engine-${pkg.version}.jar`);
    fs.copyFileSync(jarPath, cachedJar);
    fs.writeFileSync(`${cachedJar}.sha256`, sha256OfFile(cachedJar));
    launcherEnv = isolatedJavaEnvironment(cacheDir);
    // JVM diagnostics must never be emitted into the JSON-RPC channel.
    launcherEnv.JDK_JAVA_OPTIONS = "-Xlog:os=info";
  } catch (error) { cleanupCache(); throw error; }
}
const launcherCode = `const cp=require('child_process'),spawn=cp.spawn;
  cp.spawn=(...args)=>{const child=spawn(...args);console.error('SMOKE_JAVA_PID:'+child.pid);
    console.error('SMOKE_JAVA_CWD:'+JSON.stringify(args[2].cwd));
    child.once('exit',code=>{if(code!==0){try{
      console.error('SMOKE_JAVA_LOG:'+require('fs').readFileSync(require('path').join(args[2].cwd,'logs/context-engine-stdio.log'),'utf8'));
    }catch{}}});return child;};
  require(process.argv[1]).run([],require(process.argv[2]),{cacheDir:process.argv[3]})
    .catch(e=>{console.error(e);process.exitCode=1});`;
const child = spawn(launcherRoot ? process.execPath : "java", launcherRoot
  ? ["-e", launcherCode, path.resolve(launcherRoot, "lib/commands.js"), path.resolve(launcherRoot, "package.json"), cacheDir]
  : ["-Dfile.encoding=UTF-8", "-jar", jarPath], {
  cwd: cacheDir || path.dirname(jarPath),
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
  env: launcherEnv,
});

const pending = new Map();
let nextId = 1;
let stderr = "";
let settled = false;
let diagnosing = false;
let diagnosticOutput = "";
let timeout;

function armTimeout(milliseconds) {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    diagnosing = true;
    const pid = launcherRoot ? Number(stderr.match(/SMOKE_JAVA_PID:(\d+)/)?.[1]) : child.pid;
    if (pid && process.platform !== "win32") {
      try { process.kill(pid, "SIGQUIT"); } catch {}
    }
    setTimeout(() => {
      const directory = stderr.match(/SMOKE_JAVA_CWD:(.+)/)?.[1];
      let serverLog = "";
      if (directory) {
        try { serverLog = fs.readFileSync(path.join(JSON.parse(directory), "logs/context-engine-stdio.log"), "utf8"); } catch {}
      }
      finish(new Error(`MCP smoke test timed out; pending=${JSON.stringify([...pending.values()].map(item => item.method))}\n${stderr}\n${serverLog}\n${diagnosticOutput}`));
    }, 1_500);
  }, milliseconds);
}

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  const wasStarted = /SMOKE_JAVA_PID:\d+/.test(stderr);
  stderr += chunk;
  if (!wasStarted && /SMOKE_JAVA_PID:\d+/.test(stderr)) armTimeout(60_000);
});

function send(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    if (settled) { reject(new Error("MCP smoke session already stopped")); return; }
    pending.set(id, { resolve, reject, method });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

function notify(method, params = {}) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
}

function tool(name, args) {
  return send("tools/call", { name, arguments: args });
}

function data(result) {
  assert.strictEqual(result.isError, false, JSON.stringify(result));
  return JSON.parse(result.content.find((item) => item.type === "text").text);
}

async function expectFailure(method, params) {
  let result;
  try {
    result = await send(method, params);
  } catch (error) {
    // JSON-RPC errors and tools/call isError are both valid MCP error boundaries.
    assert.ok(error.rpcError, "A transport failure is not a valid MCP error response");
    return;
  }
  assert.strictEqual(result.isError, true, `Expected failure: ${JSON.stringify({ method, params, result })}`);
}

const output = readline.createInterface({ input: child.stdout });
output.on("line", (line) => {
  if (diagnosing) { diagnosticOutput += `${line}\n`; return; }
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    finish(new Error(`Non-JSON MCP stdout: ${error.message}; ${line.length} characters\n${JSON.stringify(line)}\n${stderr}`, {cause: error}));
    return;
  }
  if (message.id !== undefined && pending.has(message.id)) {
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler.reject(Object.assign(new Error(JSON.stringify(message.error)), {rpcError: message.error}));
    else handler.resolve(message.result);
  }
});

child.on("error", finish);
child.stdin.on("error", (error) => { if (!settled) finish(error); });
child.on("exit", (code, signal) => {
  if (!settled) finish(new Error(`MCP server exited early: code=${code}, signal=${signal}\n${stderr}`));
});

armTimeout(launcherRoot ? 660_000 : 60_000);

function finish(error) {
  if (settled) return;
  settled = true;
  clearTimeout(timeout);
  if (error) {
    for (const handler of pending.values()) handler.reject(error);
    pending.clear();
  }
  output.close();
  child.stdin.end();
  const forced = setTimeout(() => child.kill("SIGKILL"), 5_000);
  child.once("close", (code, signal) => {
    clearTimeout(forced);
    if (!error && (code !== 0 || signal)) {
      console.error(`MCP did not exit cleanly after EOF: code=${code}, signal=${signal}`);
      process.exitCode = 1;
    }
    if (launcherRoot) {
      const pid = Number(stderr.match(/SMOKE_JAVA_PID:(\d+)/)?.[1]);
      try {
        if (!error || pid) {
          assert.ok(pid, "Launcher must report the owned Java PID");
          assert.throws(() => process.kill(pid, 0), {code: "ESRCH"}, "Java must exit with its launcher");
        }
      } catch (failure) {console.error(failure); process.exitCode = 1;}
      cleanupCache();
    }
  });
  if (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}

(async () => {
  try {
    const initialized = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "commerce-context-smoke", version: "1.0.0" },
    });
    assert.ok(initialized.serverInfo && initialized.serverInfo.name);
    if (process.env.MCP_EXPECTED_VERSION) assert.strictEqual(initialized.serverInfo.version, process.env.MCP_EXPECTED_VERSION);
    notify("notifications/initialized");

    const [toolResult, resourceResult, templateResult, promptResult, callResult, ruleResult, catalogResult, noAnswerResult] = await Promise.all([
      send("tools/list", {}),
      send("resources/list", {}),
      send("resources/templates/list", {}),
      send("prompts/list", {}),
      send("tools/call", {
        name: "search_knowledge",
        arguments: { query: "결제 웹훅 서명", topK: 3, detail: "summary" },
      }),
      send("tools/call", {
        name: "get_rule",
        arguments: { ruleId: "available-stock-query" },
      }),
      send("resources/read", { uri: "commerce://catalog" }),
      send("tools/call", {
        name: "search_knowledge",
        arguments: { query: "오늘 서울 날씨", topK: 3, detail: "summary" },
      }),
    ]);

    const toolNames = toolResult.tools.map((tool) => tool.name);
    assert.strictEqual(toolNames.length, 4);
    assert.ok(toolNames.includes("search_knowledge"));
    assert.ok(toolNames.includes("get_rule"));
    assert.ok(toolNames.includes("get_checklist"));
    assert.ok(toolNames.includes("review_commerce_design"));

    assert.ok(resourceResult.resources.some((resource) => resource.uri === "commerce://catalog"));
    assert.ok(templateResult.resourceTemplates.some((resource) => resource.uriTemplate === "commerce://rules/{ruleId}"));
    assert.ok(templateResult.resourceTemplates.some((resource) => resource.uriTemplate === "commerce://domains/{domain}"));
    assert.ok(promptResult.prompts.some((prompt) => prompt.name === "review-commerce-api"));
    assert.ok(promptResult.prompts.some((prompt) => prompt.name === "review-payment-webhook"));
    assert.strictEqual(callResult.isError, false);
    assert.ok(
      callResult.content.some((item) => item.type === "text"
        && item.text.includes("webhook-handling")
        && item.text.includes("project-guidance")
        && item.text.includes("matchConfidence")
        && item.text.includes("commerce-context-maintainers")
        && item.text.includes("notice")),
      JSON.stringify(callResult),
    );
    assert.ok(ruleResult.content.some((item) => item.type === "text"
      && item.text.includes('"evidenceLevel":"project-guidance"')
      && item.text.includes('"owner":"commerce-context-maintainers"')
      && item.text.includes('"verifiedBy":null')
      && item.text.includes("not-recorded")));
    assert.ok(catalogResult.contents.some((item) => item.text.includes("project-guidance")
      && item.text.includes("needs-review")));
    assert.ok(noAnswerResult.content.some((item) => item.type === "text"
      && item.text.includes('"answerable":false')
      && item.text.includes("구체화")));

    // Concurrent tool completions must retain every JSON-RPC response.
    for (let round = 0; round < 4; round++) {
      child.stdout.pause();
      const resume = setTimeout(() => child.stdout.resume(), 250);
      let replies;
      try {
        replies = await Promise.all(Array.from({length: 64}, () => tool("get_rule", {
          ruleId: "available-stock-query", responseFormat: "json",
        })));
      } finally { clearTimeout(resume); child.stdout.resume(); }
      for (const reply of replies) assert.deepStrictEqual(data(reply).rule, data(ruleResult).rule);
    }

    const checklistResponses = new Map();
    for (const domain of ["inventory", "payment", "settlement", "coupon", "commerce", "spring-commerce"]) {
      const checklist = data(await tool("get_checklist", { domain }));
      checklistResponses.set(domain, checklist);
      assert.ok(checklist.rules.length > 0 && checklist.rules.length <= 10);
      assert.ok(checklist.domainRuleCount >= checklist.rules.length);
      assert.strictEqual(checklist.partial, checklist.rules.length < checklist.domainRuleCount);
      const items = checklist.rules.flatMap((rule) => {
        assert.ok(rule.applicability.appliesWhen.length > 0);
        return rule.items;
      });
      const rendered = checklist.markdown.split("\n").filter((line) => line.startsWith("- [ ] "))
        .map((line) => line.slice(6));
      assert.deepStrictEqual(rendered, items);
    }
    for (const uri of ["commerce://rules/available-stock-query", "commerce://domains/payment"]) {
      const resource = await send("resources/read", { uri });
      assert.ok(resource.contents.some((item) => item.text.includes("knowledgeId")));
    }
    for (const name of ["review-commerce-api", "review-payment-webhook"]) {
      const prompt = await send("prompts/get", { name, arguments: name === "review-commerce-api" ? { domain: "payment" } : {} });
      const text = prompt.messages.map(message => message.content.text || "").join("\n");
      for (const part of ["review_commerce_design", "artifact", "scenario", "사용자가 제공한", "추측하지"]) {
        assert.ok(text.includes(part), `${name} must explain ${part}`);
      }
      if (name === "review-commerce-api") {
        assert.ok(!text.includes("matchConfidence"));
        for (const field of ["ruleStatus", "evidenceLevel", "verifiedBy", "lastReviewedAt", "matchedEvidence"]) {
          assert.ok(text.includes(field), `${name} must explain ${field}`);
        }
      }
    }
    for (const artifactType of ["design", "api", "ddl", "code"]) {
      const review = data(await tool("review_commerce_design", {
        artifact: "결제 웹훅 서명과 중복 이벤트 멱등성 처리", artifactType, domain: "payment", maxFindings: 3,
      }));
      assert.ok(review.findings.length > 0 && review.findings.length <= 3);
      assert.ok(review.findings.every((finding) => finding.status === "review-required"));
      for (const field of ["ruleStatus", "evidenceLevel", "verifiedBy", "lastReviewedAt", "matchedEvidence"]) {
        assert.ok(review.findings.every(finding => Object.hasOwn(finding, field)), `Review must supply ${field}`);
      }
      assert.ok(review.notice.includes("matchedEvidence") && review.notice.includes("get_rule"));
    }

    const invalidCalls = [
      ["search_knowledge", {}],
      ["search_knowledge", { query: ["결제", "웹훅"] }],
      ["search_knowledge", { query: "결제", topK: "2" }],
      ["search_knowledge", { query: "결제", topK: 1.9 }],
      ["search_knowledge", { query: "결제", responseFormat: "bad" }],
      ["search_knowledge", { query: "재고", domain: "inventory,typo" }],
      ["search_knowledge", { query: "", category: "typo" }],
      ["search_knowledge", { query: "재고", domain: ",," }],
      ["search_knowledge", { query: "", topK: 0 }],
      ["search_knowledge", { query: "재고", topK: 11 }],
      ["search_knowledge", { query: "재고", topK: "bad" }],
      ["search_knowledge", { query: "", detail: "typo" }],
      ["get_rule", {}],
      ["get_rule", { ruleId: "unknown-rule" }],
      ["get_checklist", {}],
      ["get_checklist", { domain: "typo" }],
      ["review_commerce_design", {}],
      ["review_commerce_design", { artifact: " " }],
      ["review_commerce_design", { artifact: "결제", artifactType: "typo" }],
      ["review_commerce_design", { artifact: "결제", domain: "typo" }],
      ["review_commerce_design", { artifact: "결제", maxFindings: 0 }],
      ["review_commerce_design", { artifact: "결제", maxFindings: 11 }],
    ];
    for (const [name, args] of invalidCalls) {
      await expectFailure("tools/call", { name, arguments: args });
    }
    await expectFailure("resources/read", { uri: "commerce://domains/typo" });
    await expectFailure("resources/read", { uri: "commerce://rules/unknown-rule" });
    await expectFailure("prompts/get", { name: "unknown-prompt" });

    const blank = data(await tool("search_knowledge", { query: " \n\t " }));
    assert.strictEqual(blank.answerable, false);
    assert.deepStrictEqual(blank.results, []);
    for (const topK of [1, 10]) {
      const response = data(await tool("search_knowledge", { query: "결제 웹훅", topK, detail: "full" }));
      assert.ok(response.count >= 1 && response.count <= topK);
      assert.ok(response.markdown.includes("적용 조건"));
    }
    data(await tool("search_knowledge", { query: "결제\u0000\n웹훅\t서명" }));
    const large = data(await tool("review_commerce_design", {
      artifact: "// 결제 웹훅 서명 검증 멱등성\n" + "x".repeat(200_000), artifactType: "code", domain: "payment",
    }));
    assert.ok(large.findings.some((finding) => finding.ruleId === "webhook-handling"));

    const jsonRule = data(await tool("get_rule", { ruleId: "available-stock-query", responseFormat: "json" }));
    assert.deepStrictEqual(jsonRule.rule, data(ruleResult).rule);
    assert.strictEqual(jsonRule.markdown, "");
    const jsonChecklist = data(await tool("get_checklist", { domain: "payment", responseFormat: "json" }));
    assert.deepStrictEqual(jsonChecklist.rules, checklistResponses.get("payment").rules);
    assert.strictEqual(jsonChecklist.markdown, "");
    const jsonFull = data(await tool("search_knowledge", { query: "결제 웹훅 서명", detail: "full", responseFormat: "json" }));
    assert.ok(jsonFull.count > 0 && jsonFull.fullRules.length === jsonFull.count);
    assert.strictEqual(jsonFull.markdown, "");
    assert.ok(jsonFull.fullRules.every((rule) => rule.evidence.length && rule.applicability.appliesWhen.length));
    const fields = Array.from({ length: 45 }, (_, i) => `private int opaqueField${i};`).join("\n");
    const webhook = "// 결제 웹훅 서명 검증 멱등성 중복 이벤트 처리\n@PostMapping(\"/webhook\") public void webhook(PaymentEvent event) { order.setStatus(\"PAID\"); }";
    for (const artifact of [webhook + fields, fields + webhook]) {
      const review = data(await tool("review_commerce_design", { artifact, artifactType: "code", domain: "payment" }));
      assert.ok(review.findings.some((finding) => finding.ruleId === "webhook-handling"));
    }
    const noise = Array.from({ length: 1000 }, (_, i) => `opaqueField${i}`).join(" ");
    const scenario = data(await tool("review_commerce_design", {
      artifact: noise, artifactType: "code", domain: "payment", scenario: "결제 웹훅 서명 멱등성",
    }));
    assert.ok(scenario.findings.some((finding) => finding.ruleId === "webhook-handling"));
    assert.strictEqual(scenario.analysisTruncated, true);
    assert.strictEqual(scenario.analyzedChunks, 32);
    for (const query of ["재고가 아니라 오늘 기온이 궁금해", "부산 맛집 예약", "식당 예약 취소 수수료가 궁금해요"]) {
      assert.strictEqual(data(await tool("search_knowledge", { query })).answerable, false);
    }
    assert.strictEqual(data(await tool("search_knowledge", {
      query: "식당 예약 취소 수수료가 궁금해요", domain: "payment",
    })).answerable, false);
    for (const query of ["식당 예약 환불 API 설계", "미용실 예약 취소 환불"]) {
      const refund = data(await tool("search_knowledge", {query, domain: "payment", responseFormat: "json"}));
      assert.strictEqual(refund.answerable, true);
      assert.ok(refund.results.some(result => result.ruleId === "partial-refund"));
    }
    const recovery = data(await tool("search_knowledge", { query: "결제 웹훅 서명", topK: 1 }));
    assert.strictEqual(recovery.results[0].ruleId, "webhook-handling");

    const guide = fs.readFileSync(path.resolve(__dirname, "../../docs/USAGE_SCENARIOS.md"), "utf8");
    const examples = [...guide.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]));
    assert.ok(examples.length > 0, "The usage guide must include callable examples");
    for (const example of examples) data(await tool(example.name, example.arguments));

    console.log(`MCP JSON-RPC smoke test passed: ${nextId - 1} requests, 256 concurrent tool calls, 4 tools, 3 resource reads, 2 prompt gets, ${invalidCalls.length + 3} error cases, ${examples.length} documentation examples, JSON mode, bounded review, UTF-8, 200KB input, recovery`);
    finish();
  } catch (error) {
    finish(error);
  }
})();
