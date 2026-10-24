# Contributing

English · [한국어](CONTRIBUTING.ko.md)

This guide is for contributors editing rules, validation tools, or client configuration. For skill usage, see the [README](README.md).

[Run checks](#validation) · [Find files](#where-to-edit) · [Edit knowledge](#knowledge-editing-rules) · [Session hooks](#session-hooks) · [Edit hooks](#optional-development-hooks) · [Client validation status](#client-checks)

## Validation

**Development version:** Node.js 24.22.1 LTS, recorded in [.nvmrc](.nvmrc). Run `npm ci --ignore-scripts` once to install the YAML parser used only by developer checks. No JDK is needed; document skills and session hooks do not use this dependency.

After editing, run both commands from the repository root:

```bash
npm run check
npm test
```

| Command | What it checks |
|---|---|
| `npm run check` | Required bodies, metadata, reviews, evidence and dates; indexes, links and anchors; client configuration; retired MCP paths |
| `npm test` | Boundaries and regressions: deleted guidance, invalid metadata, path escapes, damaged indexes, and hook behavior |

Neither command calls an LLM API or external service. Passing format checks does not establish guidance accuracy or live DB/PG behavior.

[CI](.github/workflows/ci.yml) is configured to run the same checks on Ubuntu, Windows, and macOS with Node.js 24.22.1 and the security-patched Node.js 22.23.4 for compatibility. Record local passes separately from completed remote CI.

<details>
<summary>Additional validation: AI behavior and migration parity</summary>

**AI behavior:** See the [public runner and results](benchmarks/README.md), and the inputs and criteria in [synthetic development cases](benchmarks/scenarios.md). Record actual document reads and hashes, final answers/diffs, executed tests and results, and unresolved conditions. A rule ID in an answer does not establish successful application.

**Migration parity:** If a separately preserved capture of full rule records is available, pass it as an optional argument.

```bash
node scripts/validate-skills.js /path/to/baseline.json
```

This compares all rule fields. Ordinary format checks detect structural loss, not every change in meaning. Keep the baseline as comparison evidence, not a second maintained knowledge source.

</details>

## Where to edit

The Markdown in `skills/commerce-backend-expert/` is the knowledge source. Maintain the general skill, six domain indexes, and 70 rules together. The review skill works independently and selects detailed rules only when the general skill is also available.

| What you want to change | Location |
|---|---|
| Shared decision and development workflow | [SKILL.md](skills/commerce-backend-expert/SKILL.md) |
| Payment/refund review workflow | [commerce-review](skills/commerce-review/SKILL.md) |
| Individual rules and domain navigation | `skills/commerce-backend-expert/references/<domain>/<id>.md` and `INDEX.md` in the same folder |
| Document checks and behavior tests | [Validator](scripts/validate-skills.js), [tests/](tests/README.md) |
| AI behavior inputs and evaluation criteria | [benchmarks/scenarios.md](benchmarks/scenarios.md) |
| Model evaluation inputs, runner, and public records | [benchmarks/](benchmarks/README.md) |
| Plugin metadata and client entrypoints | [plugin.json](plugin.json), `.<client>-plugin/plugin.json` |
| Optional routing and external skill paths | [.cursor/rules/](.cursor/rules/), [.openclaw/](.openclaw/) |
| Automatic checks after knowledge edits | [hooks/](hooks/) — see [setup](#optional-development-hooks) below |
| Session guidance and on/off state | [hooks/session.js](hooks/session.js), [registration](hooks/session.json) |
| Local installation, refresh, and removal checks | [scripts/smoke-plugin.js](scripts/smoke-plugin.js) |
| CI environment | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| Developer-script CommonJS scope and YAML parser | [package.json](package.json) — private, developer-check dependency only |

Avoid duplicating shared guidance across domains. Split skills when independent tasks have distinct inputs, workflows, and success criteria. Do not reintroduce parallel Java-server or YAML knowledge maintenance.

## Knowledge editing rules

### Editing sequence

1. Read the rule's applicability, exclusions, and assumptions first. Review guidance, failures and recovery, and checklists together.
2. Keep rule IDs and filenames stable; align domain indexes and related-rule links. Check test catalog counts when adding or removing rules.
3. Record evidence and review state accurately, then [run the checks](#validation).

### Body formats

These are the required bodies for each document format. Retain common fields such as titles, applicability, checklists, and evidence as well. The headings below match the Korean knowledge files.

SKILL.md frontmatter is parsed as YAML. `name` and `description` must be strings; `license`, `compatibility`, `allowed-tools`, and a string-valued `metadata` map are supported. Use a comma-separated string for `metadata.tags`. Keep each skill's LICENSE synchronized with the root license for standalone distribution.

| Document format | Required body headings |
|---|---|
| `commerce` rules | `업무 맥락`, `반드시 지켜야 할 원칙`, `권장 흐름`, `기술 구현 참고`, `실패 시나리오` |
| `spring-commerce` rules | `업무 맥락`, `Java Spring 구현 가이드`, `피해야 할 패턴` |
| Other ordinary rules | `구현 가이드`, `피해야 할 패턴` |
| Checklist-only documents with `category: checklist` | Use `검토 체크리스트`; the ordinary guidance sections above are not required |

- Missing or empty required bodies fail validation. Deleting the entire refund guide also fails repository checks and the edit hook.
- `##` headings delimit validated fields. List sections such as `구현 가이드`, `전제`, and checklists accept list items with two-space continuations, not subheadings. Use `###` or deeper only in free-text sections such as `업무 맥락` or an independent `판단 근거`.
- Include `판단 근거` only when it adds reasoning beyond the summary/context. When omitted, the parser restores its comparison field from context or summary, so repeated text is unnecessary.
- Within `출처`, preserve the evidence-field structure below each `###` heading.
- Retain `적용 조건`, `전제`, and `적용하지 않는 조건`. Assumptions must not be empty. When there are no exclusions, leave only that section's body empty so intentional emptiness differs from a deleted section.

### Evidence and review state

- Record `status`, `severity`, `evidenceLevel`, and `owner` accurately.
- Base `verifiedBy`, `lastReviewedAt`, and `changeNote` on an actual review. Do not invent values for `not-recorded` or clear `needs-review` without review. `active` is not an accuracy certification.
- Record official sources actually checked, their scope, and dates. Do not assume a particular PG contract or company policy is universal.
- Exclude company material, customer data, and real keys.

## Session hooks

Codex and Claude manifests register `SessionStart` and `UserPromptSubmit` through [session.json](hooks/session.json). Use Node.js 24.22.1 LTS for hooks; document-only skill usage remains available separately. Codex requires user review/trust of hook definitions. Installation does not grant trust.

Codex CLI 0.153.2 reports no bundled hooks when the root manifest declares the Agent Plugins `$schema`. Removing only that field from the same package makes both session hooks discoverable. The root manifest currently omits `$schema` for compatibility while retaining OpenAI settings and client entrypoints. Retest the affected client versions before restoring it.

State commands must exactly match the ordinary messages `commerce on`, `commerce off`, or `commerce status`. State is keyed by a hash of project path and session ID and stores only a boolean. Startup provides concise scope and skill paths; ordinary requests do not repeat the same context.

Direct execution/protocol tests cover valid input, isolated state, resume/compaction persistence, corrupt state, the 64 KiB input limit, and termination of an unfinished input stream. Input waits at most two seconds; client registrations have a five-second timeout. Errors emit a warning only. These tests do not replace verification of actual client hook invocation.

## Optional development hooks

Configure edit hooks only if you want automatic checks while editing skill knowledge. They are separate from the session hooks above and are not registered in default manifests.

1. Choose the [Claude template](hooks/claude.json) or [Cursor template](hooks/cursor.json).
2. Replace `${CLAUDE_PLUGIN_ROOT}` or `${CURSOR_PLUGIN_ROOT}` in the command with this repository's absolute path. Use Node.js 24.22.1 LTS.
3. Merge the event into the client's project/user hook settings. Preserve existing settings.

The checker handles Markdown edits inside `skills/`, validating both skills and shared rules together. It skips external project files and makes no file/settings changes, network calls, or automatic prompt injections. Input is limited to 64 KiB; successful runs are silent. Do not wire these client hooks into OpenClaw.

## Client checks

**Updated on 2026-10-24.** Distinguish configuration checks, client-reported enabled state, and actual document application by the model. See the [0.3.1 validation record](validation/0.3.1.md) for the new checks; earlier model and Claude results remain dated 2026-10-23.

| Environment | Verified scope | Unverified or limited |
|---|---|---|
| Codex CLI 0.153.2 | 89 runtime files match the cache; actual v0.3.0 → 0.3.1 upgrade with the preserved marketplace ID, same-version refresh, fixture-version refresh, removal. In an isolated profile, both hooks ran after `/hooks` review/trust; off survived process restart/resume and actual compaction, and context reached the local response fixture | Hook checks used a deterministic local model-response fixture, not real inference. Automatic compaction and other client versions remain unverified |
| Codex app-server with a read-only file tool | Actual skill/rule reads for natural refund/webhook requests without explicit skill invocation; no commerce reads for CSS | Three synthetic cases, one run each. Does not establish native CLI-tool behavior, live DB/PG behavior, or quality gains against no plugin |
| Claude Code 2.1.114 | Manifest validation and discovery of both skills. Successful live `SessionStart` from current sources without a prompt. Separate `commerce off` state write | The off-trial copy also contained a diagnostic default hook file. Inference stopped due to insufficient credits. Model application and actual resume/compaction unverified |
| Cursor and OpenClaw | Repository configuration/path checks | Client execution unverified |
| Optional hooks | Local checker and regression tests | Execution through client-registered hooks unverified |
| Individual skill installation | Local installs of each skill and both together using `skills@1.7.4` on Node 24, with resolved references. Review-only installation needs no sibling folder | No model or session-hook execution |
| Explicit skill application | Public [answers, hashes, and reads](benchmarks/README.md) for five current-skill cases: refund, valid webhook, synchronous webhook, watchdog, CSS | One run each; answers reviewed in the same Codex session. Separate from automatic discovery, a no-skill control, or live-system checks |

Plugin installation checks used a separate `CODEX_HOME` and work directory without changing normal user settings. The runtime fixture contained only manifests, license, module-scope configuration, routing rule, skills, and session hooks. Version-refresh checks changed fixture copies. Explicit skill evaluations use existing CLI authentication with process-local evaluation instructions and configuration. Release sources also contain bilingual docs, marketplaces, and developer checks. These results do not establish hook execution across all clients.

The two changed high-risk rules, `webhook-handling` and `concurrency-distributed`, received a recorded AI document review on 2026-10-24 against the official Toss Payments and Redisson references. Both remain `needs-review`: provider-specific authentication, deployed Redis/DB behavior, and production safety were not established. All 19 review items remain tracked.

Repeat the local installation check without credentials or model calls. Evidence is written under ignored `output/plugin-smoke-*` directories.

```bash
node scripts/smoke-plugin.js /absolute/path/to/codex
# Also verify upgrade from the exact local release tag (requires Git and tar):
node scripts/smoke-plugin.js /absolute/path/to/codex v0.3.0
```

On Windows, pass the actual path to `codex.exe` as the first argument. The optional second argument selects a local Git baseline. This checks installation, exact file sets and contents, refresh, and removal; it does not execute models or hooks.

<details>
<summary>Manual client checks and format references</summary>

1. Create a fixture local marketplace following the [official layout](https://developers.openai.com/plugins/build/plugins), and prepare a fresh profile.
2. In the isolated Codex CLI, run `plugin marketplace add` → `plugin list --available` → `plugin add` → `plugin list` to check installation and enabled state.
3. Compare cached files with sources, edit a fixture file, and reinstall. Check same-version source refresh and different-version updates separately.
4. Test a commerce request and an unrelated frontend task without explicitly requesting the skill. Record actual document reads and results for activation/non-activation.
5. After `plugin remove`, inspect the installed list and cache, then run `plugin marketplace remove`. Test any client hooks in use separately.

Codex installation commands do not verify model activation. Claude, Cursor, and OpenClaw also need checks in their own fresh profiles/configurations.

Official documentation used for format checks:

- [Codex plugins](https://developers.openai.com/plugins/build/plugins)
- [Claude plugins](https://code.claude.com/docs/en/plugins-reference)
- [Cursor plugins](https://prod.cursor.com/docs/reference/plugins) and [hooks](https://prod.cursor.com/docs/hooks)
- [OpenClaw bundles](https://docs.openclaw.ai/plugins/bundles) and [skill paths](https://docs.openclaw.ai/tools/skills)

</details>

## Remaining work and history

- Complete Claude hook invocation and resume/compaction checks; check automatic compaction and additional Codex versions separately.
- Repeat natural-language evaluations with a no-plugin control. Do not generalize one trial into quality or token savings.
- Individually review the evidence and conditions of the 19 `needs-review` rules.

<details>
<summary>Previous synthetic evaluation and the v0.2.2 migration</summary>

**Previous local evaluation:** The migration recorded seven tasks, including implementation and refactoring, but their execution artifacts are not public. They are not counted as reproducible current passes. See the [behavior evaluation](benchmarks/README.md) for current public inputs, runner, and records.

**MCP migration:** This branch removes six knowledge YAML files, the Java MCP and its tests, Gradle, the npm launcher/JRE preparation, and JAR/npm publication workflows. Version v0.2.2 remains in its [tag](https://github.com/dakcoh/commerce-backend-expert/tree/v0.2.2). Temporary source backups and build artifacts were removed. Run or build the old MCP from that version; this branch is incompatible with old MCP settings.

**Historical source paths:** References to `src/main/resources/knowledge/*.yml` in some rules are v0.2.2 provenance, not current files or runtime dependencies. Consult the [historical knowledge source](https://github.com/dakcoh/commerce-backend-expert/tree/v0.2.2/src/main/resources/knowledge) when needed.

</details>

Do not add MCP registration or Java runtime downloads back, or migrate user projects to Java 21 for this skill. Company processes, multilingual knowledge, paid plans, and private-repository conversion remain outside current scope. Commit, push, publication, and installation into user environments require the corresponding requested scope.
