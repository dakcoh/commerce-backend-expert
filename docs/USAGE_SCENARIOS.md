# 사용 가이드

[설치·연결 가이드](../npm/README.md)에서 서버를 먼저 연결하세요. 일반 사용자는 Node.js 22 이상을 준비하며, 전용 Java 21 런타임은 첫 실행이나 `download`에서 자동으로 받습니다. 소스 빌드에 필요한 JDK 21과 사용자 실행 환경은 별개입니다. 이 설명은 0.2.0 기준입니다. 소스에서 확인할 때는 [로컬 검증](../CONTRIBUTING.md#로컬에서-검증하기) 절차를 사용합니다.

연결한 AI에게 **업무·실패 상황·확인할 코드**를 함께 알려주세요. 이 서버는 범용 설계 지침을 제공하며 실제 주문·결제·지급을 실행하지 않습니다.

사용 순서는 질문 → 관련 규칙 검색 → 전문의 적용 조건·예외 확인 → 현재 코드와 계약에 맞춰 판단입니다. 아래 JSON은 AI/MCP 클라이언트가 호출할 인자이며 사용자가 채팅에 그대로 입력할 필요는 없습니다.

[업무 예시](#1-재고-초과-판매를-막고-싶어요) · [체크리스트](#체크리스트로-빠진-항목을-보고-싶어요) · [결과 해석](#결과에-따라-다음-행동을-정하세요) · [70개 규칙](#규칙-목록)

## 1. 재고 초과 판매를 막고 싶어요

> “예약 없이 DB에서 재고를 차감합니다. 동시 주문으로 초과 판매가 생기지 않는지 검토해줘.”

```json
{"name":"search_knowledge","arguments":{"query":"예약 없이 DB 조건부 차감","domain":"inventory,commerce","topK":5,"responseFormat":"json"}}
```

`stock-reservation`, `available-stock-query`에서 예약형과 즉시 차감형의 수량 의미를 확인합니다. 선택한 모델에서 주문 시 원자적으로 확보하고 실패·취소 때 한 번만 복구되는지 봅니다. 예약 상태나 Redis의 유무만으로 결함을 확정하지 말고 DB 제약·경쟁·복구 경로를 확인하세요.

## 2. DB만으로 선착순 쿠폰을 발급하고 싶어요

> “Redis 없이 DB로 발급 한도와 사용자 중복을 막으려고 해. 이 구조에서 확인할 조건을 알려줘.”

```json
{"name":"search_knowledge","arguments":{"query":"Redis 안 쓰고 DB로 쿠폰 발급","domain":"coupon","topK":5,"responseFormat":"json"}}
```

`coupon-issuance`, `coupon-issuance-compensation`에서 업무키·유일 제약·수량 확보와 기록의 트랜잭션 경계를 확인합니다. Redis를 쓴다면 선점과 DB 확정 사이의 실패·재시도·보상도 봅니다. 발급 회차·자격·사용자 한도는 사업 정책에 맞춰 결정합니다.

## 3. 결제 요청의 응답을 받지 못했어요

> “PG 요청이 timeout 됐어. 실패 처리하고 새 결제를 요청해도 되는지 검토해줘.”

```json
{"name":"search_knowledge","arguments":{"query":"결제 응답 타임아웃 미확정 조회 망취소","domain":"payment","topK":5,"responseFormat":"json"}}
```

`network-cancellation`, `payment-status-machine`, `payment-idempotency`를 함께 읽습니다. 응답 유실과 실제 실패를 구분하고 같은 논리 시도의 키·조회·웹훅·대사로 결과를 확인하는 흐름을 봅니다. 망취소 지원과 재시도 시점은 PG 계약에 따르며 모든 timeout을 즉시 취소·재승인으로 처리하지 않습니다.

## 4. 결제 웹훅이 중복으로 들어와요

> “웹훅의 서명 확인·수신 기록·중복 처리·주문 상태 전이를 검토해줘.”

```json
{"name":"search_knowledge","arguments":{"query":"결제 웹훅 서명 검증 중복 이벤트 멱등성","domain":"payment","topK":5,"responseFormat":"json"}}
```

찾은 규칙의 전문을 확인합니다.

```json
{"name":"get_rule","arguments":{"ruleId":"webhook-handling","responseFormat":"json"}}
```

`webhook-handling`에서 검증·내구성 있는 인수·후처리 순서와 이벤트별 중복키를 확인합니다. 결제 번호 하나로 승인과 여러 부분 취소를 모두 제거하지 않는지도 봅니다. 성공 응답 코드와 제한시간은 PG 계약을 확인하세요.

코드와 업무 상황을 함께 전달할 수도 있습니다.

```json
{"name":"review_commerce_design","arguments":{"artifact":"@PostMapping(\"/webhook\") public void receive(PaymentEvent event) { order.markPaid(event.orderId()); }","artifactType":"code","domain":"payment","scenario":"결제 웹훅 서명 검증과 중복 이벤트 멱등성 처리","maxFindings":5}}
```

`review-required`는 추가 확인할 후보입니다. 다른 계층의 검증·DB 제약이 생략됐을 수 있으므로 실제 호출 흐름을 확인합니다. `matchedEvidence`는 검색 일치 단어이며 결함이 입증된 실행 증거는 아닙니다.

## 5. 부분 환불 금액이 맞지 않아요

> “상품 일부를 취소할 때 쿠폰·포인트·반올림·처리 중 환불액을 함께 검토해줘.”

```json
{"name":"search_knowledge","arguments":{"query":"부분 환불 쿠폰 배부 반올림","domain":"payment,commerce,coupon","topK":5,"responseFormat":"json"}}
```

`partial-refund`, `commerce-promotion-allocation`에서 주문 당시 정책 버전과 라인별 배부 결과를 확인합니다. 확정·처리 중·미확정 환불을 포함한 한도를 원자적으로 지키는지 봅니다. 쿠폰·포인트의 유지·회수·복원은 사업 정책이며 무조건 전액 복원으로 가정하지 않습니다.

## 6. 정산 명세와 실제 지급액이 달라요

> “지급 후 반품이 발생했어. 정산 명세와 은행 지급액을 비교할 기준을 정리해줘.”

```json
{"name":"search_knowledge","arguments":{"query":"정산 명세 실제 지급액","domain":"settlement","topK":5,"responseFormat":"json"}}
```

`settlement-statement`, `settlement-payout`, `settlement-deduction`에서 명세 스냅샷·원 거래에 연결한 보정·공제·성공 지급 누계·보류·미지급 잔액을 확인합니다. 미확정 이체를 실패로 단정해 재지급하지 않습니다. 공제·상계·회수와 세무 처리는 계약·공식 자료 확인이 필요합니다.

## 체크리스트로 빠진 항목을 보고 싶어요

```json
{"name":"get_checklist","arguments":{"domain":"commerce","responseFormat":"json"}}
```

체크리스트는 최대 **10개 규칙**에서 만들며 문항을 10개로 자르지 않습니다. `domainRuleCount`는 원래 도메인에서 체크리스트가 있는 규칙 수입니다. `partial: true`이면 일부만 반환됐으므로 시나리오별로 추가 조회하세요. 조건·검토 상태가 다른 동일 문항도 유지합니다.

전체 범위는 [아래 규칙 목록](#규칙-목록)에서 확인합니다. Resource를 지원하면 `commerce://domains/commerce`의 도메인 요약이나 `commerce://rules/{ruleId}`의 전문을 읽을 수도 있습니다.

## 결과에 따라 다음 행동을 정하세요

| 결과 | 다음 행동 |
|---|---|
| `answerable: false` 또는 후보 없음 | 업무·기능·실패 상황을 구체화하세요. 결함 없음으로 해석하지 않습니다. |
| Tool `isError: true` | 도구의 인자·타입·필터·범위를 확인하고 수정 후 재호출하세요. |
| Resource JSON-RPC 오류 | URI·domain·ruleId를 확인하세요. |
| `partial: true` | 일부 체크리스트입니다. 빠진 규칙과 시나리오를 추가 확인하세요. |
| `analysisTruncated: true` | 큰 입력의 일부 구간 검색입니다. 관심 함수·실패 경로로 좁혀 재검토하세요. |
| `needs-review` 또는 검토 기록 없음 | 적용 조건·현재 공식 근거·실제 검토를 보완하세요. |
| 체크섬·잠금 오류 | [설치 가이드](../npm/README.md)의 복구 절차를 따르고 활성 다운로드 잠금을 삭제하지 마세요. |

일반 검색은 중복 제외 최대 32개 검색어, 긴 입력 검토는 원문·시나리오 외 최대 32개 추가 구간을 사용합니다. `analyzedChunks`는 추가 구간 수입니다. 코드 전체 의미·실행 결과를 분석하는 기능은 아닙니다.

검색·규칙·체크리스트의 `responseFormat: "json"`은 조건·근거를 유지하고 Markdown 중복을 줄입니다. 검색에 `detail: "full"`을 함께 주면 `fullRules`에 전문이 있습니다. 검토 도구에는 이 옵션이 없습니다. 검색·검토의 domain은 CSV, 체크리스트는 단일 domain만 받습니다.

이 문서의 JSON 호출 예시는 실제 MCP smoke 테스트에서 실행해 인자·응답 계약을 검사합니다. 호출 성공과 실제 AI의 최종 답변 정확도는 구분합니다. 품질을 직접 비교하려면 [실제 AI 평가](../CONTRIBUTING.md#실제-ai-평가)를 참고하세요. 민감한 자료를 입력하기 전 연결한 AI 클라이언트의 데이터 취급 설정을 확인하세요.

## 규칙 목록

6개 영역·70개 규칙입니다. ID로 `get_rule`을 조회해 전문을 확인합니다. 위험도·적용 조건·근거와 실제 검토 기록을 함께 읽으세요. 원본은 [지식 YAML](../src/main/resources/knowledge)에 있습니다.

### 재고 `inventory` — 8개

| 규칙 ID | 주제 |
|---|---|
| `stock-reservation` | 예약형·즉시 차감형의 수량 확보·확정·복구 |
| `available-stock-query` | 선택한 재고 모델에 따른 가용 재고와 원자적 차감 |
| `concurrency-optimistic` | 충돌이 낮은 구간의 낙관 락 |
| `concurrency-pessimistic` | 충돌이 높은 구간의 비관 락과 교착상태 주의 |
| `concurrency-distributed` | 분산 락의 적용 조건, DB 안전망과 fencing |
| `idempotency` | 중복 요청 방어와 결과 재사용 |
| `saga-pattern` | 주문·결제·재고 사이의 보상 흐름 |
| `ai-pitfalls-checklist` | 재고 구현 누락 점검표 |

### 결제 `payment` — 7개

| 규칙 ID | 주제 |
|---|---|
| `webhook-handling` | 웹훅 서명 검증, 내구성 있는 인수, 비동기 후처리 |
| `payment-status-machine` | PENDING·UNCERTAIN·PAID 등 상태 전이와 가드 |
| `duplicate-payment-guard` | 상태·멱등성 키·PG 거래 ID를 통한 중복 결제 방어 |
| `network-cancellation` | 응답 불명확 상황의 조회와 상태 확정 |
| `partial-refund` | 주문 라인별 할인 배분 스냅샷과 반올림 정책 |
| `payment-idempotency` | 같은 논리 시도의 키 재사용과 새 시도의 구분 |
| `payment-ai-pitfalls-checklist` | 결제 구현 누락 점검표 |

### 정산 `settlement` — 9개

| 규칙 ID | 주제 |
|---|---|
| `settlement-timing` | 구매 확정과 정산 기준일 |
| `settlement-deduction` | 수수료·반품·분담금 등 공제 항목 |
| `settlement-cycle` | 정산 배치, 페이징, 멱등성과 재시작 |
| `settlement-integrity` | 금액·건수·중복·누락·타임존 대사 |
| `settlement-statement` | 확정 시점의 요율과 금액 스냅샷 |
| `settlement-tax` | 부가세·원천징수·면세 구분 시 확인할 경계 |
| `settlement-hold` | 분쟁·클레임 정산 보류와 해제 이력 |
| `settlement-payout` | 정산 확정과 실제 이체의 분리·멱등성 |
| `settlement-ai-pitfalls-checklist` | 정산 구현 누락 점검표 |

### 쿠폰·프로모션 `coupon` — 6개

| 규칙 ID | 주제 |
|---|---|
| `coupon-validation` | 기간·대상·최소 금액·중복·상태 검증 |
| `coupon-discount-calculation` | 정률·정액·상한·라인 배분과 반올림 |
| `coupon-issuance` | 선착순 발급의 원자적 재고·사용자 중복 검사 |
| `coupon-issuance-compensation` | Redis 선점, DB 확정, 보상과 재처리 |
| `promotion-rules` | 규칙 우선순위와 조합 가능성 |
| `coupon-ai-pitfalls-checklist` | 쿠폰·프로모션 구현 누락 점검표 |

### 커머스 공통 `commerce` — 20개

| 규칙 ID | 주제 |
|---|---|
| `commerce-catalog-model` | Product·SKU·Offer 분리 |
| `commerce-pricing-money` | 금액 타입과 계산 근거 스냅샷 |
| `commerce-order-lifecycle` | 주문 상태 전이와 이력 |
| `commerce-inventory-availability` | 실재고·예약·판매 가능 수량 |
| `commerce-payment-ledger` | 주문 상태와 결제 거래 원장 분리 |
| `commerce-fulfillment-reverse-logistics` | 배송과 반품 역물류 |
| `commerce-promotion-allocation` | 혜택 계산·배부·사용 이력 |
| `commerce-channel-seller-distribution` | 원장과 채널별 노출 모델 |
| `commerce-settlement-reconciliation` | 거래 원장 기반 정산과 대사 |
| `commerce-operational-integrity` | 이벤트·배치·수동 조치 추적 |
| `commerce-customer-identity` | 회원·비회원·수신자 식별자 |
| `commerce-cart-checkout` | 임시 견적과 확정 주문 분리 |
| `commerce-search-discovery` | 검색 인덱스와 원장 분리 |
| `commerce-claim-cs` | 취소·교환·반품·환불 상태와 책임 |
| `commerce-security-privacy` | 최소 수집·권한 경계·감사 |
| `commerce-loyalty-point-ledger` | 포인트 잔액과 적립·사용 원장 |
| `commerce-membership-tier-benefits` | 등급 산정과 혜택 적용 시점 |
| `commerce-review-ugc-moderation` | 리뷰 권한·노출·신고 처리 |
| `commerce-subscription-recurring-order` | 반복 결제와 반복 주문 분리 |
| `commerce-ops-slo-incident` | 고객 영향 기반 SLO와 장애 대응 |

### Java/Spring `spring-commerce` — 20개

| 규칙 ID | 주제 |
|---|---|
| `spring-commerce-modular-monolith` | 모듈형 모놀리스 시작 구조 |
| `spring-commerce-transaction-boundary` | 짧고 명확한 트랜잭션 경계 |
| `spring-commerce-jpa-consistency` | 엔티티와 조회 모델 분리 |
| `spring-commerce-locking-idempotency` | 동시성·멱등성과 DB 제약 |
| `spring-commerce-validation-errors` | 입력 검증과 비즈니스 오류 분리 |
| `spring-commerce-events-outbox` | Outbox와 멱등 Consumer |
| `spring-commerce-cache-boundary` | 원장과 Redis 가속 계층 분리 |
| `spring-commerce-scheduler-batch` | 배치 중복 실행과 재시작 |
| `spring-commerce-testing-observability` | 불변식 테스트와 관측성 |
| `java-domain-modeling` | 의미 있는 값 타입과 도메인 모델 |
| `java-null-exception-boundary` | null과 예외 계약 |
| `java-collections-streams` | 대량 컬렉션과 Stream 부작용 |
| `spring-security-authz` | 인증·인가·소유권 검증 분리 |
| `spring-configuration-secrets` | 환경 설정과 비밀 값 분리 |
| `spring-schema-migration` | 무중단 스키마 변경 |
| `spring-api-pagination-idempotent-post` | 페이지네이션과 멱등 POST |
| `spring-database-index-isolation` | 인덱스·격리 수준과 정합성 |
| `java-concurrency-executor-completablefuture` | Executor와 비동기 경계 |
| `spring-resilience-retry-timeout` | timeout·retry·circuit breaker |
| `spring-deployment-health-rollout` | readiness·점진 배포·롤백 |
