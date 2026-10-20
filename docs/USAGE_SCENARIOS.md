# Usage guide

English · [한국어](USAGE_SCENARIOS.ko.md)

Connect the server using the [installation guide](../npm/README.md). Users need Node.js 22 or later; the private Java 21 runtime is prepared automatically on first launch or with `download`. JDK 21 is only needed to build from source. These instructions describe version 0.2.1. To check unpublished source changes, follow [local validation](../CONTRIBUTING.md#local-validation).

**The catalog and returned guidance are currently Korean.** The examples intentionally keep tested Korean search terms. English explanations below describe how to use them; the server does not translate an English query. Ask your AI client to search with Korean terms and explain the result in English. English retrieval quality is not established by these tests.

Give your AI client the **business scenario, failure mode, and relevant code**. The server supplies general design guidance; it does not execute orders, payments, or payouts.

Workflow: describe a problem → search for rules → read applicability and exceptions → judge against actual code and contracts. The JSON below shows MCP tool arguments used by a client. You do not need to paste it verbatim into ordinary chat.

Restaurant or clinic booking cancellation fees do not imply stock reservation guidance. If you are asking about that service's payment/refund API, coupons, or inventory design, include that context. For example, “식당 예약 환불 API 설계” retrieves refund guidance. No search results means insufficient relevance or coverage; it does not establish that a design is correct.

[Scenarios](#1-prevent-overselling) · [Checklists](#find-missing-checklist-items) · [Interpreting results](#choose-the-next-step-from-the-result) · [All 70 rules](#rule-catalog)

## 1. Prevent overselling

> “Review a design that deducts stock directly in the database without reservations. Check whether concurrent orders can oversell.”

```json
{"name":"search_knowledge","arguments":{"query":"예약 없이 DB 조건부 차감","domain":"inventory,commerce","topK":5,"responseFormat":"json"}}
```

Read `stock-reservation` and `available-stock-query` for the quantity semantics of reservation and immediate-deduction models. Check atomic stock acquisition when placing the order and exactly-once restoration after failure or cancellation. The presence of reservation state or Redis alone does not establish a defect; inspect database constraints, competing updates, and recovery.

## 2. Issue limited coupons using only a database

> “We want to enforce the issuance limit and prevent duplicate issuance without Redis. What conditions should we check?”

```json
{"name":"search_knowledge","arguments":{"query":"Redis 안 쓰고 DB로 쿠폰 발급","domain":"coupon","topK":5,"responseFormat":"json"}}
```

Read `coupon-issuance` and `coupon-issuance-compensation` for business keys, unique constraints, atomic quantity acquisition, and transaction boundaries. With Redis, also check failure, retry, and compensation between reservation and database confirmation. Issuance rounds, eligibility, and per-user limits depend on business policy.

## 3. Resolve a missing payment response

> “The payment request timed out. Can we mark it failed and start a new payment?”

```json
{"name":"search_knowledge","arguments":{"query":"결제 응답 타임아웃 미확정 조회 망취소","domain":"payment","topK":5,"responseFormat":"json"}}
```

Read `network-cancellation`, `payment-status-machine`, and `payment-idempotency` together. Distinguish a lost response from an actual failure. Resolve the outcome using the same logical attempt's key, provider lookups, webhooks, and reconciliation. Support for cancellation after an uncertain network response and retry timing depends on the provider contract; a timeout alone does not justify cancellation and a new approval.

## 4. Handle duplicate payment webhooks

> “Review webhook signature checks, receipt records, duplicate-event handling, and order state transitions.”

```json
{"name":"search_knowledge","arguments":{"query":"결제 웹훅 서명 검증 중복 이벤트 멱등성","domain":"payment","topK":5,"responseFormat":"json"}}
```

Retrieve the full rule:

```json
{"name":"get_rule","arguments":{"ruleId":"webhook-handling","responseFormat":"json"}}
```

In `webhook-handling`, check the order of validation, durable acceptance, and processing, plus event-specific deduplication keys. A payment ID alone must not discard distinct approval or partial-cancellation events. Check response status codes and deadlines against the provider contract.

You can also supply code and a scenario:

```json
{"name":"review_commerce_design","arguments":{"artifact":"@PostMapping(\"/webhook\") public void receive(PaymentEvent event) { order.markPaid(event.orderId()); }","artifactType":"code","domain":"payment","scenario":"결제 웹훅 서명 검증과 중복 이벤트 멱등성 처리","maxFindings":5}}
```

`review-required` marks a candidate that needs investigation. Another layer may perform the omitted validation or enforce a database constraint. Trace actual callers. `matchedEvidence` contains matched search terms, not execution evidence establishing a defect.

## 5. Investigate partial-refund differences

> “Review coupon and point allocation, rounding, and in-progress refunds when canceling part of an order.”

```json
{"name":"search_knowledge","arguments":{"query":"부분 환불 쿠폰 배부 반올림","domain":"payment,commerce,coupon","topK":5,"responseFormat":"json"}}
```

Read `partial-refund` and `commerce-promotion-allocation` for the policy version and line allocations captured at order time. Check atomic enforcement of refund limits, including completed, in-progress, and unresolved refunds. Coupon and point retention, recovery, or restoration depends on business policy; do not assume full restoration.

## 6. Reconcile settlement statements and actual payouts

> “A return occurred after payout. What should we compare between the finalized statement and the bank transfer?”

```json
{"name":"search_knowledge","arguments":{"query":"정산 명세 실제 지급액","domain":"settlement","topK":5,"responseFormat":"json"}}
```

Read `settlement-statement`, `settlement-payout`, and `settlement-deduction` for statement snapshots, adjustments linked to original transactions, deductions, successful payout totals, holds, and unpaid balances. Do not treat an unresolved transfer as a failure and pay again. Verify contractual and official requirements for deductions, offsetting, recovery, and taxes.

## Find missing checklist items

```json
{"name":"get_checklist","arguments":{"domain":"commerce","responseFormat":"json"}}
```

A checklist selects at most **ten rules**; it does not truncate the result to ten questions. `domainRuleCount` is the number of rules with checklists in the original domain. If `partial: true`, narrow the scenario and request further checks. Identical question text with different applicability or trust context remains distinct.

See the [rule catalog](#rule-catalog) for full coverage. Clients supporting resources can read a domain summary at `commerce://domains/commerce` or a full rule at `commerce://rules/{ruleId}`.

## Choose the next step from the result

| Result | Next step |
|---|---|
| `answerable: false` or no candidates | Specify the business function and failure scenario. This does not establish that no defect exists. |
| Tool `isError: true` | Fix argument names, types, filters, and bounds, then retry. |
| Resource JSON-RPC error | Check the URI, domain, or rule ID. |
| `partial: true` | Part of the checklist was returned; check omitted rules and scenarios. |
| `analysisTruncated: true` | Selected sections of a large input were searched; retry with the relevant function or failure path. |
| `needs-review` or missing review records | Verify applicability, current official sources, and actual review records. |
| Checksum or lock failure | Follow the [installation guide](../npm/README.md); do not remove an active download lock. |

General search uses at most 32 distinct terms. Review of long input uses the original text and scenario plus at most 32 additional windows; `analyzedChunks` counts the added windows. This is not whole-program semantic or execution analysis.

For search, rule, and checklist calls, `responseFormat: "json"` preserves conditions and evidence without duplicate Markdown. Search with `detail: "full"` also puts full rules in `fullRules`. Review does not accept these options. Search/review accept a CSV domain list; checklist accepts a single domain.

The JSON tool examples in this document run through the actual MCP smoke test to check arguments and response contracts. A successful call does not establish the quality of an AI's final answer. For comparisons, see [real AI evaluation](../CONTRIBUTING.md#evaluating-real-ai-workflows). Check your AI client's data handling settings before supplying sensitive material.

## Rule catalog

Six domains, 70 rules. Retrieve full guidance by ID with `get_rule`, and read severity, applicability, evidence, and actual review records together. The source catalog is [knowledge YAML](../src/main/resources/knowledge). The descriptions below are English summaries; the returned rule content remains Korean.

### Inventory `inventory` — 8 rules

| Rule ID | Topic |
|---|---|
| `stock-reservation` | Reservation and immediate-deduction models: hold, confirm, and restore stock |
| `available-stock-query` | Available stock and atomic deduction for the selected inventory model |
| `concurrency-optimistic` | Optimistic locking when contention is low |
| `concurrency-pessimistic` | Pessimistic locking under contention and deadlock handling |
| `concurrency-distributed` | Distributed locks, database safeguards, and fencing |
| `idempotency` | Duplicate-request protection and result reuse |
| `saga-pattern` | Compensation across orders, payments, and inventory |
| `ai-pitfalls-checklist` | Inventory implementation checks |

### Payments `payment` — 7 rules

| Rule ID | Topic |
|---|---|
| `webhook-handling` | Webhook signatures, durable acceptance, and asynchronous processing |
| `payment-status-machine` | Transitions and guards for PENDING, UNCERTAIN, PAID, and other states |
| `duplicate-payment-guard` | Prevent duplicate payment using state, idempotency keys, and provider transaction IDs |
| `network-cancellation` | Lookups and outcome resolution after an uncertain response |
| `partial-refund` | Order-line discount allocation snapshots and rounding policies |
| `payment-idempotency` | Reuse keys for the same logical attempt; distinguish new attempts |
| `payment-ai-pitfalls-checklist` | Payment implementation checks |

### Settlement `settlement` — 9 rules

| Rule ID | Topic |
|---|---|
| `settlement-timing` | Purchase confirmation and settlement reference dates |
| `settlement-deduction` | Fees, returns, cost sharing, and other deductions |
| `settlement-cycle` | Settlement batches, pagination, idempotency, and restart |
| `settlement-integrity` | Reconcile amounts, counts, duplicates, omissions, and time zones |
| `settlement-statement` | Snapshot rates and amounts at finalization |
| `settlement-tax` | Tax boundaries requiring verification, including VAT and withholding |
| `settlement-hold` | Dispute holds and release history |
| `settlement-payout` | Separate settlement finalization from actual transfer; preserve idempotency |
| `settlement-ai-pitfalls-checklist` | Settlement implementation checks |

### Coupons and promotions `coupon` — 6 rules

| Rule ID | Topic |
|---|---|
| `coupon-validation` | Validity period, eligibility, minimum spend, duplicates, and status |
| `coupon-discount-calculation` | Percentage/fixed discounts, caps, line allocation, and rounding |
| `coupon-issuance` | Atomic limited-quantity issuance and per-user duplicate checks |
| `coupon-issuance-compensation` | Redis reservation, database confirmation, compensation, and reprocessing |
| `promotion-rules` | Rule priority and allowed combinations |
| `coupon-ai-pitfalls-checklist` | Coupon and promotion implementation checks |

### Commerce `commerce` — 20 rules

| Rule ID | Topic |
|---|---|
| `commerce-catalog-model` | Separate Product, SKU, and Offer |
| `commerce-pricing-money` | Money types and snapshots of calculation inputs |
| `commerce-order-lifecycle` | Order state transitions and history |
| `commerce-inventory-availability` | On-hand, reserved, and available-to-sell quantities |
| `commerce-payment-ledger` | Separate order state from the payment transaction ledger |
| `commerce-fulfillment-reverse-logistics` | Shipping, returns, and reverse logistics |
| `commerce-promotion-allocation` | Benefit calculation, allocation, and usage history |
| `commerce-channel-seller-distribution` | Source records and channel-specific presentation |
| `commerce-settlement-reconciliation` | Transaction-ledger-based settlement and reconciliation |
| `commerce-operational-integrity` | Trace events, batches, and manual actions |
| `commerce-customer-identity` | Member, guest, and recipient identities |
| `commerce-cart-checkout` | Separate provisional quotes from confirmed orders |
| `commerce-search-discovery` | Separate search indexes from source records |
| `commerce-claim-cs` | Cancellation, exchange, return, refund states, and responsibility |
| `commerce-security-privacy` | Data minimization, access boundaries, and audit |
| `commerce-loyalty-point-ledger` | Point balances and accrual/redemption ledgers |
| `commerce-membership-tier-benefits` | Tier calculation and benefit application timing |
| `commerce-review-ugc-moderation` | Review permissions, visibility, reports, and moderation |
| `commerce-subscription-recurring-order` | Separate recurring payment from recurring order creation |
| `commerce-ops-slo-incident` | Customer-impact-based SLOs and incident response |

### Java/Spring `spring-commerce` — 20 rules

| Rule ID | Topic |
|---|---|
| `spring-commerce-modular-monolith` | Start with a modular monolith |
| `spring-commerce-transaction-boundary` | Short, explicit transaction boundaries |
| `spring-commerce-jpa-consistency` | Separate entities from read models |
| `spring-commerce-locking-idempotency` | Concurrency, idempotency, and database constraints |
| `spring-commerce-validation-errors` | Separate input validation from business errors |
| `spring-commerce-events-outbox` | Outbox and idempotent consumers |
| `spring-commerce-cache-boundary` | Authoritative database state and Redis acceleration |
| `spring-commerce-scheduler-batch` | Prevent duplicate batch execution and support restart |
| `spring-commerce-testing-observability` | Invariant tests and observability |
| `java-domain-modeling` | Meaningful value types and domain models |
| `java-null-exception-boundary` | Null and exception contracts |
| `java-collections-streams` | Large collections and stream side effects |
| `spring-security-authz` | Separate authentication, authorization, and ownership checks |
| `spring-configuration-secrets` | Separate environment configuration and secrets |
| `spring-schema-migration` | Schema changes without downtime |
| `spring-api-pagination-idempotent-post` | Pagination and idempotent POST |
| `spring-database-index-isolation` | Indexes, isolation levels, and consistency |
| `java-concurrency-executor-completablefuture` | Executors and asynchronous boundaries |
| `spring-resilience-retry-timeout` | Timeouts, retries, and circuit breakers |
| `spring-deployment-health-rollout` | Readiness, gradual rollout, and rollback |
