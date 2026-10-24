const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");

const repositoryRoot = path.resolve(__dirname, "..");
const skillRoot = path.join(repositoryRoot, "skills/commerce-backend-expert");

function temporaryDirectory(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, "commerce-test-"));
  t.after(() => {
    assert.equal(path.dirname(directory), parent);
    assert.ok(path.basename(directory).startsWith("commerce-test-"));
    assert.ok(!fs.lstatSync(directory).isSymbolicLink());
    fs.rmSync(directory, {recursive: true, force: true});
  });
  return directory;
}

function copySkill(destination) {
  fs.cpSync(skillRoot, destination, {recursive: true});
}

function repositoryFixture(t) {
  const destination = path.join(temporaryDirectory(t), "repository");
  // Only source paths: never copy .git, local profiles, credentials or output.
  for (const relative of ["skills", "hooks", "scripts", "tests", "benchmarks", "validation", "README.md", "README.ko.md", "CONTRIBUTING.md", "CONTRIBUTING.ko.md", "LICENSE", "package.json", "package-lock.json", "plugin.json", ".nvmrc", ".codex-plugin", ".claude-plugin", ".cursor-plugin", ".agents/plugins/marketplace.json", ".cursor/rules", ".openclaw/skills.example.json", ".github/workflows/ci.yml"]) {
    fs.mkdirSync(path.dirname(path.join(destination, relative)), {recursive: true});
    fs.cpSync(path.join(repositoryRoot, relative), path.join(destination, relative), {recursive: true});
  }
  return destination;
}

module.exports = {repositoryRoot, skillRoot, temporaryDirectory, copySkill, repositoryFixture};
