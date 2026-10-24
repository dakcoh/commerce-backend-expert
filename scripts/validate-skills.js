const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {parseDocument} = require("yaml");

const skillRoot = path.resolve(__dirname, "../skills/commerce-backend-expert");
const repositoryRoot = path.resolve(__dirname, "..");
const domains = ["commerce", "coupon", "inventory", "payment", "settlement", "spring-commerce"];
const metadata = ["id", "domain", "category", "severity", "status", "evidenceLevel", "owner", "verifiedBy", "lastReviewedAt", "changeNote", "jurisdiction"];
const sectionNames = {
  guidance: "구현 가이드", invariants: "반드시 지켜야 할 원칙", workflow: "권장 흐름",
  "technical-guidance": "기술 구현 참고", "spring-guidance": "Java Spring 구현 가이드",
  "avoid-patterns": "피해야 할 패턴", "failure-scenarios": "실패 시나리오",
};
const textNames = {summary: "요약", rationale: "판단 근거", content: "업무 맥락"};
const listNames = {appliesWhen: "적용 조건", doesNotApplyWhen: "적용하지 않는 조건", assumptions: "전제", checklist: "검토 체크리스트", tags: "태그", aliases: "검색 표현", relatedRuleIds: "관련 규칙"};
const evidenceKeys = ["source", "type", "sourceVersion", "publishedAt", "reviewedAt", "accessedAt", "note"];
const requiredSections = {
  commerce: ["invariants", "workflow", "technical-guidance", "failure-scenarios"],
  "spring-commerce": ["spring-guidance", "avoid-patterns"],
};

function withoutFences(text) {
  let marker = "", length = 0;
  return text.split("\n").map(line => {
    const match = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (match) {
      if (!marker) { marker = match[1][0]; length = match[1].length; }
      else if (match[1][0] === marker && match[1].length >= length && !match[2].trim()) marker = "";
      return "";
    }
    return marker ? "" : line;
  }).join("\n");
}

function blocks(text, prefix) {
  const visible = withoutFences(text).split("\n"), original = text.split("\n");
  const result = new Map(); let key = "", lines = [];
  const flush = () => { assert.ok(!result.has(key), `Duplicate heading: ${key}`); result.set(key, lines.join("\n").trim()); };
  for (let i = 0; i < original.length; i++) {
    if (visible[i].startsWith(prefix)) { flush(); key = visible[i].slice(prefix.length); lines = []; }
    else lines.push(original[i]);
  }
  flush(); return result;
}

function pairs(text, keys) {
  const result = {}; let key;
  for (const line of text.split("\n")) {
    const match = /^- ([a-zA-Z]+): (.*)$/.exec(line);
    if (match) {
      key = match[1]; assert.ok(keys.includes(key), `Unknown metadata: ${key}`);
      assert.ok(!(key in result), `Duplicate metadata: ${key}`); result[key] = match[2];
    } else if (line.startsWith("  ") && key) result[key] += "\n" + line.slice(2);
    else assert.ok(!line.trim(), `Invalid metadata: ${line}`);
  }
  assert.deepEqual(Object.keys(result).sort(), [...keys].sort(), "Missing metadata");
  return result;
}

function items(text = "") {
  if (!text) return [];
  const result = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) result.push(line.slice(2).replace(/^\[ \] /, ""));
    else if (line.startsWith("  ") && result.length) result[result.length - 1] += "\n" + line.slice(2);
    else throw Error(`Invalid list item: ${line}`);
  }
  assert.ok(result.every(item => item.trim()), "Empty list item"); return result;
}

