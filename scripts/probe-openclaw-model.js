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

function assessReadProbe(native, expected, html = false) {
  const final = native.final || "";
  const blocks = [...final.matchAll(/```html\s*\n([\s\S]*?)```/g)];
  const actual = html && blocks.length === 1 ? blocks[0][1] : final;
  const normalize = value => value.replaceAll("\r\n", "\n").replace(/\n$/, "");
  return {nativeOk: native.ok === true,
    readReportedWithoutError: native.toolSummary?.calls >= 1 && native.toolSummary.failures === 0 && native.toolSummary.tools?.length === 1 && native.toolSummary.tools[0] === "read",
    exactOutput: normalize(actual) === normalize(expected)};
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
  const record = {node: process.version, platform: process.platform, model, digest: installed.digest,
    ollama: (await json("/api/version")).version, requestedThinking: thinking, requestedOptions: {temperature, seed: 42, num_ctx: 32768, num_predict: 4096},
    scope: "Native local file-read/CSS probes; no payment or semantic commerce certification", trials: []};
  const env = {...process.env};
  for (const key of Object.keys(env)) if (/^(OPENCLAW_|OLLAMA_|OPENAI_|ANTHROPIC_|CLAUDE_|CURSOR_|GEMINI_|GOOGLE_API_KEY|AWS_|AZURE_)/.test(key)) delete env[key];
  const run = (args, cwd, config, state) => {
    const result = spawnSync(process.execPath, [cli, ...args], {cwd, env: {...env, OPENCLAW_CONFIG_PATH: config, OPENCLAW_STATE_DIR: state, OLLAMA_API_KEY: "ollama-local", NO_PROXY: "127.0.0.1,localhost"}, windowsHide: true, encoding: "utf8", timeout: 360000, maxBuffer: 4 * 1024 * 1024});
    assert.ifError(result.error);
    assert.equal(result.status, 0, "OpenClaw command failed: " + result.stderr.slice(-500));
    return result.stdout;
  };
  for (const id of ["read-control", "frontend-scope"]) {
    const home = path.join(fixture, id), cwd = path.join(home, "work"), state = path.join(home, "state"), config = path.join(home, "openclaw.json");
    fs.mkdirSync(cwd, {recursive: true});
    fs.mkdirSync(state);
    const nonce = "probe-" + randomBytes(16).toString("hex");
    const html = id === "frontend-scope";
    const source = html ? fs.readFileSync(path.join(repository, "benchmarks/fixtures/index.html"), "utf8") + "<!-- " + nonce + " -->\n" : nonce;
    const filename = html ? "index.html" : "marker.txt";
    fs.writeFileSync(path.join(cwd, filename), source);
    fs.writeFileSync(path.join(cwd, "AGENTS.md"), "Read only the supplied task files. Do not modify files.\n");
    const skills = html ? ["commerce-backend-expert", "commerce-review"] : [];
    for (const name of skills) fs.cpSync(path.join(repository, "skills", name), path.join(cwd, "skills", name), {recursive: true});
    fs.writeFileSync(config, JSON.stringify({
      agents: {defaults: {workspace: cwd, skipBootstrap: true, model: {primary: "ollama/" + model, fallbacks: []}, thinkingDefault: thinking,
        models: {["ollama/" + model]: {params: {temperature, seed: 42, num_predict: 4096, maxTokens: 4096}}}}},
      models: {mode: "replace", providers: {ollama: {baseUrl, api: "ollama", apiKey: "ollama-local", timeoutSeconds: 300,
        models: [{id: model, name: model, input: ["text"], reasoning: show.capabilities.includes("thinking"), contextWindow: 32768, maxTokens: 4096,
          params: {num_ctx: 32768, temperature, seed: 42, num_predict: 4096}}]}}},
      tools: {allow: ["read"], fs: {workspaceOnly: true}, toolSearch: false},
      skills: {allowBundled: [], load: {extraDirs: skills.length ? [path.join(cwd, "skills")] : [], watch: false}},
      gateway: {mode: "local"}
    }, null, 2));
    const trial = {id, skills, prompt: html ? "index.html의 button padding을 12px, .buttons gap을 8px로 바꾼 HTML을 보여줘. 나머지는 그대로 두고 파일은 저장하지 마." : "Read marker.txt with the file reader and return only its exact contents. Do not modify files.",
      inputSha256: createHash("sha256").update(source).digest("hex")};
    fs.writeFileSync(path.join(home, "prompt.txt"), trial.prompt);
    const start = Date.now();
    try {
      record.openclaw ||= run(["--version"], cwd, config, state).trim();
      // allowBundled alone does not hide OpenClaw's custodian skills.
      const discovered = JSON.parse(run(["skills", "list", "--json"], cwd, config, state)).skills;
      const settings = JSON.parse(fs.readFileSync(config, "utf8"));
      settings.skills.entries = isolatedSkillEntries(discovered, skills);
      fs.writeFileSync(config, JSON.stringify(settings, null, 2));
      trial.disabledSkillCount = discovered.length - skills.length;
      const inventory = JSON.parse(run(["skills", "list", "--json"], cwd, config, state)).skills.filter(item => item.modelVisible).map(item => item.name).sort();
      assert.deepEqual(inventory, [...skills].sort(), "Unexpected model-visible skills");
      const native = JSON.parse(run(["agent", "exec", "--config", config, "--state-dir", state, "--cwd", cwd, "--model", "ollama/" + model, "--code-mode", "direct", "--thinking", thinking, "--timeout", "300", "--json", "--message-file", path.join(home, "prompt.txt")], cwd, config, state));
      assert.equal(native.model, model, "Unexpected model or fallback");
      assert.equal(native.provider, "ollama", "Unexpected provider");
      assert.equal(fs.readFileSync(path.join(cwd, filename), "utf8"), source, "Input file changed");
      trial.native = native;
      const expected = html ? source.replace("padding: 0", "padding: 12px").replace("gap: 0", "gap: 8px") : source;
      trial.checks = assessReadProbe(native, expected, html);
      trial.passed = Object.values(trial.checks).every(Boolean);
      trial.commerceNonSelection = html ? (trial.passed && native.toolSummary?.calls === 1 ? "proved by one read plus exact hidden-marker output" : "unverified; tool paths require transcript review") : "not applicable";
    } catch (error) { trial.error = error.message.replaceAll(fixture, "<fixture>"); trial.passed = false; }
    trial.elapsedMs = Date.now() - start;
    record.trials.push(trial);
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify(record, null, 2));
    console.log(JSON.stringify({id, passed: trial.passed, checks: trial.checks, error: trial.error, output}));
  }
  if (record.trials.some(trial => !trial.passed)) process.exitCode = 1;
}

if (require.main === module) {
  if (!process.argv[4]) { console.error("Usage: node scripts/probe-openclaw-model.js <openclaw.mjs> <http://127.0.0.1:port> <installed-model> [temperature=0] [thinking=off]"); process.exitCode = 1; }
  else probe(path.resolve(process.argv[2]), process.argv[3], process.argv[4], process.argv[5] === undefined ? 0 : Number(process.argv[5]), process.argv[6] || "off").catch(error => {console.error(error.message); process.exitCode = 1;});
}
module.exports = {localEndpoint, assessReadProbe, isolatedSkillEntries};
