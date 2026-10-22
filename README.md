# Commerce Backend Expert

English · [한국어](README.ko.md)

[![CI](https://github.com/dakcoh/commerce-context-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/dakcoh/commerce-context-mcp/actions/workflows/ci.yml) · [MIT](LICENSE)

**A Markdown skill for designing, implementing, refactoring, reviewing, and investigating Korean ecommerce backends.**

The skill guides an AI through actual code and business conditions, then selects relevant guidance for the requested development task. It includes 70 rules covering orders, inventory, payments, coupons, settlement, and Java/Spring.

The skill itself requires no Java or Node.js installation, MCP server, or separate API key. Use an AI client that can read documents and access development tools. Build and test requirements for your project remain those of that project.

## Use the skill

Currently, use the **skill documents directly from this repository**. An installable plugin and automatic activation have not been verified yet.

1. Make the [entry SKILL.md](skills/commerce-backend-expert/SKILL.md) available to your AI. If moving it, copy the entire `commerce-backend-expert/` folder.
2. Provide the relevant project and business conditions, and specify the requested task.
3. Review the rules read, code locations, changes, executed tests, and unresolved conditions.

Reference the entry SKILL.md path and ask, for example:

> Read this skill and review my payment webhook. Trace callers, upstream validation, and persistence. Distinguish applicable guidance, confirmed defects, and remaining checks.

| Task | Example request |
|---|---|
| Design | “Design recovery for direct database stock deduction and a lost payment approval response.” |
| Implementation | “Use a date/sequence business key to prevent duplicates; check midnight retries and request-content conflicts.” |
| Refactoring | “Simplify stock deduction while preserving returns, exceptions, transactions, and side-effect order.” |
| Incident analysis | “An approval response was lost. Explain what to inspect using the original transaction and state history.” |

## Read only relevant guidance

The entry skill selects a domain index, then reads the required rules. It does not load the entire catalog for every request.

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

The shared [plugin.json](plugin.json) and client entrypoints below use the same `skills/` source without copying knowledge. The unpublished development version is `0.3.0-dev.0`. **Format/path checks and actual client installation/activation are separate.**

| Client | Configuration |
|---|---|
| Codex | Skill registration in [.codex-plugin/plugin.json](.codex-plugin/plugin.json) |
| Claude Code | Skill registration in [.claude-plugin/plugin.json](.claude-plugin/plugin.json) |
| Cursor | [.cursor-plugin/plugin.json](.cursor-plugin/plugin.json) and an [optional routing rule](.cursor/rules/commerce-backend.mdc) |
| OpenClaw | Shared bundle, or the [extra skill directory example](.openclaw/skills.example.json). Replace the absolute path and merge into existing configuration; this example is not applied automatically. |

The [Claude](hooks/claude.json) and [Cursor](hooks/cursor.json) hooks are **optional checks for developers editing this skill's knowledge**. They are not registered by default and do not inspect ordinary user-project code. They require Node.js 22 or later and the [hook setup steps](CONTRIBUTING.md#optional-development-hooks). Using the skill requires no hook.

## Interpret the results

Check each rule's conditions, exceptions, evidence scope, and review state. `active` means in use, not certified accurate. Nineteen rules are `needs-review`. `not-recorded` under `verifiedBy` or `lastReviewedAt` means there is no recorded review.

The migrated documents were evaluated on seven synthetic development tasks. This does not establish live DB/PG behavior, automatic skill selection after installation, or correctness across all tasks. No token or response-time improvement is claimed. See [validation and its limits](CONTRIBUTING.md#validation).

## Existing MCP users

This branch now uses **Markdown as the sole knowledge source**. The old YAML, Java MCP, Gradle build, npm launcher, and JRE download path have been removed. Existing MCP settings cannot run this branch.

The public v0.2.2 source and instructions remain in the [v0.2.2 tag](https://github.com/dakcoh/commerce-context-mcp/tree/v0.2.2) and the local `legacy/v0.2.2` backup branch. These source changes do not modify published npm/JAR artifacts or tags. Plugin publication, installation, and update guidance will follow distribution validation.

For knowledge changes and developer checks, see [Contributing](CONTRIBUTING.md).
