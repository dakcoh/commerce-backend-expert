const fs = require("node:fs");
const path = require("node:path");
const {validateRepository} = require("../scripts/validate-skills");

function validateEdit(event, root = path.resolve(__dirname, "..")) {
  const file = event?.tool_input?.file_path ?? event?.file_path;
  if (typeof file !== "string" || !path.isAbsolute(file)) return {checked: false};
  root = path.resolve(root);
  const target = path.resolve(file), skill = path.join(root, "skills", "commerce-backend-expert");
  if (!target.startsWith(skill + path.sep) || !target.endsWith(".md")) return {checked: false};
  if (fs.existsSync(target) && !fs.realpathSync(target).startsWith(fs.realpathSync(skill) + path.sep)) throw Error("Knowledge edit escapes skill directory");
  const result = validateRepository(root);
  return {checked: true, rules: result.rules.length};
}

async function main() {
  let input = "", bytes = 0;
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 64 * 1024) throw Error("Hook input exceeds 64 KiB");
    input += chunk;
  }
  let event;
  try { event = JSON.parse(input); } catch { throw Error("Invalid hook JSON"); }
  validateEdit(event);
}

if (require.main === module) main().catch(error => {
  console.error("Commerce knowledge validation: " + error.message);
  process.exitCode = 1;
});

module.exports = {validateEdit};
