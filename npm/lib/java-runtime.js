const MIN_JAVA_MAJOR = 21;

const { spawnSync } = require("child_process");

function parseJavaMajor(output) {
  const text = String(output || "");
  const match = text.match(/version "([^"]+)"/) || text.match(/openjdk ([^\s]+)/i);
  if (!match) {
    return null;
  }
  const version = match[1];
  const major = version.startsWith("1.") ? version.split(".")[1] : version.split(".")[0];
  const parsed = Number(major);
  return Number.isFinite(parsed) ? parsed : null;
}

function javaStatus(executable, spawn = spawnSync) {
  const result = spawn(executable, ["-version"], { encoding: "utf8", timeout: 15_000, windowsHide: true });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const major = parseJavaMajor(output);
  return {
    ok: result.status === 0 && major !== null && major >= MIN_JAVA_MAJOR,
    major,
    output: output.trim(),
  };
}

module.exports = { parseJavaMajor, javaStatus };