function parseRule(text) {
  const sections = blocks(text.replaceAll("\r\n", "\n"), "## ");
  const header = sections.get("") || "", title = /^# (.+)\n\n/.exec(header);
  assert.ok(title, "Rule title is required");
  const fields = pairs(header.slice(title[0].length), metadata);
  for (const heading of ["적용 조건", "적용하지 않는 조건", "전제"]) {
    assert.ok(sections.has(heading), `${fields.id}: missing ${heading}`);
  }
  const rule = {id: fields.id, domain: fields.domain, category: fields.category, title: title[1],
    severity: fields.severity, status: fields.status, evidenceLevel: fields.evidenceLevel, owner: fields.owner};
  for (const key of ["verifiedBy", "lastReviewedAt", "changeNote"]) rule[key] = fields[key] === "not-recorded" ? null : fields[key];
  rule.applicability = {jurisdiction: fields.jurisdiction};
  for (const [key, name] of Object.entries(textNames)) rule[key] = sections.get(name) || "";
  // Keep parsed migration records stable when a repeated rationale is omitted.
  rule.rationale ||= rule.content || rule.summary;
  for (const [key, name] of Object.entries(listNames)) {
    const values = items(sections.get(name));
    if (["appliesWhen", "doesNotApplyWhen", "assumptions"].includes(key)) rule.applicability[key] = values;
    else if (key === "relatedRuleIds") rule[key] = values.map(value => {
      const match = /^\[([a-z0-9-]+)\]\(\.\.\/([a-z-]+)\/\1\.md\)$/.exec(value);
      assert.ok(match, `Invalid related rule link: ${value}`); return match[1];
    });
    else rule[key] = values;
  }
  rule.sections = {};
  for (const [key, name] of Object.entries(sectionNames)) if (sections.has(name)) rule.sections[key] = items(sections.get(name));
  rule.evidence = [];
  if (sections.has("출처")) {
    const entries = blocks(sections.get("출처"), "### "); assert.equal(entries.get(""), "");
    for (const [title, body] of entries) {
      if (!title) continue;
      const evidence = {title, ...pairs(body, evidenceKeys)};
      for (const key of ["publishedAt", "reviewedAt", "accessedAt"]) if (evidence[key] === "not-recorded") evidence[key] = null;
      for (const key of ["sourceVersion", "note"]) if (evidence[key] === "not-recorded") evidence[key] = "";
      rule.evidence.push(evidence);
    }
  }
  const known = new Set(["", ...Object.values(textNames), ...Object.values(listNames), ...Object.values(sectionNames), "출처"]);
  for (const heading of sections.keys()) assert.ok(known.has(heading), `Unknown rule section: ${heading}`);
  return rule;
}

function validateDate(value, today) {
  if (value === null) return;
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
  const date = new Date(value + "T00:00:00Z");
  assert.ok(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value, `Invalid date: ${value}`);
  assert.ok(value <= today, `Future date: ${value}`);
}

