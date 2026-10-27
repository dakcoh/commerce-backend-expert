const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const {randomBytes, createHash} = require("node:crypto");
const {spawnSync} = require("node:child_process");

function localEndpoint(value) {
  const url = new URL(value);
  assert.ok(url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Use a loopback Ollama HTTP endpoint");
  assert.ok(!url.username && !url.password && !url.search && !url.hash && url.pathname === "/", "Use native Ollama base URL without /v1 or credentials");
  return url.origin;
}

function assessReadProbe(native, expected) {
  const final = typeof native.final === "string" ? native.final : "";
  const normalize = value => value.replaceAll("\r\n", "\n").replace(/\n$/, "");
  return {nativeOk: native.ok === true,
    readReportedWithoutError: Number.isSafeInteger(native.toolSummary?.calls) && native.toolSummary.calls >= 1 && native.toolSummary.failures === 0 && native.toolSummary.tools?.length === 1 && native.toolSummary.tools[0] === "read",
    exactOutput: normalize(final) === normalize(expected)};
}

function nativeFileCalls(state, sessionId) {
  const {DatabaseSync} = require("node:sqlite");
  const {zstdDecompressSync} = require("node:zlib");
  assert.equal(typeof sessionId, "string", "Native session ID missing");
  const database = new DatabaseSync(path.join(state, "agents/main/agent/openclaw-agent.sqlite"), {readOnly: true});
  let rows;
  try { rows = database.prepare("SELECT event_json,event_zstd FROM transcript_events WHERE session_id=? ORDER BY seq").all(sessionId); }
  finally { database.close(); }
  const calls = [], pending = new Map();
  for (const row of rows) {
    const message = JSON.parse(row.event_json || zstdDecompressSync(row.event_zstd).toString("utf8")).message;
    if (message?.role === "assistant" && Array.isArray(message.content)) for (const block of message.content) if (block.type === "toolCall") {
      const call = {name: block.name, path: block.arguments?.path ?? block.arguments?.file_path, completed: false};
      pending.set(block.id, call); calls.push(call);
    }
    if (message?.role === "toolResult") {
      const call = pending.get(message.toolCallId);
      assert.ok(call, "Native tool result has no corresponding call");
      call.completed = true; call.isError = message.isError === true;
    }
  }
  return calls;
}

function assessEditProbe(native, expected, actual, calls, taskFile) {
  const summary = native.toolSummary;
  const target = path.resolve(taskFile), directory = path.dirname(target);
  const taskFileScope = calls.some(call => call.name === "edit") && calls.length === summary?.calls && calls.every(call => {
    if (!call.completed || call.isError || typeof call.path !== "string") return false;
    const file = path.resolve(directory, call.path);
    return call.name === "edit" ? file === target : call.name === "read" && (file === target || file === path.join(directory, "AGENTS.md"));
  });
  return {nativeOk: native.ok === true,
    editReportedWithoutError: Number.isSafeInteger(summary?.calls) && summary.calls >= 1 && summary.failures === 0 &&
      Array.isArray(summary.tools) && summary.tools.includes("edit") && summary.tools.every(name => ["read", "edit"].includes(name)),
    exactFile: actual === expected,
    taskFileScope};
}

function isolatedSkillEntries(inventory, selected) {
  assert.ok(selected.every(name => inventory.some(item => item.name === name)), "Selected skill was not discovered");
  return Object.fromEntries(inventory.map(item => [item.name, {enabled: selected.includes(item.name)}]));
}

async function probe(cli, endpoint, model, temperature = 0, thinking = "off") {
  const baseUrl = localEndpoint(endpoint);
  assert.ok(Number.isFinite(temperature) && temperature >= 0 && temperature <= 1, "Temperature must be 0..1");
  assert.ok(["off", "low", "medium", "high"].includes(thinking), "Invalid thinking level");
  assert.ok(model && !model.endsWith(":cloud"), "Use an installed local model");
  const json = async (route, body) => {
    const response = await fetch(baseUrl + route, {method: body ? "POST" : "GET", redirect: "error", headers: {"content-type": "application/json"}, ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(10000)});
    assert.ok(response.ok, "Ollama metadata request failed");
    return response.json();
  };
  const installed = (await json("/api/tags")).models.find(item => item.name === model);
  assert.ok(installed && !installed.remote_host && !installed.remote_model, "Model must be installed locally");
  const show = await json("/api/show", {model});
  assert.ok(!show.remote_host && !show.remote_model && show.capabilities?.includes("tools"), "Local model must advertise tools");
  const repository = path.resolve(__dirname, "..");
  fs.mkdirSync(path.join(repository, "output"), {recursive: true});
  const output = fs.mkdtempSync(path.join(repository, "output/openclaw-model-probe-"));
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "commerce-openclaw-"));
  fs.writeFileSync(path.join(output, "fixture-root.txt"), fixture);
  const deadlineSeconds = 120;
  const record = {node: process.version, platform: process.platform, model, digest: installed.digest, deadlineSeconds,
    ollama: (await json("/api/version")).version, requestedThinking: thinking, requestedOptions: {temperature, seed: 42, num_ctx: 32768, num_predict: 4096},
    scope: "Native local read and minimal CSS file edits in disposable fixtures; no payment or semantic commerce certification", trials: []};
  const env = {...process.env};
  for (const key of Object.keys(env)) if (/^(OPENCLAW_|OLLAMA_|OPENAI_|ANTHROPIC_|CLAUDE_|CURSOR_|GEMINI_|GOOGLE_API_KEY|AWS_|AZURE_)/.test(key)) delete env[key];
  const redact = value => value.replaceAll(fixture, "<fixture>").replaceAll(JSON.stringify(fixture).slice(1, -1), "<fixture>");
  const run = (args, cwd, config, state) => {
    const result = spawnSync(process.execPath, [cli, ...args], {cwd, env: {...env, OPENCLAW_CONFIG_PATH: config, OPENCLAW_STATE_DIR: state, OLLAMA_API_KEY: "ollama-local", NO_PROXY: "127.0.0.1,localhost"}, windowsHide: true, encoding: "utf8", timeout: (deadlineSeconds + 60) * 1000, maxBuffer: 4 * 1024 * 1024});
    assert.ifError(result.error);
    assert.ok(result.status === 0 || (args[0] === "agent" && result.stdout.trim()), "OpenClaw command failed: " + result.stderr.slice(-500));
    return result;
  };
  for (const id of ["read-control", "frontend-scope"]) {
    const home = path.join(fixture, id), cwd = path.join(home, "work"), state = path.join(home, "state"), config = path.join(home, "openclaw.json");
    fs.mkdirSync(cwd, {recursive: true});
    fs.mkdirSync(state);
    const nonce = "probe-" + randomBytes(16).toString("hex");
    const html = id === "frontend-scope";
    const template = html ? fs.readFileSync(path.join(repository, "benchmarks/fixtures/index.html"), "utf8") : "";
    const source = html ? template + "<!-- " + nonce + " -->" + (template.includes("\r\n") ? "\r\n" : "\n") : nonce;
    const filename = html ? "index.html" : "marker.txt";
    fs.writeFileSync(path.join(cwd, filename), source);
    fs.writeFileSync(path.join(cwd, "AGENTS.md"), html ? "Only edit the two requested CSS values in index.html. Preserve all other bytes.\n" : "Read only the supplied task file. Do not modify files.\n");
    const skills = html ? ["commerce-backend-expert", "commerce-review"] : [];
    for (const name of skills) fs.cpSync(path.join(repository, "skills", name), path.join(cwd, "skills", name), {recursive: true});
    const settings = {
      agents: {defaults: {workspace: cwd, skipBootstrap: true, model: {primary: "ollama/" + model, fallbacks: []}, thinkingDefault: thinking,
        models: {["ollama/" + model]: {params: {temperature, seed: 42, num_predict: 4096, maxTokens: 4096}}}}},
      models: {mode: "replace", providers: {ollama: {baseUrl, api: "ollama", apiKey: "ollama-local", timeoutSeconds: deadlineSeconds,
        models: [{id: model, name: model, input: ["text"], reasoning: show.capabilities.includes("thinking"), contextWindow: 32768, maxTokens: 4096,
          params: {num_ctx: 32768, temperature, seed: 42, num_predict: 4096}}]}}},
      tools: {allow: html ? ["read", "edit"] : ["read"], fs: {workspaceOnly: true}, toolSearch: false},
      skills: {allowBundled: [], load: {extraDirs: skills.length ? [path.join(cwd, "skills")] : [], watch: false}},
      gateway: {mode: "local"}
    };
    fs.writeFileSync(config, JSON.stringify(settings, null, 2));
    const taskPath = path.join(cwd, filename);
    const task = html
      ? "Use edit to change only button padding to 12px and .buttons gap to 8px in the file. Preserve every other byte, including all comments, attributes, scripts and trailing text. Do not regenerate the HTML. When the two edits are complete, stop and briefly report the changed values."
      : "Do not modify files. Return only the exact contents of the file, without explanation or Markdown fences.";
    const trial = {id, skills, prompt: "Task file: " + JSON.stringify(taskPath) + ".\n" +
      "Read this file once using read with only the path argument. Do not reread it or look for configuration, documentation or other files. Complete the task immediately from the returned text.\n" + task,
      inputSha256: createHash("sha256").update(source).digest("hex")};
    fs.writeFileSync(path.join(home, "prompt.txt"), trial.prompt);
    const start = Date.now();
    try {
      record.openclaw ||= run(["--version"], cwd, config, state).stdout.trim();
      // allowBundled alone does not hide OpenClaw's custodian skills.
      const discovered = JSON.parse(run(["skills", "list", "--json"], cwd, config, state).stdout).skills;
      settings.skills.entries = isolatedSkillEntries(discovered, skills);
      fs.writeFileSync(config, JSON.stringify(settings, null, 2));
      trial.disabledSkillCount = discovered.length - skills.length;
      const inventory = JSON.parse(run(["skills", "list", "--json"], cwd, config, state).stdout).skills.filter(item => item.modelVisible).map(item => item.name).sort();
      assert.deepEqual(inventory, [...skills].sort(), "Unexpected model-visible skills");
      const execution = run(["agent", "exec", "--config", config, "--state-dir", state, "--cwd", cwd, "--model", "ollama/" + model, "--code-mode", "direct", "--thinking", thinking, "--timeout", String(deadlineSeconds), "--json", "--message-file", path.join(home, "prompt.txt")], cwd, config, state);
      trial.process = {exitCode: execution.status, stderr: redact(execution.stderr.slice(-2000))};
      const native = JSON.parse(redact(execution.stdout));
      trial.native = native;
      if (native.ok || native.model !== undefined) assert.equal(native.model, model, "Unexpected model or fallback");
      if (native.ok || native.provider !== undefined) assert.equal(native.provider, "ollama", "Unexpected provider");
      const actual = fs.readFileSync(taskPath, "utf8");
      if (!html) assert.equal(actual, source, "Control file changed");
      const expected = html ? source.replace("padding: 0", "padding: 12px").replace("gap: 0", "gap: 8px") : source;
      if (html) {
        trial.fileCalls = nativeFileCalls(state, native.sessionId);
        trial.output = actual; trial.outputSha256 = createHash("sha256").update(actual).digest("hex");
      }
      trial.checks = {...(html ? assessEditProbe(native, expected, actual, trial.fileCalls, taskPath) : assessReadProbe(native, expected)), processExitedSuccessfully: execution.status === 0};
      trial.passed = Object.values(trial.checks).every(Boolean);
      trial.commerceNonSelection = html ? (trial.checks.taskFileScope ? "native read/edit targets restricted to the task file and bootstrap AGENTS; no commerce documents" : "unverified or unrelated native file access") : "not applicable";
    } catch (error) { trial.error = redact(error.message); trial.passed = false; }
    trial.elapsedMs = Date.now() - start;
    record.trials.push(trial);
    if (id === "read-control" && !trial.passed) record.skipped = [{id: "frontend-scope", reason: "Control file probe failed; diagnose the client/model before further inference"}];
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(record, null, 2));
    console.log(JSON.stringify({id, passed: trial.passed, checks: trial.checks, error: trial.error, output}));
    if (record.skipped) break;
  }
  if (record.trials.some(trial => !trial.passed)) process.exitCode = 1;
}

if (require.main === module) {
  if (!process.argv[4]) { console.error("Usage: node scripts/probe-openclaw-model.js <openclaw.mjs> <http://127.0.0.1:port> <installed-model> [temperature=0] [thinking=off]"); process.exitCode = 1; }
  else probe(path.resolve(process.argv[2]), process.argv[3], process.argv[4], process.argv[5] === undefined ? 0 : Number(process.argv[5]), process.argv[6] || "off").catch(error => {console.error(error.message); process.exitCode = 1;});
}
module.exports = {localEndpoint, assessReadProbe, assessEditProbe, isolatedSkillEntries, probe};
