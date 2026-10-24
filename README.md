# Commerce Backend Expert

English · [한국어](README.ko.md)

[![CI](https://github.com/dakcoh/commerce-backend-expert/actions/workflows/ci.yml/badge.svg)](https://github.com/dakcoh/commerce-backend-expert/actions/workflows/ci.yml) · [MIT](LICENSE)

**A Markdown skill and hook plugin for designing, implementing, refactoring, reviewing, and investigating Korean ecommerce backends.**

The skill guides an AI through actual code and business conditions, then selects relevant guidance for the requested development task. It includes 70 rules covering orders, inventory, payments, coupons, settlement, and Java/Spring.

Document-only skill usage requires no Java or Node.js installation, MCP server, or separate API key. For the plugin's session hooks, use Node.js 24.22.1 LTS; compatibility is also tested on Node.js 22.23.4. AI-client access and project build/test requirements remain those of their respective environments.

## What does it help catch?

Suppose an order was paid 20,009 KRW and a 6,669 KRW refund for the first unit of X is still unresolved. A new request refunds both units of X for 13,339 KRW. The combined 20,008 KRW stays below the order total but refunds the same unit again.

The skill guides checks of line/unit reservations, unresolved transactions, request fingerprints, and restoration timing alongside the order limit. See the [synthetic input](benchmarks/fixtures/refund.js) and [evaluation method and records](benchmarks/README.md). This example does not establish live DB/PG behavior or quality gains against no skill.

## Use the skill

### Install skills only

The [general skill](skills/commerce-backend-expert/SKILL.md) includes 70 detailed rules. The [payment/refund review skill](skills/commerce-review/SKILL.md) provides a self-contained review workflow and can be installed alone. When both are available, the review can also select relevant detailed rules.

```bash
npx skills add dakcoh/commerce-backend-expert --skill commerce-backend-expert
```

Choose `--skill commerce-review` for the review workflow alone. The installer asks which AI client to target. The tested `skills@1.7.4` installer requires Node.js 22.20 or later. This method does not install session hooks or the `commerce on/off/status` controls.

For manual use, copy the entire selected `skills/<skill-name>/` folder, including its license and references. Reading the Markdown directly requires no Java, Node.js, or separate API key.

### Install the plugin with session hooks

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

Use Node.js 24.22.1 LTS for hooks. Start a new conversation; Codex also requires reviewing and trusting definitions through `/hooks`. Codex CLI 0.153.2 and Claude Code 2.1.114 hook invocation, resume, and manual compaction were checked with local model-response fixtures. Other client limits are listed in [client checks](CONTRIBUTING.md#client-checks); see also [client layouts](#client-layouts).

`@commerce-context-mcp` is the marketplace identifier preserved for existing installations and updates. The current plugin runs no MCP server and uses a different installation path from the historical npm MCP package.

### Make a request

Provide the relevant project, business conditions, and requested task. When supplying documents directly, specify the SKILL.md path.

> Use commerce-review to review this refund code. Trace callers, upstream validation, and persistence. Separate confirmed defects from further checks. Do not edit the code.

| Task | Example request |
|---|---|
| Design | “Design recovery for direct database stock deduction and a lost payment approval response.” |
| Implementation | “Use a date/sequence business key to prevent duplicates; check midnight retries and request-content conflicts.” |
| Refactoring | “Simplify stock deduction while preserving returns, exceptions, transactions, and side-effect order.” |
| Incident analysis | “An approval response was lost. Explain what to inspect using the original transaction and state history.” |

Check the rules read, code locations, changes, tests actually run, and unresolved conditions in the result.


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

The shared [plugin.json](plugin.json) and client entrypoints below use the same `skills/` source without copying knowledge. The current version is `0.3.1`. **Format/path checks and actual client installation/activation are separate.**

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

Codex CLI 0.153.2 (after `/hooks` review/trust) and Claude Code 2.1.114 invoked both hooks in isolated profiles. Off survived process restart/resume and actual manual compaction; hook context reached subsequent requests to local model-response fixtures. This checks client integration, not model behavior or every client's hooks. See [runtime scope and compatibility settings](CONTRIBUTING.md#client-checks).

The [Claude](hooks/claude.json) and [Cursor](hooks/cursor.json) edit hooks are **optional checks for knowledge contributors**, not registered by default. They are separate from session hooks and do not inspect ordinary user-project code. See [developer hook setup](CONTRIBUTING.md#optional-development-hooks).

## Interpret the results

Check each rule's conditions, exceptions, evidence scope, and review state. `active` means in use, not certified accurate. All 19 `needs-review` rules have recorded AI document reviews, with integration and business-policy checks remaining. See the [follow-up reviews and client checks without authentication](validation/followup-review.md). `not-recorded` under `verifiedBy` or `lastReviewedAt` means there is no recorded review.

The [public behavior evaluation](benchmarks/README.md) uses fixed synthetic inputs and the actual skill text. It does not establish live DB/PG behavior, automatic skill selection after installation, or correctness across all tasks. No token or response-time improvement is claimed. See [validation and its limits](CONTRIBUTING.md#validation).

## Existing MCP users

This branch now uses **Markdown as the sole knowledge source**. The old YAML, Java MCP, Gradle build, npm launcher, and JRE download path have been removed. Existing MCP settings cannot run this branch.

The public v0.2.2 source and instructions remain in the [v0.2.2 tag](https://github.com/dakcoh/commerce-backend-expert/tree/v0.2.2). Published npm/JAR artifacts and tags remain unchanged. To migrate, remove the old MCP registration and install the plugin above. The [v0.3.0 release](https://github.com/dakcoh/commerce-backend-expert/releases/tag/v0.3.0) provides a source archive and describes the changes and validation scope.

For knowledge changes and developer checks, see [Contributing](CONTRIBUTING.md).