function validateRules(rules, today = new Intl.DateTimeFormat("sv-SE", {timeZone: "Asia/Seoul"}).format(new Date())) {
  const ids = new Set();
  for (const rule of rules) {
    assert.match(rule.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/); assert.ok(!ids.has(rule.id), `Duplicate rule: ${rule.id}`); ids.add(rule.id);
    assert.ok(domains.includes(rule.domain), `Unknown domain: ${rule.domain}`);
    for (const key of ["title", "category", "summary", "rationale", "owner"]) assert.ok(rule[key].trim(), `${rule.id}: missing ${key}`);
    assert.ok(["info", "low", "medium", "high", "critical"].includes(rule.severity));
    assert.ok(["active", "needs-review", "deprecated"].includes(rule.status));
    assert.ok(rule.applicability.appliesWhen.length && rule.applicability.jurisdiction.trim(), `${rule.id}: missing applicability`);
    assert.ok(rule.applicability.assumptions.length, `${rule.id}: missing assumptions`);
    assert.ok(rule.tags.length && rule.checklist.length, `${rule.id}: missing tags/checklist`);
    if (rule.category !== "checklist") {
      for (const section of requiredSections[rule.domain] || ["guidance", "avoid-patterns"]) {
        assert.ok(rule.sections[section]?.length, `${rule.id}: missing ${section}`);
      }
      if (requiredSections[rule.domain]) assert.ok(rule.content.trim(), `${rule.id}: missing content`);
    }
    assert.ok(rule.evidence.length, `${rule.id}: missing evidence`);
    validateDate(rule.lastReviewedAt, today);
    if (rule.verifiedBy || rule.lastReviewedAt || rule.changeNote) assert.ok(rule.verifiedBy?.trim() && rule.lastReviewedAt && rule.changeNote?.trim(), `${rule.id}: incomplete review`);
    for (const evidence of rule.evidence) {
      assert.ok(evidence.title.trim() && evidence.source.trim() && evidence.type.trim(), `${rule.id}: incomplete evidence`);
      for (const key of ["publishedAt", "reviewedAt", "accessedAt"]) validateDate(evidence[key], today);
      if (/^[a-z]+:/i.test(evidence.source)) assert.match(evidence.source, /^https?:\/\//, "Unsafe evidence URL");
      if (/^https?:\/\//.test(evidence.source)) { const url = new URL(evidence.source); assert.ok(url.hostname && !url.username && !url.password && evidence.accessedAt, `${rule.id}: external source needs access date`); }
    }
    const external = rule.evidence.some(item => /^https?:\/\//.test(item.source) && !["project-guidance", "internal-reference"].includes(item.type));
    assert.equal(rule.evidenceLevel, external ? "external-source" : "project-guidance", `${rule.id}: inconsistent evidence level`);
    if (["high", "critical"].includes(rule.severity) && !rule.verifiedBy) assert.notEqual(rule.status, "active", `${rule.id}: unreviewed high risk marked active`);
  }
  for (const rule of rules) for (const related of rule.relatedRuleIds) assert.ok(ids.has(related), `${rule.id}: unknown related rule ${related}`);
}

function validateLinks(file, root) {
  const text = withoutFences(fs.readFileSync(file, "utf8")); let links = 0;
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const link = match[1]; if (/^https?:\/\//.test(link)) continue;
    assert.ok(!/^[a-z]+:/i.test(link), `Unsafe link: ${link}`);
    const [relative, fragment] = link.split("#");
    const target = relative ? path.resolve(path.dirname(file), decodeURIComponent(relative)) : file;
    assert.ok(target.startsWith(root + path.sep), `Link escapes skill: ${link}`);
    const real = fs.realpathSync(target); assert.ok(real.startsWith(fs.realpathSync(root) + path.sep), `Link escapes skill: ${link}`);
    if (fragment) {
      assert.ok(fs.statSync(target).isFile(), `Anchor target is not a file: ${link}`);
      const slugs = new Set(), counts = new Map();
      for (const heading of withoutFences(fs.readFileSync(target, "utf8")).matchAll(/^#{1,6} (.+)$/gm)) {
        const slug = heading[1].trim().toLowerCase().replace(/<[^>]*>/g, "").replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "").replace(/\s/g, "-");
        const count = counts.get(slug) || 0; counts.set(slug, count + 1); slugs.add(slug + (count ? "-" + count : ""));
      }
      assert.ok(slugs.has(decodeURIComponent(fragment)), `Missing anchor: ${link}`);
    }
    links++;
  }
  return links;
}

function validateFrontmatter(text, expectedName) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  assert.ok(match, "Skill YAML frontmatter is required");
  const document = parseDocument(match[1], {schema: "core", uniqueKeys: true});
  assert.equal(document.errors.length, 0, "Invalid skill YAML: " + document.errors.map(error => error.message).join("; "));
  const fields = document.toJS({maxAliasCount: 10});
  assert.ok(fields && typeof fields === "object" && !Array.isArray(fields), "Skill frontmatter must be a mapping");
  const allowed = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
  for (const key of Object.keys(fields)) assert.ok(allowed.includes(key), `Unknown skill field: ${key}`);
  for (const [key, maximum] of [["name", 64], ["description", 1024], ["license", Infinity], ["compatibility", 500], ["allowed-tools", Infinity]]) {
    if (!["name", "description"].includes(key) && !(key in fields)) continue;
    assert.ok(typeof fields[key] === "string" && fields[key].trim() && fields[key].length <= maximum, `Invalid skill ${key}: expected a nonempty string within ${maximum} characters`);
  }
  assert.match(fields.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(fields.name, expectedName, "Skill name must match its directory");
  if ("metadata" in fields) {
    assert.ok(fields.metadata && typeof fields.metadata === "object" && !Array.isArray(fields.metadata), "Skill metadata must be a string mapping");
    assert.ok(Object.values(fields.metadata).every(value => typeof value === "string"), "Skill metadata values must be strings");
  }
  return fields;
}

function validateSkill(root = skillRoot) {
  root = path.resolve(root);
  const entry = path.join(root, "SKILL.md"), text = fs.readFileSync(entry, "utf8");
  validateFrontmatter(text, "commerce-backend-expert");
  const rules = [], files = [entry]; let indexes = 0;
  for (const domain of domains) {
    const dir = path.join(root, "references", domain), index = path.join(dir, "INDEX.md");
    const indexText = fs.readFileSync(index, "utf8"); files.push(index); indexes++;
    const indexed = [...indexText.matchAll(/\]\(([a-z0-9-]+)\.md\)/g)].map(match => match[1]);
    const entries = fs.readdirSync(dir, {withFileTypes: true});
    assert.ok(entries.every(entry => entry.isFile() && entry.name.endsWith(".md")), `${domain}: only Markdown knowledge is allowed`);
    const domainRules = entries.map(entry => entry.name).filter(name => name !== "INDEX.md");
    assert.deepEqual(indexed.slice().sort(), domainRules.map(name => name.slice(0, -3)).sort(), `${domain}: index/rules mismatch`);
    for (const name of domainRules) {
      const file = path.join(dir, name), rule = parseRule(fs.readFileSync(file, "utf8"));
      assert.equal(rule.domain, domain); assert.equal(name, rule.id + ".md"); rules.push(rule); files.push(file);
    }
  }
  validateRules(rules);
  const links = files.reduce((sum, file) => sum + validateLinks(file, root), 0);
  return {rules, files: files.length, indexes, links};
}

function compareBaseline(rules, baseline) {
  assert.equal(rules.length, baseline.rules.length, "Markdown differs from baseline rule count");
  const byId = new Map(baseline.rules.map(rule => [rule.id, rule]));
  for (const rule of rules) assert.deepEqual(rule, byId.get(rule.id), `Markdown differs from baseline rule fields: ${rule.id}`);
}

function validateRepository(root = repositoryRoot) {
  root = path.resolve(root);
  for (const legacy of ["src", "npm", "gradle", "gradlew", "gradlew.bat", "build.gradle.kts", "settings.gradle.kts", "scripts/release-checks.js", "scripts/VerifyArtifact.java", ".github/workflows/release.yml", ".github/workflows/validate.yml", ".mcp.json", "mcp.json"]) {
    assert.ok(!fs.existsSync(path.join(root, legacy)), `Removed runtime path returned: ${legacy}`);
  }
  const result = validateSkill(path.join(root, "skills/commerce-backend-expert"));
  const review = path.join(root, "skills/commerce-review/SKILL.md");
  validateFrontmatter(fs.readFileSync(review, "utf8"), "commerce-review");
  const reviewLinks = validateLinks(review, path.dirname(review));
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8").replaceAll("\r\n", "\n");
  for (const name of ["commerce-backend-expert", "commerce-review"]) {
    assert.equal(fs.readFileSync(path.join(root, "skills", name, "LICENSE"), "utf8").replaceAll("\r\n", "\n"), license, `${name}: bundle the repository license`);
  }
  const documents = ["README.md", "README.ko.md", "CONTRIBUTING.md", "CONTRIBUTING.ko.md", "tests/README.md", "benchmarks/scenarios.md", "benchmarks/README.md", "validation/0.3.1.md", ".cursor/rules/commerce-backend.mdc"];
  const documentationLinks = documents.reduce((sum, relative) => sum + validateLinks(path.join(root, relative), root), 0);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
  // The portable schema marker hides bundled hooks in Codex CLI 0.153.2.
  assert.ok(!manifest.$schema, "Codex CLI 0.153.2 hook discovery requires omitting the portable schema marker");
  assert.equal(manifest.name, "commerce-backend-expert");
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/);
  assert.ok(manifest.description?.trim());
  assert.equal(manifest.repository, "https://github.com/dakcoh/commerce-backend-expert", "Use the current repository URL");
  assert.equal(manifest.extensions?.["com.openai"]?.hooks, "./hooks/session.json");
  for (const client of ["codex", "claude", "cursor"]) {
    const adapter = JSON.parse(fs.readFileSync(path.join(root, `.${client}-plugin/plugin.json`), "utf8"));
    for (const key of ["name", "version", "description", "repository"]) assert.equal(adapter[key], manifest[key], `${client}: inconsistent ${key}`);
    assert.equal(adapter.skills, "./skills/", `${client}: must use canonical skills`);
    assert.ok(!adapter.mcpServers, `${client}: MCP must not run by default`);
    if (client === "cursor") assert.ok(!adapter.hooks, "cursor: hooks must not run by default");
    else assert.equal(adapter.hooks, "./hooks/session.json", `${client}: must use session hooks only`);
    if (client === "codex") assert.deepEqual(adapter.interface, manifest.extensions["com.openai"].interface);
  }
  for (const [relative, source] of [[".agents/plugins/marketplace.json", {source: "local", path: "./"}], [".claude-plugin/marketplace.json", "./"]]) {
    const catalog = JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
    assert.equal(catalog.name, "commerce-context-mcp", "Keep the marketplace ID stable for existing v0.3.0 installations");
    assert.equal(catalog.plugins.length, 1);
    assert.equal(catalog.plugins[0].name, manifest.name, "Marketplace must reference the canonical plugin");
    assert.deepEqual(catalog.plugins[0].source, source, "Marketplace must install the repository root");
  }
  assert.ok(!fs.existsSync(path.join(root, "hooks/hooks.json")), "Optional hooks must not be auto-discovered");
  const session = JSON.parse(fs.readFileSync(path.join(root, "hooks/session.json"), "utf8"));
  assert.deepEqual(Object.keys(session.hooks), ["SessionStart", "UserPromptSubmit"]);
  const sessionCommand = 'node -e "require(require(\'path\').join(process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT, \'hooks/session.js\')).main()"';
  for (const [event, groups] of Object.entries(session.hooks)) {
    assert.equal(groups.length, 1); assert.equal(groups[0].hooks.length, 1);
    assert.deepEqual(groups[0].hooks[0], {type: "command", command: sessionCommand, timeout: 5});
    if (event === "SessionStart") assert.equal(groups[0].matcher, "startup|resume|clear|compact|fork");
    else assert.ok(!groups[0].matcher);
  }
  assert.ok(fs.statSync(path.join(root, "hooks/session.js")).isFile());
  const openclaw = JSON.parse(fs.readFileSync(path.join(root, ".openclaw/skills.example.json"), "utf8"));
  assert.equal(openclaw.skills.load.extraDirs.length, 1);
  assert.ok(openclaw.skills.load.extraDirs[0].endsWith("/commerce-backend-expert/skills"));
  for (const client of ["claude", "cursor"]) {
    const hooks = JSON.parse(fs.readFileSync(path.join(root, `hooks/${client}.json`), "utf8"));
    const event = client === "claude" ? "PostToolUse" : "afterFileEdit";
    assert.deepEqual(Object.keys(hooks.hooks), [event]);
    const handlers = hooks.hooks[event];
    const command = client === "claude" ? handlers[0].hooks[0].command : handlers[0].command;
    assert.ok(command.includes("/hooks/validate-knowledge.js"));
  }
  return {...result, documentationLinks, reviewLinks, skills: 2, clientManifests: 3};
}

if (require.main === module) {
  try {
    const result = validateRepository();
    if (process.argv[2]) {
      const baseline = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
      compareBaseline(result.rules, baseline);
    }
    console.log(JSON.stringify({rules: result.rules.length, indexes: result.indexes, files: result.files, localLinks: result.links, reviewLinks: result.reviewLinks, skills: result.skills, documentationLinks: result.documentationLinks, clientManifests: result.clientManifests, baselineParity: Boolean(process.argv[2])}));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = {parseRule, validateRules, validateLinks, validateFrontmatter, validateSkill, validateRepository, compareBaseline};
