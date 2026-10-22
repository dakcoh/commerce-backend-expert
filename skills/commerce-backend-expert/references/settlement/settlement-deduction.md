# 정산 공제 항목 처리

- id: settlement-deduction
- domain: settlement
- category: deduction
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정산 공제는 판매금액의 포함 항목과 부담 주체·적용 정책을 정의해 중복 차감을 막고 지급 후 반품·음수 잔액을 원 거래에 연결한다

## 적용 조건

- settlement 도메인의 deduction 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

정산 공제는 판매금액의 포함 항목과 부담 주체·적용 정책을 정의해 중복 차감을 막고 지급 후 반품·음수 잔액을 원 거래에 연결한다

## 구현 가이드

- 정산 확정 순액은 계약상 매출 기초액에 판매자 귀속 배송비 등을 더하고 아직 반영하지 않은 반품·수수료·판매자 부담 할인 등을 공제한다. 할인·세금이 이미 포함된 기초액인지 정의해 중복 공제하지 않는다
- 수수료와 분담금은 원 거래에 적용되는 계약·정책 버전과 계산 기준을 저장한다. 과거 거래를 현재 요율로 무조건 재계산하지 않는다
- 지급 전후 반품은 원 거래·원 명세·원 지급을 참조하는 보정 원장으로 기록한다. 다음 주기 공제·상계·별도 회수 등은 계약에 따라 선택하며 확정 명세를 덮어쓰지 않는다
- 프로모션 분담금: 플랫폼 부담분 vs 셀러 부담분 비율 계산 필요
- 쿠폰 분담금은 발행 주체와 실제 비용 부담 주체를 구분해 주문 당시 부담 배부를 따른다
- 공제 후 금액이 음수(-)가 될 수 있음 → 다음 정산 주기로 이월하거나 셀러에게 별도 청구

## 피해야 할 패턴

- 공제 후 음수 케이스 미처리 — 정산액 오류 발생
- 쿠폰/프로모션 분담금 비율 미계산 — 정산액 불일치

## 검토 체크리스트

- [ ] 이미 정산·지급된 건의 반품을 원 거래와 연결해 계약상 보정·상계·회수하는가?
- [ ] 쿠폰/프로모션 분담금 비율 계산 로직이 있는가?
- [ ] 정산 공제 후 음수 발생 케이스가 처리됐는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/settlement.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- settlement
- deduction
- fee
- refund
- promotion
