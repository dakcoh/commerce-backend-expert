# 재고 가용성: 실재고, 예약, 판매 가능 수량을 구분한다

- id: commerce-inventory-availability
- domain: commerce
- category: inventory
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

선택한 재고 모델에 따라 판매 가능 수량을 정의하고 DB 조건부 차감 또는 예약의 수량 불변식을 지킨다.

## 적용 조건

- commerce 도메인의 inventory 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

유통 재고는 창고에 존재하는 수량과 고객에게 판매 가능한 수량이 다르다.
주문 결제 대기 중인 예약 수량, 파손과 검수 대기, 안전재고, 입고 예정 수량을 구분해야 한다.

## 업무 맥락

유통 재고는 창고에 존재하는 수량과 고객에게 판매 가능한 수량이 다르다.
주문 결제 대기 중인 예약 수량, 파손과 검수 대기, 안전재고, 입고 예정 수량을 구분해야 한다.

## 반드시 지켜야 할 원칙

- 재고 모델별로 실재고, 이미 차감된 수량, 예약, 안전재고의 의미를 정의해 같은 수량을 두 번 차감하지 않는다. 예약형의 on_hand - reserved - safety_stock는 각 항목이 중복되지 않는 경우의 예시다.
- 예약형은 예약·확정·해제를, 즉시 차감형은 DB 조건부 차감·실패 시 한 번의 복구를 검증한다.
- 재고 변경은 SKU, 창고, 변경 사유, 참조 주문을 포함한 원장으로 기록한다.

## 권장 흐름

- 판매 가능 수량을 검증한다.
- 선택한 재고 모델에 따라 조건부 갱신으로 수량을 확보하거나 만료 시각과 함께 예약한다.
- 결제 성공 시 즉시 차감형은 수량을 다시 차감하지 않는다. 예약형은 모델에서 정한 확정 시점에 재고 수량과 예약 상태를 함께 반영한다.
- 확정 실패나 만료 시 상태를 조건부 전이해 한 번만 복구한다. 결과가 불명확하면 결제 상태를 먼저 확인한다.

## 기술 구현 참고

- inventory_ledger를 append-only로 기록하고 현재 수량은 집계 또는 별도 projection으로 관리한다.
- DB 조건부 갱신, 제약, 낙관락, 비관락을 비교하고 Redis 접수 제어는 필요할 때 추가한다.
- 예약형은 승인과 만료 처리의 경쟁을 조건부 상태 전이로 제어하고 복구 작업은 멱등하게 구현한다.

## 실패 시나리오

- 결제 실패 주문이 재고를 계속 점유한다.
- 멀티 창고인데 전체 재고만 관리해 출고할 수 없는 주문을 받는다.
- 재고 수량이 어긋났지만 어느 주문 때문인지 추적할 수 없다.

## 검토 체크리스트

- [ ] 선택한 재고 모델의 수량 의미와 동시성 불변식이 정의됐는가?
- [ ] 실패 복구가 한 번만 적용되고 예약형은 승인과 만료 경쟁에 안전한가?
- [ ] 재고 변동 원장이 남는가?

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

- inventory
- atp
- reservation
- warehouse
- ledger
- overselling
