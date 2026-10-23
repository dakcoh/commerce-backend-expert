# Commerce Backend Expert

English · [한국어](README.ko.md)

[![CI](https://github.com/dakcoh/commerce-backend-expert/actions/workflows/ci.yml/badge.svg)](https://github.com/dakcoh/commerce-backend-expert/actions/workflows/ci.yml) · [MIT](LICENSE)

**A Markdown skill and hook plugin for designing, implementing, refactoring, reviewing, and investigating Korean ecommerce backends.**

The skill guides an AI through actual code and business conditions, then selects relevant guidance for the requested development task. It includes 70 rules covering orders, inventory, payments, coupons, settlement, and Java/Spring.

Document-only skill usage requires no Java or Node.js installation, MCP server, or separate API key. The plugin's session hooks require Node.js 22 or later. AI-client access and project build/test requirements remain those of their respective environments.

## Use the skill

**v0.3.0 is a Markdown skill/plugin release.** It does not update the old npm MCP package; do not install it with `npm install` or register an MCP server. See [client checks](CONTRIBUTING.md#client-checks) for session-hook coverage.

Codex CLI:

```bash
codex plugin marketplace add https://github.com/dakcoh/commerce-backend-expert.git
codex plugin add commerce-backend-expert@commerce-context-mcp
```

Claude Code:

```bash
claude plugin marketplace add dakcoh/commerce-backend-expert
claude plugin install commerce-backend-expert@commerce-context-mcp
```

The repository is now named `commerce-backend-expert`. The `@commerce-context-mcp` suffix is the marketplace identifier used by v0.3.0; it stays unchanged to preserve existing installations and updates.

Use a new conversation after installation. Codex hooks require reviewing and trusting their definitions through `/hooks`; execution after trust and actual resume/compaction remain unverified. Prepare Node.js 22 or later when using hooks. For Cursor and OpenClaw, follow [client layouts](#client-layouts) below. You can also download the repository and provide the documents directly.

1. Make the [general skill](skills/commerce-backend-expert/SKILL.md) or [payment/refund review skill](skills/commerce-review/SKILL.md) available to your AI. They share knowledge, so copy the entire `skills/` directory when moving them.
2. Provide the relevant project and business conditions, and specify the requested task.
3. Review the rules read, code locations, changes, executed tests, and unresolved conditions.

Reference the entry SKILL.md path and ask, for example:

> Read this skill and review my payment webhook. Trace callers, upstream validation, and persistence. Distinguish applicable guidance, confirmed defects, and remaining checks.

| Task | Example request |
|---|---|
| Design | “Design recovery for direct database stock deduction and a lost payment approval response.” |
| Implementation | “Use a date/sequence business key to prevent duplicates; check midnight retries and request-content conflicts.” |
| Refactoring | “Simplify stock deduction while preserving returns, exceptions, transactions, and side-effect order.” |
| Payment/refund review | “Use commerce-review to distinguish actual defects from additional checks in this refund code. Do not edit the code.” |
| Incident analysis | “An approval response was lost. Explain what to inspect using the original transaction and state history.” |

## Read only relevant guidance

The entry skill selects a domain index, then reads the required rules. It skips the index when the exact rule path is already known and avoids rereading documents already in context. It does not load the entire catalog for every request.

| Domain | Coverage | Rules |
|---|---|---:|
| [Products, orders, customers, shipping](skills/commerce-backend-expert/references/commerce/INDEX.md) | Prices, states, benefits, authorization, operational integrity | 20 |
| [Inventory and concurrency](skills/commerce-backend-expert/references/inventory/INDEX.md) | Direct deduction, reservations, idempotency, compensation | 8 |
| [Payments and refunds](skills/commerce-backend-expert/references/payment/INDEX.md) | Approvals, webhooks, unknown outcomes, partial refunds | 7 |
| [Coupons and promotions](skills/commerce-backend-expert/references/coupon/INDEX.md) | Eligibility, issuance limits, discount allocation, restoration | 6 |
| [Settlement and payouts](skills/commerce-backend-expert/references/settlement/INDEX.md) | Dates, statements, deductions, holds, reconciliation | 9 |
| [Java/Spring implementation](skills/commerce-backend-expert/references/spring-commerce/INDEX.md) | Transactions, JPA, events, batches, retries | 20 |

Guides are bilingual; the knowledge documents are in Korean. This skill does not apply to ordinary frontend styling, marketing, or sales strategy.

## Client layouts

The shared [plugin.json](plugin.json) and client entrypoints below use the same `skills/` source without copying knowledge. The current version is `0.3.0`. **Format/path checks and actual client installation/activation are separate.**

| Client | Configuration |
|---|---|
| Codex | OpenAI settings in the shared manifest and compatibility settings in [.codex-plugin/plugin.json](.codex-plugin/plugin.json): skills and session hooks |
| Claude Code | Skills and session hooks in [.claude-plugin/plugin.json](.claude-plugin/plugin.json) |
| Cursor | [.cursor-plugin/plugin.json](.cursor-plugin/plugin.json) and an [optional routing rule](.cursor/rules/commerce-backend.mdc) |
| OpenClaw | Shared bundle, or the [extra skill directory example](.openclaw/skills.example.json). Replace the absolute path and merge into existing configuration; this example is not applied automatically. |

## Session hooks

[Session hooks](hooks/session.json) provide concise scope and skill paths at startup, resume, and after conversation compaction. They do not inject all 70 rules. On clients running these hooks, send the following as ordinary messages:

| Message | Behavior |
|---|---|
| `commerce off` | Stop automatic commerce guidance for this session |
| `commerce on` | Resume automatic guidance |
| `commerce status` | Report the current state |

State is isolated by project and session and survives resume/compaction of that session. Off does not remove host skill discovery or prohibit explicitly requested skills. Hooks do not store or transmit prompts, code, or transcripts. Only the on/off flag is stored in the client's plugin-data directory, falling back to the OS temporary directory if unavailable.

Both hooks were discovered in Codex CLI 0.153.2. Review/trust of the current hook definition is required separately from installation. Execution after trust and actual resume/compaction remain unverified in that client. See [runtime scope and compatibility settings](CONTRIBUTING.md#client-checks).

The [Claude](hooks/claude.json) and [Cursor](hooks/cursor.json) edit hooks are **optional checks for knowledge contributors**, not registered by default. They are separate from session hooks and do not inspect ordinary user-project code. See [developer hook setup](CONTRIBUTING.md#optional-development-hooks).

## Interpret the results

Check each rule's conditions, exceptions, evidence scope, and review state. `active` means in use, not certified accurate. Nineteen rules are `needs-review`. `not-recorded` under `verifiedBy` or `lastReviewedAt` means there is no recorded review.

The migrated documents were evaluated on seven synthetic development tasks. This does not establish live DB/PG behavior, automatic skill selection after installation, or correctness across all tasks. No token or response-time improvement is claimed. See [validation and its limits](CONTRIBUTING.md#validation).

## Existing MCP users

This branch now uses **Markdown as the sole knowledge source**. The old YAML, Java MCP, Gradle build, npm launcher, and JRE download path have been removed. Existing MCP settings cannot run this branch.

The public v0.2.2 source and instructions remain in the [v0.2.2 tag](https://github.com/dakcoh/commerce-backend-expert/tree/v0.2.2). Published npm/JAR artifacts and tags remain unchanged. To migrate, remove the old MCP registration and install the plugin above. The [v0.3.0 release](https://github.com/dakcoh/commerce-backend-expert/releases/tag/v0.3.0) provides a source archive and describes the changes and validation scope.

For knowledge changes and developer checks, see [Contributing](CONTRIBUTING.md).
