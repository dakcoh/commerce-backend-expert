const MIN_JAVA_MAJOR = 21;

const { spawnSync } = require("child_process");
const path = require("node:path");
const {privateWorkspaceRoot} = require("./workspace");

function javaDirectory(home) {
  if (process.platform !== "win32" || /^[\x20-\x7e]+$/.test(home)) return home;
  const fs = require("node:fs"), {createHash} = require("node:crypto");
  const root = privateWorkspaceRoot("java");
  const alias = path.join(root, createHash("sha256").update(home).digest("hex"));
  try { fs.symlinkSync(home, alias, "junction"); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  if (!fs.lstatSync(alias).isSymbolicLink() || fs.realpathSync(alias) !== fs.realpathSync(home)) {
    throw new Error("Runtime alias does not point to the verified installation");
  }
  return alias;
}

function javaExecutable(executable) {
  return path.join(javaDirectory(path.dirname(path.dirname(executable))), "bin", path.basename(executable));
}

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

module.exports = { parseJavaMajor, javaStatus, javaExecutable, javaDirectory };
