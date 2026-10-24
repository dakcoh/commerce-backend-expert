const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const {randomUUID, createHash} = require("node:crypto");
const {spawn, spawnSync} = require("node:child_process");

// Real client hooks, deterministic localhost responses; no model or account access.
const root = path.resolve(__dirname, "..");
const claude = process.argv[2] || (process.platform === "win32" ? "claude.exe" : "claude");
fs.mkdirSync(path.join(root, "output"), {recursive: true});
const output = fs.mkdtempSync(path.join(root, "output/claude-hooks-"));
const profile = path.join(output, "profile"), work = path.join(output, "work"), other = path.join(output, "other"), plugin = path.join(output, "plugin"), temporary = path.join(output, "tmp");
for (const directory of [profile, work, other, plugin, temporary]) fs.mkdirSync(directory);
for (const relative of ["plugin.json", "package.json", "LICENSE", ".claude-plugin/plugin.json", "skills", "hooks/session.json", "hooks/session.js"]) {
  const destination = path.join(plugin, relative); fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.cpSync(path.join(root, relative), destination, {recursive: true});
}

const requests = [], checks = [];
let child;
const server = http.createServer(async (request, response) => {
  try {
    const chunks = []; let size = 0;
    for await (const chunk of request) { size += chunk.length; assert.ok(size <= 2 * 1024 * 1024, "Fixture input too large"); chunks.push(chunk); }
    const route = new URL(request.url, "http://127.0.0.1").pathname;
    if (route === "/") { response.writeHead(200, {"content-type": "application/json"}); response.end("{}"); return; }
    assert.ok(["/v1/messages", "/v1/messages/count_tokens"].includes(route), "Unexpected fixture endpoint");
    assert.equal(request.headers["x-api-key"], "sk-ant-local-fixture");
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (route.endsWith("count_tokens")) { response.writeHead(200, {"content-type": "application/json"}); response.end('{"input_tokens":100}'); return; }
    requests.push(body);
    const message = {id: "msg_fixture_" + requests.length, type: "message", role: "assistant", model: body.model,
      content: [{type: "text", text: "Fixture response."}], stop_reason: "end_turn", stop_sequence: null, usage: {input_tokens: 100, output_tokens: 5}};
    if (!body.stream) { response.writeHead(200, {"content-type": "application/json"}); response.end(JSON.stringify(message)); return; }
    response.writeHead(200, {"content-type": "text/event-stream"});
    for (const event of [
      {type: "message_start", message: {...message, content: [], stop_reason: null, usage: {input_tokens: 100, output_tokens: 0}}},
      {type: "content_block_start", index: 0, content_block: {type: "text", text: ""}},
      {type: "content_block_delta", index: 0, delta: {type: "text_delta", text: "Fixture response."}},
      {type: "content_block_stop", index: 0},
      {type: "message_delta", delta: {stop_reason: "end_turn", stop_sequence: null}, usage: {output_tokens: 5}},
      {type: "message_stop"},
    ]) response.write("event: " + event.type + "\ndata: " + JSON.stringify(event) + "\n\n");
    response.end();
  } catch {
    response.writeHead(400, {"content-type": "application/json"}); response.end('{"error":{"type":"invalid_request_error","message":"Invalid fixture request"}}');
  }
});

