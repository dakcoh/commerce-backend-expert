const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function privateWorkspaceRoot(name) {
  // Avoid supplementary characters in TEMP without rejecting a usable Korean user profile.
  const temporary = os.tmpdir();
  const base = /^[\x20-\x7e]+$/.test(temporary) ? temporary : os.homedir();
  const root = path.join(base, `.commerce-context-mcp-${name}${process.getuid ? `-${process.getuid()}` : ""}`);
  fs.mkdirSync(root, {recursive: true, mode: 0o700});
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink() ||
      (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o077)))) {
    throw new Error("Java workspace root must be a private directory owned by the current user");
  }
  return root;
}

module.exports = {privateWorkspaceRoot};
