const MIN_JAVA_MAJOR = 21;

const { spawnSync } = require("child_process");
const path = require("node:path");

function javaExecutable(executable, spawn = spawnSync, platform = process.platform) {
  if (platform !== "win32" || /^[\x20-\x7e]+$/.test(executable)) return executable;
  // The Windows Java launcher also resolves java.dll through the system codepage.
  const script = `Add-Type -TypeDefinition 'using System; using System.Text; using System.Runtime.InteropServices;
    public class RuntimePath { [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
      public static extern uint GetShortPathName(string path, StringBuilder output, uint size); }';
    $buffer = New-Object System.Text.StringBuilder 32768;
    $length = [RuntimePath]::GetShortPathName($env:COMMERCE_RUNTIME_LONG_PATH, $buffer, 32768);
    if ($length -eq 0 -or $length -ge 32768) { exit 1 }; [Console]::Write($buffer.ToString());`;
  const result = spawn(path.join(process.env.SystemRoot || "C:\\Windows", "System32/WindowsPowerShell/v1.0/powershell.exe"),
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
      env: {...process.env, COMMERCE_RUNTIME_LONG_PATH: executable},
      encoding: "utf8", timeout: 15_000, windowsHide: true,
    });
  const short = (result.stdout || "").trim();
  if (result.status !== 0 || !path.win32.isAbsolute(short) || !/^[\x20-\x7e]+$/.test(short)) {
    throw new Error("Cannot launch managed Java from this Windows Unicode path. Set COMMERCE_CONTEXT_CACHE_DIR to a private writable ASCII-only path; 8.3 short names are unavailable.");
  }
  return short;
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

module.exports = { parseJavaMajor, javaStatus, javaExecutable };
