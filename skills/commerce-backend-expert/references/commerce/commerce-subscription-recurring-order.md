# 구독과 정기배송: 반복 결제와 반복 주문을 분리한다

- id: commerce-subscription-recurring-order
- domain: commerce
- category: subscription
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정기배송은 구독 계약, 회차별 주문, 결제 시도, 배송 스케줄을 각각 추적해야 한다.

## 적용 조건

- commerce 도메인의 subscription 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

구독 커머스는 매월 같은 상품을 자동 주문하지만 가격, 재고, 결제수단, 배송지, 쿠폰 조건이 매 회차 달라질 수 있다.
한 번의 결제 실패가 전체 구독 해지인지 일시 보류인지 정책이 필요하다.

## 업무 맥락

구독 커머스는 매월 같은 상품을 자동 주문하지만 가격, 재고, 결제수단, 배송지, 쿠폰 조건이 매 회차 달라질 수 있다.
한 번의 결제 실패가 전체 구독 해지인지 일시 보류인지 정책이 필요하다.

## 반드시 지켜야 할 원칙

- subscription 계약과 recurring order 회차를 분리한다.
- 회차 생성 전 가격, 재고, 배송 가능 여부, 결제수단 유효성을 다시 검증한다.
- 결제 실패, 일시정지, 해지, 건너뛰기 상태를 명확히 구분한다.

## 권장 흐름

- 구독 계약에 상품·주기·배송지와 자동결제 동의·토큰 참조·적용 정책 버전을 저장한다. 토큰 원문 보존·접근·폐기는 PG 계약과 보안 정책을 따른다.
- 회차 생성 예정일에 견적을 재계산하고 주문 후보를 만든다.
- 결제 성공 시 주문을 확정하고 배송 처리를 시작한다.
- 결제 확정 실패는 계약상 재시도·알림·보류·해지 정책을 적용한다. 미확정 응답은 동일 시도·같은 키로 조회·대사하고 새 시도로 재청구하지 않는다.
- 해지와 회차 생성·청구 경합은 계약상 효력 시점과 조건부 상태 전이로 제어한다. 이미 승인된 청구의 취소·환불 여부와 늦은 승인 보상도 별도로 추적한다.

## 기술 구현 참고

- subscription, subscription_cycle, recurring_payment_attempt를 분리한다.
- 회차 생성 배치는 subscriptionId + cycleNo에 UNIQUE 제약을 둔다.
- 결제수단 토큰 만료와 PG 자동결제 실패 코드를 별도로 처리한다.

## 실패 시나리오

- 배치 중복 실행으로 같은 회차 주문이 두 번 생성된다.
- 가격 변경을 반영하지 않고 오래된 구독 금액으로 결제한다.
- 결제 실패 구독의 재고 예약이 해제되지 않는다.

## 검토 체크리스트

- [ ] 구독 계약과 회차별 주문이 분리되어 있는가?
- [ ] 회차 생성이 멱등하고 가격/재고를 재검증하는가?
- [ ] 결제 실패 재시도와 보류 정책이 있는가?
- [ ] 해지·청구 경합과 미확정 결제 대사, 자동결제 동의·토큰 폐기 경로가 있는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/commerce.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- subscription
- recurring-order
- billing
- batch
- payment-token
- schedule

## 관련 규칙

- [payment-idempotency](../payment/payment-idempotency.md)
- [network-cancellation](../payment/network-cancellation.md)
- [spring-resilience-retry-timeout](../spring-commerce/spring-resilience-retry-timeout.md)
