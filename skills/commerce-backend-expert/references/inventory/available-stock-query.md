# 가용 재고 조회 패턴

- id: available-stock-query
- domain: inventory
- category: lifecycle
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

판매 가능 수량은 선택한 재고 모델의 수량 정의를 따르며, 예약형의 total_quantity - reserved_quantity와 DB 조건부 즉시 차감형을 구분한다

## 적용 조건

- 재고 모델의 수량 정의에 따라 조회와 주문 시점의 확보 조건을 설계한다.

## 전제

- 예약형 예시의 total_quantity는 확정 차감 기준 수량이고 reserved_quantity는 미확정 예약 수량이다.
- 안전재고·할당·검수 대기와 실물 출고를 반영하는 시점은 모델별로 정의한다.

## 판단 근거

판매 가능 수량은 선택한 재고 모델의 수량 정의를 따르며, 예약형의 total_quantity - reserved_quantity와 DB 조건부 즉시 차감형을 구분한다

## 구현 가이드

- 예약형 예시의 가용 재고: total_quantity - reserved_quantity; 안전재고 등을 별도 관리하면 제외 항목을 추가하고 중복 차감하지 않는다
- 예약형은 reserved_quantity를 늘릴 때도 가용 수량 조건을 같은 원자적 갱신에 포함하거나, 같은 트랜잭션의 SELECT ... FOR UPDATE로 보호한다
- 예약형에서 결제 성공을 확정 차감 시점으로 선택했다면 total_quantity와 reserved_quantity를 함께 감소시키며 같은 확정을 중복 반영하지 않는다
- 위 예약형의 실패·취소 복구는 reserved_quantity만 감소시킨다. 즉시 차감형의 보상은 이미 차감한 수량을 복구한다
- DB 조건부 즉시 차감형 예시: UPDATE stock SET quantity = quantity - :requested WHERE id = :id AND :requested > 0 AND quantity >= :requested; 영향받은 행 수로 확보 성공 여부를 확인한다
- 조회는 안내용 스냅샷이다. 양수 수량 검증과 주문 시점의 원자적 확보가 별도로 필요하며, 다중 SKU·창고는 업무 단위와 잠금 순서를 정의한다

## 피해야 할 패턴

- 예약형에서 예약 중인 수량을 무시한 조회 또는 차감
- 단일 quantity를 쓰는 즉시 차감형에 예약형 수량식을 다시 적용해 이중 차감
- 애플리케이션의 수량 비교만 믿고 동시 주문의 원자적 갱신과 제약을 생략

## 검토 체크리스트

- [ ] 선택한 재고 모델에서 수량의 의미와 확보·확정·복구 시점이 일관되는가?
- [ ] 예약형이라면 예약·안전재고 등 제외 항목을 반영하고 중복 차감하지 않는가?
- [ ] 조회 뒤 수량이 바뀌어도 주문 시점의 원자적 확보로 초과 판매를 막는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/inventory.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- lifecycle
- available-stock
- reserved-quantity
- overselling

## 검색 표현

- 오버셀링
- 판매 초과
- overselling
- sellable stock
- 음수 재고
- 재고 마이너스