async function run(label, prompt, args, cwd = work) {
  const env = {...process.env, CLAUDE_CONFIG_DIR: profile, ANTHROPIC_BASE_URL: "http://127.0.0.1:" + server.address().port,
    ANTHROPIC_API_KEY: "sk-ant-local-fixture", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", DISABLE_TELEMETRY: "1", DISABLE_ERROR_REPORTING: "1", TMP: temporary, TEMP: temporary};
  for (const key of ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_CUSTOM_HEADERS", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "PLUGIN_ROOT", "PLUGIN_DATA", "CLAUDE_PLUGIN_ROOT", "CLAUDE_PLUGIN_DATA"]) delete env[key];
  const offset = requests.length;
  const result = await new Promise((resolve, reject) => {
    child = spawn(claude, ["-p", prompt, "--plugin-dir", plugin, "--setting-sources", "user", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
      "--tools", "", "--model", "claude-sonnet-4-6", "--output-format", "stream-json", "--include-hook-events", "--verbose", ...args], {cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"]});
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(Error(label + ": client timeout")); }, 30000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => { clearTimeout(timer); resolve({code, stdout, stderr}); });
  });
  fs.writeFileSync(path.join(output, label + ".jsonl"), result.stdout);
  fs.writeFileSync(path.join(output, label + ".stderr"), result.stderr);
  assert.equal(result.code, 0, label + ": " + result.stderr);
  const events = result.stdout.trim().split("\n").map(line => JSON.parse(line));
  assert.ok(events.some(event => event.type === "result" && event.subtype === "success" && !event.is_error), label + ": incomplete client run");
  const hooks = events.filter(event => event.subtype === "hook_response");
  for (const hook of hooks) { assert.equal(hook.outcome, "success", label); assert.equal(hook.exit_code, 0, label); assert.equal(hook.stderr, "", label); }
  const contexts = hooks.map(hook => ({name: hook.hook_name, context: hook.stdout.trim() ? JSON.parse(hook.stdout).hookSpecificOutput.additionalContext : null}));
  const requestModes = requests.slice(offset).map(body => (JSON.stringify(body).match(/COMMERCE MODE (?:ON|OFF)/g) || []).at(-1));
  checks.push({label, hooks: contexts.map(item => ({name: item.name, mode: item.context?.match(/^COMMERCE MODE (ON|OFF)/)?.[1] || null})), requestModes});
  return {events, contexts, requestModes};
}

function expectContext(result, name, mode) {
  const item = result.contexts.find(item => item.name === name);
  assert.ok(item, "Missing client hook: " + name);
  if (mode === null) assert.equal(item.context, null);
  else assert.match(item.context, new RegExp("^COMMERCE MODE " + mode));
}

async function main() {
  const version = spawnSync(claude, ["--version"], {encoding: "utf8", windowsHide: true, timeout: 10000});
  assert.ifError(version.error); assert.equal(version.status, 0, version.stderr);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const session = randomUUID(), resume = ["--resume", session];
  const startup = await run("startup", "ordinary fixture prompt", ["--session-id", session]);
  const init = startup.events.find(event => event.subtype === "init");
  assert.deepEqual(init.tools, []); assert.deepEqual(init.plugins.map(item => item.name), ["commerce-backend-expert"]);
  assert.deepEqual(init.skills.filter(name => name.startsWith("commerce-backend-expert:")).sort(), ["commerce-backend-expert:commerce-backend-expert", "commerce-backend-expert:commerce-review"]);
  expectContext(startup, "SessionStart:startup", "ON"); expectContext(startup, "UserPromptSubmit", null);
  assert.equal(startup.requestModes.at(-1), "COMMERCE MODE ON");
  assert.match(startup.contexts[0].context, /commerce-review/); assert.match(startup.contexts[0].context, /commerce-backend-expert/);
  for (const [label, prompt, mode] of [["off", "commerce off", "OFF"], ["status", "commerce status", "OFF"], ["quoted", "예시: commerce on", null], ["negated", "commerce on 하지 마", null]]) {
    const result = await run(label, prompt, resume); expectContext(result, "UserPromptSubmit", mode);
    if (label !== "off") expectContext(result, "SessionStart:resume", "OFF");
    assert.equal(result.requestModes.at(-1), "COMMERCE MODE OFF");
  }
  const compacted = await run("compact", "/compact", resume);
  assert.ok(compacted.events.some(event => event.subtype === "compact_boundary"), "No real compaction boundary");
  expectContext(compacted, "SessionStart:compact", "OFF");
  const after = await run("after-compact", "commerce status", resume);
  expectContext(after, "SessionStart:resume", "OFF"); expectContext(after, "UserPromptSubmit", "OFF");
  assert.equal(after.requestModes.at(-1), "COMMERCE MODE OFF");
  const enabled = await run("on", "commerce on", resume); expectContext(enabled, "UserPromptSubmit", "ON");
  assert.equal(enabled.requestModes.at(-1), "COMMERCE MODE ON");
  const disabled = await run("off-again", "commerce off", resume); expectContext(disabled, "UserPromptSubmit", "OFF");
  assert.equal(disabled.requestModes.at(-1), "COMMERCE MODE OFF");
  for (const [label, cwd] of [["other-session", work], ["other-project", other]]) {
    const result = await run(label, "commerce status", ["--session-id", randomUUID()], cwd);
    expectContext(result, "SessionStart:startup", "ON"); expectContext(result, "UserPromptSubmit", "ON");
    assert.equal(result.requestModes.at(-1), "COMMERCE MODE ON");
  }
  const restored = await run("original-session", "commerce status", resume); expectContext(restored, "SessionStart:resume", "OFF"); expectContext(restored, "UserPromptSubmit", "OFF");
  assert.equal(restored.requestModes.at(-1), "COMMERCE MODE OFF");
  const summary = {client: version.stdout.trim(), pluginVersion: JSON.parse(fs.readFileSync(path.join(plugin, "plugin.json"), "utf8")).version,
    node: process.version, platform: process.platform, remoteModelCalls: 0, credentialsCopied: false,
    hookSha256: createHash("sha256").update(fs.readFileSync(path.join(plugin, "hooks/session.js"))).digest("hex"), localRequests: requests.length, checks};
  fs.writeFileSync(path.join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify({output, client: summary.client, checks: checks.length, remoteModelCalls: 0, passed: true}));
}

main().catch(error => { console.error("Claude hook check failed. Evidence: " + output + "\n" + error.message); process.exitCode = 1; }).finally(() => { child?.kill(); server.closeAllConnections(); server.close(); });
