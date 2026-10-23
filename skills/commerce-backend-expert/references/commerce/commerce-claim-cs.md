# 클레임과 CS: 취소, 교환, 반품, 환불을 상태와 책임으로 나눈다

- id: commerce-claim-cs
- domain: commerce
- category: claim
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

고객 클레임은 단순 주문 취소가 아니라 요청, 승인, 회수, 검수, 환불, 정산 조정의 흐름이다.

## 적용 조건

- commerce 도메인의 claim 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

고객은 주문 이후 취소, 교환, 반품, 환불, 배송 문의를 요청한다.
각 요청은 주문 상태, 배송 상태, 결제 상태, 정산 상태와 연결되며 판매자 귀책과 고객 귀책에 따라 비용 부담이 달라진다.

## 업무 맥락

고객은 주문 이후 취소, 교환, 반품, 환불, 배송 문의를 요청한다.
각 요청은 주문 상태, 배송 상태, 결제 상태, 정산 상태와 연결되며 판매자 귀책과 고객 귀책에 따라 비용 부담이 달라진다.

## 반드시 지켜야 할 원칙

- claim_request는 주문 상태 변경과 분리해 이력으로 관리한다.
- 귀책 주체와 비용 부담 주체를 기록한다.
- 교환과 반품은 회수 및 검수 결과에 따라 후속 처리가 달라진다.

## 권장 흐름

- 고객 클레임 요청을 접수하고 요청 가능 상태를 검증한다.
- 운영자 또는 정책 엔진이 승인, 거절, 보류를 결정한다.
- 회수, 검수, 환불, 재배송, 정산 조정을 순서대로 처리한다.
- 모든 수동 조치는 행위자와 사유를 감사 로그에 남긴다.

## 기술 구현 참고

- claim_request, claim_item, claim_history, claim_cost_allocation을 분리한다.
- 환불 가능 금액은 원 결제, 쿠폰, 포인트, 정산 상태를 기준으로 계산한다.
- CS 수동 보정은 원장 조정 거래로 남기고 단순 값 수정으로 처리하지 않는다.

## 실패 시나리오

- 배송 완료 상품을 단순 주문 취소로 처리해 회수와 검수가 누락된다.
- 판매자 귀책 배송비를 고객에게 청구한다.
- 운영자 수동 환불의 사유와 근거가 남지 않는다.

## 검토 체크리스트

- [ ] 취소, 교환, 반품, 환불 요청 상태가 분리되어 있는가?
- [ ] 귀책 주체와 비용 부담 주체가 기록되는가?
- [ ] 수동 CS 조치가 원장과 감사 로그에 남는가?

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

- claim
- cs
- cancel
- exchange
- return
- refund
- audit
