const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");

function safeName(name) {
  if (!/^[A-Za-z0-9_.$+@/-]+$/.test(name) || name.startsWith("/") ||
      name.split("/").some(part => part.endsWith(".") || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)) || name.includes("//")) {
    throw new Error(`Unsafe runtime archive path: ${name}`);
  }
  return name.replace(/\/$/, "");
}

// Validate the complete tree before tar can write anything, including link ancestors.
function validateEntries(names, listing, root) {
  const files = names.trimEnd().split(/\r?\n/);
  const rows = listing.trimEnd().split(/\r?\n/);
  if (!files.length || files.length !== rows.length) throw new Error("Invalid runtime archive listing");
  const entries = new Map();
  const folded = new Set();
  files.forEach((name, index) => {
    const clean = safeName(name);
    if (clean !== root && !clean.startsWith(`${root}/`)) throw new Error("Unexpected runtime archive root");
    if (folded.has(clean.toLowerCase())) throw new Error(`Duplicate runtime archive path: ${name}`);
    folded.add(clean.toLowerCase());
    const row = rows[index], type = row[0];
    let target;
    if (type === "l") {
      const marker = ` ${name} -> `;
      const at = row.lastIndexOf(marker);
      if (at < 0) throw new Error("Invalid runtime symlink listing");
      const link = row.slice(at + marker.length);
      if (!/^[A-Za-z0-9_.$+@/-]+$/.test(link) || link.startsWith("/")) throw new Error("Unsafe runtime symlink");
      target = path.posix.normalize(path.posix.join(path.posix.dirname(clean), link));
      if (!target.startsWith(`${root}/`)) throw new Error("Runtime symlink escapes root");
    } else if (!["-", "d"].includes(type) || !row.endsWith(` ${name}`)) {
      throw new Error(`Unsupported runtime archive entry: ${name}`);
    }
    entries.set(clean, {type, target});
  });
  for (const [name, entry] of entries) {
    for (let parent = path.posix.dirname(name); parent !== "."; parent = path.posix.dirname(parent)) {
      if (entries.get(parent)?.type !== "d") throw new Error(`Unsafe runtime archive ancestor: ${parent}`);
    }
    if (entry.type === "l" && entries.get(entry.target)?.type !== "-") throw new Error("Runtime link must point to a regular file");
  }
  return entries;
}

function extractRuntime(archive, destination, info, timeoutMs = 90_000) {
  const tar = process.platform === "win32" ? path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe") : "tar";
  const env = {...process.env, LC_ALL: "C", LANG: "C"};
  delete env.TAR_OPTIONS;
  const options = {cwd: path.dirname(archive), env, encoding: "utf8", timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024, windowsHide: true};
  try {
    const file = path.basename(archive);
    const deadline = Date.now() + timeoutMs;
    const remaining = () => {
      if (Date.now() >= deadline) throw new Error("Runtime extraction timed out");
      return {...options, timeout: deadline - Date.now()};
    };
    const names = execFileSync(tar, ["-tf", file], remaining());
    const listing = execFileSync(tar, ["-tvf", file], remaining());
    validateEntries(names, listing, info.java.split("/")[0]);
    fs.mkdirSync(destination);
    // Windows tar can mangle Unicode arguments under a different system codepage; cwd uses the wide OS API.
    execFileSync(tar, ["-xf", path.relative(destination, archive), "--no-same-owner", "--no-same-permissions"],
      {...remaining(), cwd: destination});
  } catch (error) {
    throw new Error(`Cannot extract Java runtime (tar is required): ${error.message}`, {cause: error});
  }
}

module.exports = {extractRuntime, validateEntries};
