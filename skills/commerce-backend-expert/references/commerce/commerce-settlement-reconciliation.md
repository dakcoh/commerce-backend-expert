# 정산: 주문 합계가 아니라 거래 원장으로 계산한다

- id: commerce-settlement-reconciliation
- domain: commerce
- category: settlement
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정산은 판매, 수수료, 할인 분담, 배송비, 환불을 근거 거래별로 집계하고 대사해야 한다.

## 적용 조건

- commerce 도메인의 settlement 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

입점 판매자나 브랜드가 있으면 플랫폼은 누구에게 얼마를 지급해야 하는지 설명할 수 있어야 한다.
이미 지급한 주문의 반품은 다음 정산 주기에 음수 공제로 반영될 수 있다.

## 반드시 지켜야 할 원칙

- 판매금액의 할인·세금 포함 여부와 수수료·반품·판매자 부담 할인·귀속 배송비를 정의해 확정 순액을 검증한다. 이미 반영한 공제를 두 번 차감하지 않는다.
- 정산 항목은 원 주문 라인과 원 거래를 참조한다.
- 배치는 재실행해도 중복 지급되지 않도록 멱등해야 한다.

## 권장 흐름

- 정산 기준일과 판매자별 정산 주기를 결정한다.
- 정산 대상 거래를 cursor 기반으로 수집한다.
- 항목별 지급액과 공제액을 계산하고 검증한다.
- 지급 결과와 이후 반품 공제를 별도 원장으로 남긴다.

## 기술 구현 참고

- settlement, settlement_item, settlement_adjustment를 분리한다.
- 실행 ID는 추적용으로 두고 판매자·원 거래 라인·정산 항목·종류 등 재실행에도 유지되는 업무키를 UNIQUE·조건부 갱신으로 원자적 확정한다.
- chunk 결과와 체크포인트는 함께 커밋하거나 안정적인 업무키로 재처리해 커밋 경계 차이와 두 워커 경합을 견딘다.
- 명세 확정액·보정·성공 지급 누계·보류·미지급 잔액을 분할/합산 지급 배부와 연결해 대사한다. 정산 멱등성만으로 외부 송금 중복 방지를 대신하지 않는다.
- 금액 합계, 건수, 누락, 중복을 자동 대사한다.

## 실패 시나리오

- 배치 재실행으로 판매자에게 두 번 지급한다.
- 플랫폼 부담 쿠폰을 판매자에게 잘못 공제한다.
- 정산 이후 반품을 계약상 보정·상계·회수에 반영하지 않는다.

## 검토 체크리스트

- [ ] 부담 주체별 할인과 수수료를 구분하는가?
- [ ] 정산 배치가 멱등한가?
- [ ] 지급 전후 자동 대사와 음수 공제가 있는가?

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

- settlement
- reconciliation
- seller
- fee
- deduction
- batch
