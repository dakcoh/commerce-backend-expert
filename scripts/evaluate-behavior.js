const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {createHash} = require("node:crypto");
const {spawn, spawnSync} = require("node:child_process");

// Explicit skill application, not an automatic-discovery or no-skill comparison.
function readFixture(value, cwd, roots) {
  const file = fs.realpathSync(path.resolve(cwd, value));
  const root = roots.find(item => file.startsWith(item.path + path.sep));
  assert.ok(root, "File outside evaluation roots");
  assert.ok(fs.statSync(file).isFile() && fs.statSync(file).size <= 65536, "File exceeds evaluation limit");
  const text = fs.readFileSync(file, "utf8");
  return {text, path: root.label + "/" + path.relative(root.path, file).replaceAll(path.sep, "/"), sha256: createHash("sha256").update(text).digest("hex")};
}

async function evaluate(codex, model, selected = []) {
  const repository = path.resolve(__dirname, "..");
  const cases = JSON.parse(fs.readFileSync(path.join(repository, "benchmarks/cases.json"), "utf8"));
  assert.ok(selected.every(id => cases.some(item => item.id === id)), "Unknown evaluation case");
  fs.mkdirSync(path.join(repository, "output"), {recursive: true});
  const output = fs.mkdtempSync(path.join(repository, "output/behavior-eval-"));
  const version = spawnSync(codex, ["--version"], {encoding: "utf8", windowsHide: true, timeout: 10000});
  assert.ifError(version.error); assert.equal(version.status, 0, "Codex version check failed");
  const listed = spawnSync(codex, ["plugin", "list", "--json"], {encoding: "utf8", windowsHide: true, timeout: 30000});
  assert.ifError(listed.error); assert.equal(listed.status, 0, "Plugin isolation check failed");
  const disabledPlugins = JSON.parse(listed.stdout).installed.map(plugin => plugin.pluginId);
  const overrides = disabledPlugins.flatMap(id => ["-c", "plugins." + JSON.stringify(id) + ".enabled=false"]);
  for (const item of cases.filter(item => !selected.length || selected.includes(item.id))) {
    const directory = path.join(output, item.id), cwd = path.join(directory, "work");
    const skill = path.join(directory, "skills", item.skill);
    fs.mkdirSync(cwd, {recursive: true});
    fs.cpSync(path.join(repository, "skills", item.skill), skill, {recursive: true});
    for (const file of item.files) fs.copyFileSync(path.join(repository, "benchmarks/fixtures", file), path.join(cwd, file));
    const roots = [{path: fs.realpathSync(cwd), label: "workspace"}, {path: fs.realpathSync(skill), label: "skills/" + item.skill}];
    const entry = readFixture(path.join(skill, "SKILL.md"), cwd, roots);
    const record = {id: item.id, prompt: item.prompt, skill: item.skill, skillSha256: entry.sha256,
      cli: version.stdout.trim(), effort: "medium", explicitSkill: true, skillDelivery: "exact SKILL.md in developerInstructions", pluginDisableOverrideCount: disabledPlugins.length, blockedReads: 0, reads: [], messages: [], unexpectedTools: [], startedAt: new Date().toISOString()};
    const startedAt = Date.now();
    const child = spawn(codex, ["app-server", "--stdio", "-c", "features.shell_tool=false", "-c", 'web_search="disabled"', ...overrides], {cwd, windowsHide: true, stdio: ["pipe", "pipe", "pipe"]});
    let buffer = "", sequence = 0, complete;
    const pending = new Map();
    const send = value => child.stdin.write(JSON.stringify({jsonrpc: "2.0", ...value}) + "\n");
    const request = (method, params) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, {resolve, reject}); send({id, method, params}); });
    const done = new Promise((resolve, reject) => { complete = {resolve, reject}; });
    // Attach immediately so process errors are handled even before the turn starts.
    done.catch(() => {});
    const fail = error => { for (const call of pending.values()) call.reject(error); pending.clear(); complete.reject(error); };
    const timer = setTimeout(() => { fail(Error("Evaluation deadline exceeded")); child.kill(); }, 180000);
    child.once("error", fail);
    child.once("exit", code => { if (record.status !== "completed") fail(Error("App server exited: " + code)); });
    child.stdin.on("error", fail);
    child.stderr.on("data", bytes => fs.appendFileSync(path.join(directory, "client.stderr"), bytes));
    function receive(event) {
      if (pending.has(event.id)) {
        const call = pending.get(event.id); pending.delete(event.id);
        event.error ? call.reject(Error(event.error.message)) : call.resolve(event.result); return;
      }
      if (event.method === "item/tool/call") {
        try {
          assert.equal(event.params.tool, "read_file", "Unknown evaluation tool");
          const args = typeof event.params.arguments === "string" ? JSON.parse(event.params.arguments) : event.params.arguments;
          const read = readFixture(args.path, cwd, roots);
          record.reads.push({path: read.path, sha256: read.sha256});
          send({id: event.id, result: {success: true, contentItems: [{type: "inputText", text: read.text}]}});
        } catch {
          record.blockedReads++;
          send({id: event.id, result: {success: false, contentItems: [{type: "inputText", text: "File unavailable in this read-only fixture."}]}});
        }
      } else if (event.method === "item/completed") {
        if (event.params.item.type === "agentMessage") record.messages.push(event.params.item.text);
        if (["commandExecution", "fileChange", "mcpToolCall", "webSearch", "collabAgentToolCall"].includes(event.params.item.type)) record.unexpectedTools.push(event.params.item.type);
      } else if (event.method === "thread/tokenUsage/updated") record.tokenUsage = event.params.tokenUsage;
      else if (event.method === "turn/completed") { record.status = event.params.turn.status; record.error = event.params.turn.error; complete.resolve(); }
      else if (event.id !== undefined) send({id: event.id, error: {code: -32601, message: "Unsupported evaluation request"}});
    }
    child.stdout.on("data", bytes => {
      buffer += bytes;
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (line.trim()) { try { receive(JSON.parse(line)); } catch (error) { fail(error); child.kill(); } }
      }
    });
    try {
      await request("initialize", {clientInfo: {name: "commerce_skill_evaluation", version: "1.0.0"}, capabilities: {experimentalApi: true}});
      send({method: "initialized"});
      const thread = await request("thread/start", {cwd, ephemeral: true, sandbox: "read-only", approvalPolicy: "never", ...(model ? {model} : {}),
        baseInstructions: "You are a coding assistant evaluating the supplied skill on a synthetic task. Use only read_file for the provided workspace and skill directory. Do not use shell, network, other tools, other skills, file writes or subagents. Answer in Korean.",
        config: {developer_instructions: ""},
        developerInstructions: entry.text + "\n\nThe skill directory for relative resource paths is " + skill + ". The task files are in " + cwd + ".",
        dynamicTools: [{type: "function", name: "read_file", description: "Read a UTF-8 file inside the fixture or selected skill directory.", inputSchema: {type: "object", properties: {path: {type: "string"}}, required: ["path"], additionalProperties: false}}]});
      record.model = thread.model; record.provider = thread.modelProvider;
      record.otherInstructionSourceCount = thread.instructionSources?.length || 0;
      await request("turn/start", {threadId: thread.thread.id, effort: "medium", input: [{type: "text", text: item.prompt}]});
      await done;
      assert.equal(record.status, "completed", "Incomplete model turn");
      assert.deepEqual(record.unexpectedTools, [], "Unexpected tool use; inspect before accepting this run");
      assert.ok(record.messages.length, "Missing model answer");
      for (const text of record.messages) assert.ok(text.trim());
    } catch (error) {
      record.status ||= "failed";
      record.clientError = error.message;
      throw error;
    } finally {
      clearTimeout(timer); child.kill();
      record.elapsedMs = Date.now() - startedAt;
      const sanitize = value => value.replaceAll(directory, "<fixture>").replaceAll(repository, "<repository>");
      fs.writeFileSync(path.join(directory, "result.json"), JSON.stringify(record, (key, value) => typeof value === "string" ? sanitize(value) : value, 2) + "\n");
      fs.writeFileSync(path.join(directory, "answer.md"), sanitize(record.messages.join("\n\n")) + "\n");
    }
    console.log(JSON.stringify({id: item.id, status: record.status, model: record.model, reads: record.reads.length, output: directory}));
  }
  return output;
}

if (require.main === module) {
  if (!process.argv[2]) { console.error("Usage: node scripts/evaluate-behavior.js <codex executable> [model|-] [case IDs...]"); process.exitCode = 1; }
  else evaluate(process.argv[2], process.argv[3] === "-" ? undefined : process.argv[3], process.argv.slice(4)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = {readFixture};
