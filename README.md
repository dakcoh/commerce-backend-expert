# Commerce Context MCP

English · [한국어](README.ko.md)

[![npm version](https://img.shields.io/npm/v/commerce-context-mcp)](https://www.npmjs.com/package/commerce-context-mcp)
[![CI](https://github.com/dakcoh/commerce-context-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/dakcoh/commerce-context-mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/commerce-context-mcp)](LICENSE)

**An MCP server that helps AI coding tools find design rules and review Korean ecommerce backends.**

The catalog contains 70 rules covering inventory, payments, coupons, settlement, orders, shipping, customers, and Java/Spring. Your AI client can retrieve relevant guidance, check when it applies, and use it while reviewing code or designs.

The documentation is available in English and Korean. **The knowledge catalog is currently in Korean.** The server uses keyword search; it does not translate queries. Ask your AI client to search with relevant Korean terms and explain the retrieved guidance in your preferred language. English search quality has not been established by the current regression suite.

## What can it help with?

- **Use shared review criteria.** Retrieve 70 Korean ecommerce rules and use the same checks for design, implementation, and code review.
- **Review failure and recovery flows.** Get checks for duplicate requests, unknown payment outcomes, and partial refunds alongside the normal flow.
- **Check when guidance applies.** Read each rule's conditions, exceptions, recorded references, and review status before applying it to your code.
- **Connect without installing a JDK.** With Node.js 22 or later and an MCP client, the launcher prepares a private Java 21 runtime on first launch.

Describe the business scenario and provide the relevant code, then ask for a review:

| Concern | Example request to your AI client |
|---|---|
| Overselling | “Review a design that deducts inventory directly in the database without reservations.” |
| Unknown payment outcome | “Check the lookup and retry flow when a payment provider's response is lost.” |
| Duplicate webhooks | “Find missing signature checks and duplicate-event handling.” |
| Partial refunds | “Review coupon and point allocation, including rounding.” |
| Settlement differences | “List the checks for reconciling a finalized statement against actual payouts.” |

The server provides design guidance. It does not execute orders, payments, or refunds, and does not treat one company's business policies as universal rules.

## Quick start

Version 0.2.2 requires **Node.js 22 or later and an AI client that supports local STDIO MCP servers**.

> **Automatic preparation of a private Java runtime is available from 0.2.0.** Update the package if you use an earlier version. To check unpublished source changes, follow the [local package validation guide](CONTRIBUTING.md#local-validation).

You do not need to install a JDK or configure `JAVA_HOME`. npm installation requires no Java. On first launch, the package downloads, verifies, and caches a private Java 21 runtime and the server JAR. It does not change your system Java, `JAVA_HOME`, or `PATH`.

Prepare the runtime and server, then check the cache:

```bash
node -v
npx -y commerce-context-mcp download
npx -y commerce-context-mcp doctor
```

Register the server with your client.

**Codex CLI**

```bash
codex mcp add commerce-context -- npx -y commerce-context-mcp
```

**Claude Code**

```bash
claude mcp add --transport stdio commerce-context -- npx -y commerce-context-mcp
```

For clients using JSON configuration, connection troubleshooting, and cache recovery, see the [installation guide](npm/README.md). Check the connection after registration and start a new conversation:

> “Use commerce-context to review this payment webhook. Search the Korean catalog for relevant rules, then explain their applicability and any remaining checks in English.”

npm installation only installs the launcher. Downloads happen on first launch or with `download`; subsequent launches reuse verified caches. Run `download` in advance to reduce the wait during the first MCP connection. The server needs no separate LLM API key. Your AI client's subscription and data handling terms still apply.

## Reading the results

| Field or label | Meaning and next step |
|---|---|
| `matchConfidence`, `queryCoverage` | Query-to-rule search match, not a factual accuracy score. |
| `project-guidance` | Guidance maintained by this project, not independent external verification. |
| `external-source` | Guidance with external references. Check their scope; this does not establish that the entire rule is verified. |
| `needs-review` | Check applicability, evidence, and review records before relying on the rule. |
| `verifiedBy`, `lastReviewedAt` | Actual review records; JSON contains `null` when no record exists. |
| `partial: true` | Only part of a checklist was returned. Narrow the scenario and request more. |
| `analysisTruncated: true` | Only selected sections of a large input were searched. Retry with the relevant code. |

`active` means a rule is enabled in the catalog. Neither an empty search nor a review candidate establishes whether a defect exists. Check current official material, actual code, and the operating environment for payment contracts, legal, tax, and security decisions.

## Tools

| Tool | Purpose |
|---|---|
| `search_knowledge` | Find rules relevant to a query. |
| `get_rule` | Read a full rule, applicability, exceptions, and evidence. |
| `get_checklist` | Retrieve checks for a domain or scenario. |
| `review_commerce_design` | Find review candidates in a design, API, DDL, or code excerpt. |

Your client invokes the tools; you do not need to type a tool name in every message. Search, rule, and checklist calls accept `responseFormat: "json"` to avoid duplicate Markdown. See the [usage guide](docs/USAGE_SCENARIOS.md) for actual tool arguments.

## Supported environment and scope

The server runs locally over STDIO. Knowledge retrieval uses the YAML packaged in the JAR, without an external LLM, database, or HTTP server. Your connected AI client decides how tool results are used and which data is sent to its provider.

**npm users do not need to install a JDK or JRE.** With Node.js 22 or later and an MCP client, the launcher automatically downloads, verifies, and uses a private Temurin JRE 21 on first launch.

Supported platforms are Windows, macOS, and glibc-based Linux, for x64 and ARM64. Extraction needs the OS `tar` command, included with Windows 10/11 and macOS. Alpine/musl and 32-bit systems are unsupported.

**For source developers:** JDK 21 is required only when building the source code yourself.

[Plugin installation packaging](CONTRIBUTING.md#plugin-installation-package) is planned.

## Documentation

- [Installation, connection, and troubleshooting](npm/README.md)
- [Usage scenarios, result interpretation, and all 70 rules](docs/USAGE_SCENARIOS.md)
- [Contributing, validation, runtime policy, and releases](CONTRIBUTING.md)
- [한국어 안내](README.ko.md)

## Public data and license

Licensed under [MIT](LICENSE). The default YAML catalog is included in the source repository and distributed JAR. Contribute only public, general guidance; do not add company policies, contracts, private material, customer data, or keys. Separate storage and loading of private knowledge are future work.
