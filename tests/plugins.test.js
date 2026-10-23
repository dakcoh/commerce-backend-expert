const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const {validateRepository} = require("../scripts/validate-skills");
const {skillRoot: root, repositoryFixture} = require("./helpers");

test("repository rejects retired runtime paths and broken user documentation", t => {
  const isolated = repositoryFixture(t);
  assert.equal(validateRepository(isolated).rules.length, 70);
  for (const relative of ["src", "npm", "build.gradle.kts", ".mcp.json"]) {
    const file = path.join(isolated, relative); fs.writeFileSync(file, "legacy");
    assert.throws(() => validateRepository(isolated), /Removed runtime path returned/); fs.unlinkSync(file);
  }
  fs.appendFileSync(path.join(isolated, "README.md"), "\n[missing](missing.md)\n");
  assert.throws(() => validateRepository(isolated), /ENOENT/);
});

test("clients share canonical skills and cannot silently enable developer hooks or YAML knowledge", t => {
  const isolated = repositoryFixture(t), file = path.join(isolated, ".cursor-plugin/plugin.json");
  const original = fs.readFileSync(file, "utf8"), manifest = JSON.parse(original);
  manifest.skills = "./copied-skills/"; fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => validateRepository(isolated), /canonical skills/);
  manifest.skills = "./skills/"; manifest.hooks = "./hooks/cursor.json"; fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => validateRepository(isolated), /must not run by default/);
  fs.writeFileSync(file, original);
  fs.writeFileSync(path.join(isolated, "skills/commerce-backend-expert/references/payment/extra.yml"), "rules: []");
  assert.throws(() => validateRepository(isolated), /only Markdown knowledge/);
});

test("review links stay inside their own skill and lifecycle manifests exclude edit validation", t => {
  const isolated = repositoryFixture(t), review = path.join(isolated, "skills/commerce-review/SKILL.md");
  assert.equal(validateRepository(isolated).skills, 2);
  fs.appendFileSync(review, "\n[outside](../commerce-backend-expert/SKILL.md)\n");
  assert.throws(() => validateRepository(isolated), /escapes skill/);
  fs.writeFileSync(review, fs.readFileSync(path.resolve(root, "../commerce-review/SKILL.md")));
  const file = path.join(isolated, ".codex-plugin/plugin.json"), manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  manifest.hooks = "./hooks/claude.json"; fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => validateRepository(isolated), /session hooks only/);
});

test("the portable schema marker cannot silently hide hooks in Codex CLI 0.153.2", t => {
  const isolated = repositoryFixture(t), file = path.join(isolated, "plugin.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  manifest.$schema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
  fs.writeFileSync(file, JSON.stringify(manifest));
  assert.throws(() => validateRepository(isolated), /hook discovery requires omitting the portable schema marker/);
});

test("public marketplaces install the canonical plugin from the repository root", t => {
  const isolated = repositoryFixture(t);
  for (const relative of [".agents/plugins/marketplace.json", ".claude-plugin/marketplace.json"]) {
    const file = path.join(isolated, relative), original = fs.readFileSync(file, "utf8"), catalog = JSON.parse(original);
    catalog.plugins[0].source = "./missing"; fs.writeFileSync(file, JSON.stringify(catalog));
    assert.throws(() => validateRepository(isolated), /Marketplace must install the repository root/);
    fs.writeFileSync(file, original);
  }
});

test("client repository URLs follow the canonical renamed repository", t => {
  const isolated = repositoryFixture(t);
  for (const client of ["codex", "claude", "cursor"]) {
    const file = path.join(isolated, `.${client}-plugin/plugin.json`), original = fs.readFileSync(file, "utf8");
    const manifest = JSON.parse(original); manifest.repository = "https://github.com/dakcoh/commerce-context-mcp";
    fs.writeFileSync(file, JSON.stringify(manifest));
    assert.throws(() => validateRepository(isolated), new RegExp(`${client}: inconsistent repository`));
    fs.writeFileSync(file, original);
  }
});

test("developer scripts and hooks work inside an ES module host project", t => {
  const isolated = repositoryFixture(t);
  for (const relative of ["scripts/validate-skills.js", "hooks/validate-knowledge.js"]) {
    fs.mkdirSync(path.dirname(path.join(isolated, relative)), {recursive: true});
    fs.copyFileSync(path.resolve(__dirname, "..", relative), path.join(isolated, relative));
  }
  fs.writeFileSync(path.join(path.dirname(isolated), "package.json"), '{"type":"module"}');
  const env = {...process.env, NODE_PATH: path.resolve(__dirname, "../node_modules")};
  const validation = spawnSync(process.execPath, [path.join(isolated, "scripts/validate-skills.js")], {cwd: isolated, env, encoding: "utf8", windowsHide: true, timeout: 10000});
  assert.ifError(validation.error); assert.equal(validation.status, 0, validation.stderr);
  const hook = spawnSync(process.execPath, [path.join(isolated, "hooks/validate-knowledge.js")], {cwd: isolated, env, input: JSON.stringify({file_path: path.join(isolated, "skills/commerce-backend-expert/SKILL.md")}), encoding: "utf8", windowsHide: true, timeout: 10000});
  assert.ifError(hook.error); assert.equal(hook.status, 0, hook.stderr); assert.equal(hook.stdout, "");
});
