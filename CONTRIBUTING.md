# Contributing

English · [한국어](CONTRIBUTING.ko.md)

For usage, see the [README](README.md). The [skill Markdown](skills/commerce-backend-expert/SKILL.md) is the knowledge source. Do not reintroduce parallel Java-server or YAML knowledge maintenance.

## Structure

```text
skills/commerce-backend-expert/
  SKILL.md                    Shared decision and development workflow
  references/<domain>/INDEX.md Domain routing
  references/<domain>/<id>.md  Conditions, exceptions, guidance, evidence
scripts/
  validate-skills.js           Knowledge, document, repository checks
  validate-skills.test.js      Boundary and regression tests
tests/behavior-cases.md        Synthetic development inputs and criteria
.github/workflows/ci.yml       Document and test CI
plugin.json                   Shared bundle metadata
package.json                  CommonJS scope for developer tools (private, no dependencies)
.codex-plugin/                Codex entrypoint
.claude-plugin/               Claude Code entrypoint
.cursor-plugin/               Cursor entrypoint
.cursor/rules/                Optional routing rule
.openclaw/                    Extra-directory configuration example
hooks/                        Optional development validation hooks
```

Start with one entry skill, six domain indexes, and 70 rules. Split independent skills when tasks have distinct inputs, workflows, and success criteria. Avoid duplicating shared guidance across domains.

## Edit knowledge

- Keep rule IDs and filenames stable and list them in their domain index. Check test catalog counts when adding or removing rules.
- Review titles, applicability, exclusions, assumptions, ordered guidance, failures and recovery, checklists, and related rules together.
- `##` headings delimit validated fields. Use `###` or deeper for body subheadings. Preserve evidence fields below each evidence `###` heading.
- Record `status`, `severity`, `evidenceLevel`, `owner`, reviewer, review date, and change reason accurately. Do not replace `not-recorded` or clear `needs-review` without an actual review.
- Record official sources actually checked, their scope, and dates. Exclude company material, customer data, and real keys. Do not assume one PG contract or business policy is universal.

Some evidence retains `src/main/resources/knowledge/*.yml` as **historical v0.2.2 provenance**. These are not current files or runtime dependencies. Consult the [v0.2.2 source](https://github.com/dakcoh/commerce-context-mcp/tree/v0.2.2/src/main/resources/knowledge) for history. Edit new knowledge only in Markdown.

## Validation

Contributor checks require Node.js 22 or later. No dependency installation or JDK is needed. Run from the repository root:

```bash
node scripts/validate-skills.js
node --test scripts/validate-skills.test.js
```

The first command validates rules, indexes, links and anchors, review records, dates, and evidence, and checks that removed MCP runtime paths have not returned. The second checks missing or invalid metadata, path escapes, damaged indexes, and other failure cases. Neither invokes an LLM API or external service.

For migration parity, optionally supply a separately preserved capture of full rule records. Keep that capture as evidence, not a second maintained knowledge source.

```bash
node scripts/validate-skills.js /path/to/baseline.json
```

Format checks and model decisions are separate. For [synthetic development cases](tests/behavior-cases.md), record actual document reads and hashes, final answers/diffs, executed tests and results, and unresolved conditions. A rule ID in an answer does not establish successful application.

The migrated documents were evaluated on seven synthetic tasks covering implementation, refactoring, review, incident analysis, partial code, unrelated frontend work, and cross-domain design. Generated implementations passed seven scenarios, refactoring passed 14 differential cases, and 11 additional checks passed. These results do not establish live DB/PG behavior, browser execution, or automatic skill selection after installation. Validate this runtime removal separately through knowledge preservation, structure, documentation, and tests.

CI is configured for Node 22 and 24 on Ubuntu, Windows, and macOS. Record local passes separately from completed remote CI.

## Optional development hooks

Default manifests do not register hooks. To validate knowledge edits, use the [Claude template](hooks/claude.json) or [Cursor template](hooks/cursor.json). Replace `${CLAUDE_PLUGIN_ROOT}` or `${CURSOR_PLUGIN_ROOT}` in the command with this repository's absolute path and merge the event into the client's project/user hook settings. Preserve existing settings.

The checker only handles Markdown edits inside `skills/commerce-backend-expert/`. It skips external project files, changes no files or settings, and makes no network calls. Input is limited to 64 KiB; successful runs are silent. There is no automatic prompt injection or inspection of every code edit. Do not wire these client hooks into OpenClaw.

Formats were checked against official documentation for [Codex](https://developers.openai.com/plugins/build/plugins), [Claude](https://code.claude.com/docs/en/plugins-reference), [Cursor](https://prod.cursor.com/docs/reference/plugins), [OpenClaw bundles](https://docs.openclaw.ai/plugins/bundles) and [skill paths](https://docs.openclaw.ai/tools/skills), and [Cursor hooks](https://prod.cursor.com/docs/hooks). Do not claim installation verification until discovery, activation, updates, removal, and relevant hooks are tested in fresh client profiles.

## Migration and next work

This branch removes six knowledge YAML files, the Java MCP and its tests, Gradle, the npm launcher/JRE preparation, and JAR/npm publication workflows. User and contributor guides are consolidated into four bilingual documents. Version v0.2.2 remains in the local `legacy/v0.2.2` branch and its tag; temporary source backups and build artifacts were deleted. Run or build the old MCP from that version; this branch is no longer compatible with it.

Next, verify plugin installation, activation, updates, and removal on one supported client and individually review the 19 `needs-review` rules. Do not add MCP registration or Java runtime downloads back into the skill package. User projects do not need to migrate to Java 21. Check packaging against the [official OpenAI guidance](https://developers.openai.com/plugins/build/plugins).

Company processes, multilingual knowledge, paid plans, and private-repository conversion remain outside scope. Commit, push, publication, and installation require the corresponding requested scope.
