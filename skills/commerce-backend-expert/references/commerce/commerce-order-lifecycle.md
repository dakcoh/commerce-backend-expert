# 주문 생명주기: 상태 전이와 이력을 명시한다

- id: commerce-order-lifecycle
- domain: commerce
- category: order
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

주문 상태를 임의로 덮어쓰지 말고 허용된 전이, 전이 사유, 행위자를 기록한다.

## 적용 조건

- commerce 도메인의 order 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

주문은 생성, 결제, 상품 준비, 배송, 구매 확정, 취소, 반품으로 이어진다.
주문 전체와 주문 라인의 상태가 다를 수 있으며, 부분 취소와 부분 배송이 흔하다.

## 업무 맥락

주문은 생성, 결제, 상품 준비, 배송, 구매 확정, 취소, 반품으로 이어진다.
주문 전체와 주문 라인의 상태가 다를 수 있으며, 부분 취소와 부분 배송이 흔하다.

## 반드시 지켜야 할 원칙

- 허용된 상태 전이만 수행한다. PAID 주문을 CREATED로 되돌리지 않는다.
- 주문 전체 상태와 주문 라인 상태를 분리한다.
- 상태 변경 이력에 이전 상태, 이후 상태, 사유, 행위자, 발생 시각을 기록한다.

## 권장 흐름

- CREATED 상태에서 주문을 생성하고 결제 대기 시간을 제한한다.
- 결제 성공 후 PAID, 출고 준비 후 FULFILLING, 배송 완료 후 DELIVERED로 전이한다.
- 부분 취소와 반품은 주문 라인 단위로 처리하고 주문 전체 상태를 다시 계산한다.
- 사용자 취소 의사와 결제의 늦은 승인이 경합하면 원 결제 시도를 조회하고 조건부 상태 전이·멱등 보상으로 대사한다. 취소 요청만으로 승인 실패를 확정하거나 늦은 승인으로 취소 의사를 덮지 않는다.

## 기술 구현 참고

- 상태 전이 메서드를 엔티티 또는 도메인 서비스에 모으고 임의 setter 사용을 피한다.
- 동시 변경에는 version 컬럼 또는 조건부 UPDATE를 사용한다.
- order_status_history를 append-only 이력으로 유지한다.

## 실패 시나리오

- 결제 웹훅과 사용자 취소 요청이 동시에 도착해 잘못된 상태가 저장된다.
- 한 상품만 취소했는데 주문 전체가 취소된다.
- 운영자가 상태 변경 원인을 추적할 수 없다.

## 검토 체크리스트

- [ ] 주문과 주문 라인의 상태가 분리됐는가?
- [ ] 허용 상태 전이 표가 있는가?
- [ ] 상태 변경 이력과 동시성 제어가 있는가?

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

- order
- lifecycle
- state-machine
- history
- partial-cancel
