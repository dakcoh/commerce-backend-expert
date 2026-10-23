# 배송과 반품: 정방향 물류와 역물류를 함께 설계한다

- id: commerce-fulfillment-reverse-logistics
- domain: commerce
- category: fulfillment
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

주문 완료만 보지 말고 출고, 배송, 수령, 반품 회수, 검수, 재판매 가능 여부까지 추적한다.

## 적용 조건

- commerce 도메인의 fulfillment 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

유통에서는 주문이 결제됐다고 끝나지 않는다.
여러 창고와 판매자가 한 주문을 나눠 출고할 수 있고, 반품된 상품은 검수 결과에 따라 재판매 여부가 달라진다.

## 반드시 지켜야 할 원칙

- 주문 라인과 shipment를 분리하여 부분 출고와 합배송을 표현한다.
- 택배사 이벤트는 중복 수신 가능하므로 운송장 번호와 이벤트 ID로 멱등 처리한다.
- 반품 회수 완료와 재고 복구 가능 상태를 동일하게 취급하지 않는다.

## 권장 흐름

- 창고와 판매자 기준으로 출고 그룹을 생성한다.
- 운송장과 배송 이벤트를 기록한다.
- 반품 접수 후 회수, 입고 검수, 환불, 재고 복구 여부를 순서대로 처리한다.

## 기술 구현 참고

- shipment, shipment_item, delivery_event, return_request, return_inspection을 분리한다.
- 택배 이벤트는 append-only로 저장하고 현재 배송 상태를 projection으로 계산한다.
- 반품 재고는 검수 완료 전 sellable 재고에 더하지 않는다.

## 실패 시나리오

- 부분 배송인데 주문 전체를 배송 완료로 표시한다.
- 반품 회수 직후 불량 상품을 판매 가능 재고에 복구한다.
- 택배 이벤트 역전 도착으로 배송 상태가 과거로 되돌아간다.

## 검토 체크리스트

- [ ] 부분 출고, 합배송, 멀티 창고를 표현할 수 있는가?
- [ ] 배송 이벤트가 멱등하고 순서 역전에 안전한가?
- [ ] 반품 검수와 판매 가능 재고 복구를 분리했는가?

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

- fulfillment
- shipment
- delivery
- return
- reverse-logistics
- warehouse
