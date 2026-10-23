# Contributing

English · [한국어](CONTRIBUTING.ko.md)

This guide is for contributors editing rules, validation tools, or client configuration. For skill usage, see the [README](README.md).

[Run checks](#validation) · [Find files](#where-to-edit) · [Edit knowledge](#knowledge-editing-rules) · [Session hooks](#session-hooks) · [Edit hooks](#optional-development-hooks) · [Client validation status](#client-checks)

## Validation

**Requires:** Node.js 22 or later. No dependency installation or JDK is needed.

After editing, run both commands from the repository root:

```bash
node scripts/validate-skills.js
node --test scripts/*.test.js
```

| Command | What it checks |
|---|---|
| `validate-skills.js` | Required bodies, metadata, reviews, evidence and dates; indexes, links and anchors; client configuration; retired MCP paths |
| `node --test …` | Boundaries and regressions: deleted guidance, invalid metadata, path escapes, damaged indexes, and hook behavior |

Neither command calls an LLM API or external service. Passing format checks does not establish guidance accuracy or live DB/PG behavior.

[CI](.github/workflows/ci.yml) is configured to run the same checks on Ubuntu, Windows, and macOS with Node 22 and 24. Record local passes separately from completed remote CI.

<details>
<summary>Additional validation: AI behavior and migration parity</summary>

**AI behavior:** Use the inputs and criteria in [synthetic development cases](tests/behavior-cases.md). Record actual document reads and hashes, final answers/diffs, executed tests and results, and unresolved conditions. A rule ID in an answer does not establish successful application.

**Migration parity:** If a separately preserved capture of full rule records is available, pass it as an optional argument.

```bash
node scripts/validate-skills.js /path/to/baseline.json
```

This compares all rule fields. Ordinary format checks detect structural loss, not every change in meaning. Keep the baseline as comparison evidence, not a second maintained knowledge source.

</details>

## Where to edit

The Markdown in `skills/commerce-backend-expert/` is the knowledge source. Maintain the general skill, six domain indexes, and 70 rules together; the review skill references those same rules.

| What you want to change | Location |
|---|---|
| Shared decision and development workflow | [SKILL.md](skills/commerce-backend-expert/SKILL.md) |
| Payment/refund review workflow | [commerce-review](skills/commerce-review/SKILL.md) |
| Individual rules and domain navigation | `skills/commerce-backend-expert/references/<domain>/<id>.md` and `INDEX.md` in the same folder |
| Document checks and regression tests | [Validator](scripts/validate-skills.js), [tests](scripts/validate-skills.test.js) |
| AI behavior inputs and evaluation criteria | [tests/behavior-cases.md](tests/behavior-cases.md) |
| Plugin metadata and client entrypoints | [plugin.json](plugin.json), `.<client>-plugin/plugin.json` |
| Optional routing and external skill paths | [.cursor/rules/](.cursor/rules/), [.openclaw/](.openclaw/) |
| Automatic checks after knowledge edits | [hooks/](hooks/) — see [setup](#optional-development-hooks) below |
| Session guidance and on/off state | [hooks/session.js](hooks/session.js), [registration](hooks/session.json) |
| Local installation, refresh, and removal checks | [scripts/smoke-plugin.js](scripts/smoke-plugin.js) |
| CI environment | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| Developer-script CommonJS scope | [package.json](package.json) — private, no dependencies |

Avoid duplicating shared guidance across domains. Split skills when independent tasks have distinct inputs, workflows, and success criteria. Do not reintroduce parallel Java-server or YAML knowledge maintenance.

## Knowledge editing rules

### Editing sequence

1. Read the rule's applicability, exclusions, and assumptions first. Review guidance, failures and recovery, and checklists together.
2. Keep rule IDs and filenames stable; align domain indexes and related-rule links. Check test catalog counts when adding or removing rules.
3. Record evidence and review state accurately, then [run the checks](#validation).

### Body formats

These are the required bodies for each document format. Retain common fields such as titles, applicability, checklists, and evidence as well. The headings below match the Korean knowledge files.

| Document format | Required body headings |
|---|---|
| `commerce` rules | `업무 맥락`, `반드시 지켜야 할 원칙`, `권장 흐름`, `기술 구현 참고`, `실패 시나리오` |
| `spring-commerce` rules | `업무 맥락`, `Java Spring 구현 가이드`, `피해야 할 패턴` |
| Other ordinary rules | `구현 가이드`, `피해야 할 패턴` |
| Checklist-only documents with `category: checklist` | Use `검토 체크리스트`; the ordinary guidance sections above are not required |

- Missing or empty required bodies fail validation. Deleting the entire refund guide also fails repository checks and the edit hook.
- `##` headings delimit validated fields. Use `###` or deeper for body subheadings.
- Within `출처`, preserve the evidence-field structure below each `###` heading.
- Retain `적용 조건`, `전제`, and `적용하지 않는 조건`. Assumptions must not be empty. When there are no exclusions, leave only that section's body empty so intentional emptiness differs from a deleted section.

### Evidence and review state

- Record `status`, `severity`, `evidenceLevel`, and `owner` accurately.
- Base `verifiedBy`, `lastReviewedAt`, and `changeNote` on an actual review. Do not invent values for `not-recorded` or clear `needs-review` without review. `active` is not an accuracy certification.
- Record official sources actually checked, their scope, and dates. Do not assume a particular PG contract or company policy is universal.
- Exclude company material, customer data, and real keys.

## Session hooks

Codex and Claude manifests register `SessionStart` and `UserPromptSubmit` through [session.json](hooks/session.json). Node.js 22 or later is required; document-only skill usage remains available separately. Codex requires user review/trust of hook definitions. Installation does not grant trust.

Codex CLI 0.153.2 reports no bundled hooks when the root manifest declares the Agent Plugins `$schema`. Removing only that field from the same package makes both session hooks discoverable. The root manifest currently omits `$schema` for compatibility while retaining OpenAI settings and client entrypoints. Retest the affected client versions before restoring it.

State commands must exactly match the ordinary messages `commerce on`, `commerce off`, or `commerce status`. State is keyed by a hash of project path and session ID and stores only a boolean. Startup provides concise scope and skill paths; ordinary requests do not repeat the same context.

Direct execution/protocol tests cover valid input, isolated state, resume/compaction persistence, corrupt state, the 64 KiB input limit, and termination of an unfinished input stream. Input waits at most two seconds; client registrations have a five-second timeout. Errors emit a warning only. These tests do not replace verification of actual client hook invocation.

## Optional development hooks

Configure edit hooks only if you want automatic checks while editing skill knowledge. They are separate from the session hooks above and are not registered in default manifests.

1. Choose the [Claude template](hooks/claude.json) or [Cursor template](hooks/cursor.json).
2. Replace `${CLAUDE_PLUGIN_ROOT}` or `${CURSOR_PLUGIN_ROOT}` in the command with this repository's absolute path. Node.js 22 or later is required.
3. Merge the event into the client's project/user hook settings. Preserve existing settings.

The checker handles Markdown edits inside `skills/`, validating both skills and shared rules together. It skips external project files and makes no file/settings changes, network calls, or automatic prompt injections. Input is limited to 64 KiB; successful runs are silent. Do not wire these client hooks into OpenClaw.

## Client checks

**Recorded on 2026-10-23.** Distinguish configuration checks, client-reported enabled state, and actual document application by the model.

| Environment | Verified scope | Unverified or limited |
|---|---|---|
| Codex CLI 0.153.2 | Local installation/enabled state, equality of all 87 packaged files and cache, same-version reinstall, fixture-version upgrade, removal and cache removal. `SessionStart` and `UserPromptSubmit` discovered after omitting root `$schema` | Both hooks are correctly `untrusted`. Execution after user review/trust and actual resume/compaction remain unverified |
| Codex app-server with a read-only file tool | Actual skill/rule reads for natural refund/webhook requests without explicit skill invocation; no commerce reads for CSS | Three synthetic cases, one run each. Does not establish native CLI-tool behavior, live DB/PG behavior, or quality gains against no plugin |
| Claude Code 2.1.114 | Manifest validation and discovery of both skills. Successful live `SessionStart` from current sources without a prompt. Separate `commerce off` state write | The off-trial copy also contained a diagnostic default hook file. Inference stopped due to insufficient credits. Model application and actual resume/compaction unverified |
| Cursor and OpenClaw | Repository configuration/path checks | Client execution unverified |
| Optional hooks | Local checker and regression tests | Execution through client-registered hooks unverified |

Codex checks used a separate `CODEX_HOME` and work directory without changing normal user settings. The runtime fixture contained only manifests, license, module-scope configuration, routing rule, skills, and session hooks. Version-refresh checks changed fixture copies. Release sources also contain bilingual docs, marketplaces, and developer checks. These results do not establish hook execution across all clients.

Repeat the local installation check without credentials or model calls. Evidence is written under ignored `output/plugin-smoke-*` directories.

```bash
node scripts/smoke-plugin.js /absolute/path/to/codex
```

On Windows, pass the actual path to `codex.exe` as the last argument. This checks installation, file equality, refresh, and removal; it does not execute models or hooks.

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

- Verify bundled-hook discovery, trust, invocation, and resume/compaction in supported clients.
- Repeat natural-language evaluations with a no-plugin control. Do not generalize one trial into quality or token savings.
- Individually review the evidence and conditions of the 19 `needs-review` rules.

<details>
<summary>Previous synthetic evaluation and the v0.2.2 migration</summary>

**Previous synthetic evaluation:** Seven tasks covered implementation, refactoring, review, incident analysis, partial code, unrelated frontend work, and cross-domain design. Generated implementations passed seven scenarios, refactoring passed 14 differential cases, and 11 additional checks passed. This did not establish live DB/PG behavior, browser execution, or automatic selection after installation.

**MCP migration:** This branch removes six knowledge YAML files, the Java MCP and its tests, Gradle, the npm launcher/JRE preparation, and JAR/npm publication workflows. Version v0.2.2 remains in its [tag](https://github.com/dakcoh/commerce-backend-expert/tree/v0.2.2). Temporary source backups and build artifacts were removed. Run or build the old MCP from that version; this branch is incompatible with old MCP settings.

**Historical source paths:** References to `src/main/resources/knowledge/*.yml` in some rules are v0.2.2 provenance, not current files or runtime dependencies. Consult the [historical knowledge source](https://github.com/dakcoh/commerce-backend-expert/tree/v0.2.2/src/main/resources/knowledge) when needed.

</details>

Do not add MCP registration or Java runtime downloads back, or migrate user projects to Java 21 for this skill. Company processes, multilingual knowledge, paid plans, and private-repository conversion remain outside current scope. Commit, push, publication, and installation into user environments require the corresponding requested scope.
