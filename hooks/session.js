const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {createHash, randomUUID} = require("node:crypto");

function handleEvent(event, options = {}) {
  const type = event?.hook_event_name;
  if (!["SessionStart", "UserPromptSubmit"].includes(type)) return null;
  const command = type === "UserPromptSubmit" && typeof event.prompt === "string"
    ? /^commerce (on|off|status)$/i.exec(event.prompt.trim())?.[1].toLowerCase() : null;
  if (type === "UserPromptSubmit" && !command) return null;
  if (typeof event.session_id !== "string" || !event.session_id.trim() ||
      typeof event.cwd !== "string" || !path.isAbsolute(event.cwd)) throw Error("Invalid session identity");

  const pluginRoot = options.pluginRoot || path.resolve(__dirname, "..");
  const dataRoot = options.dataRoot || process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), "commerce-backend-expert");
  if (!path.isAbsolute(dataRoot)) throw Error("Invalid state directory");
  const cwd = process.platform === "win32" ? path.resolve(event.cwd).toLowerCase() : path.resolve(event.cwd);
  const key = createHash("sha256").update(cwd + "\0" + event.session_id).digest("hex");
  const directory = path.join(dataRoot, "sessions"), file = path.join(directory, key + ".json");
  let enabled = true;
  if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw Error("Invalid state directory");
  if (fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > 128) throw Error("Invalid session state");
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (typeof state.enabled !== "boolean") throw Error("Invalid session state");
    enabled = state.enabled;
  }
  if (command === "on" || command === "off") {
    enabled = command === "on";
    fs.mkdirSync(directory, {recursive: true, mode: 0o700});
    const temporary = path.join(directory, key + "." + randomUUID() + ".tmp");
    try {
      fs.writeFileSync(temporary, JSON.stringify({enabled}), {flag: "wx", mode: 0o600});
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  let context = enabled ? "COMMERCE MODE ON — 커머스 요청에만 자동 적용한다." :
    "COMMERCE MODE OFF — 이 플러그인의 자동 지침·규칙 조회를 중단한다. 사용자가 개별 스킬을 명시하면 그 요청 범위에서만 적용한다.";
  if (enabled && command !== "status") {
    const entry = path.join(pluginRoot, "skills/commerce-backend-expert/SKILL.md");
    const review = path.join(pluginRoot, "skills/commerce-review/SKILL.md");
    if (!fs.existsSync(entry) || !fs.existsSync(review)) throw Error("Missing skill entry");
    context += "\n결제·환불 코드 리뷰는 " + JSON.stringify(review) + "를 읽는다." +
      "\n그 외 한국 이커머스 설계·구현·리팩터링·장애 분석은 " + JSON.stringify(entry) + "를 읽는다." +
      "\n관련 스킬만 읽고 문맥의 문서는 재조회하지 않는다. 일반 화면 스타일·마케팅에는 적용하지 않는다. 사용자 지시를 우선한다.";
  }
  context += "\n이 세션의 제어 명령은 일반 메시지 commerce on / commerce off / commerce status 이다.";
  if (Buffer.byteLength(context) > 8192) throw Error("Context exceeds limit");
  return {hookSpecificOutput: {hookEventName: type, additionalContext: context}};
}

async function main() {
  try {
    const raw = await new Promise((resolve, reject) => {
      let input = "", bytes = 0;
      const timer = setTimeout(() => { process.stdin.destroy(); reject(Error("Input timeout")); }, 2000);
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", chunk => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > 65536) { clearTimeout(timer); process.stdin.destroy(); reject(Error("Input too large")); }
        else input += chunk;
      });
      process.stdin.on("end", () => { clearTimeout(timer); resolve(input); });
      process.stdin.on("error", () => { clearTimeout(timer); reject(Error("Input unavailable")); });
    });
    const result = handleEvent(JSON.parse(raw));
    if (result) process.stdout.write(JSON.stringify(result) + "\n");
  } catch {
    process.stderr.write("Commerce session hook skipped: invalid input, unavailable state, or missing skill.\n");
  }
}

if (require.main === module) main();
module.exports = {handleEvent, main};
