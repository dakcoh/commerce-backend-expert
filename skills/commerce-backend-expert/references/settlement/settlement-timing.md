# 정산 시점과 정산 기준일 처리

- id: settlement-timing
- domain: settlement
- category: timing
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정산 산정 기준일·대상 기간·확정일과 예정 지급일·실제 지급일을 구분하고 영업일 조정은 계약상 해당 단계에만 적용한다

## 적용 조건

- settlement 도메인의 timing 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

정산 산정 기준일·대상 기간·확정일과 예정 지급일·실제 지급일을 구분하고 영업일 조정은 계약상 해당 단계에만 적용한다

## 구현 가이드

- 산정 기준일은 구매 확정·배송 완료·결제 완료 등 계약상 기준 이벤트로 정하고, 정산 대상 기간·확정일·예정 지급일·실제 지급일은 각각 기록한다
- 주말 거래의 산정 기준일을 은행 영업일로 무조건 옮기지 않는다. 주말/공휴일 조정은 계약이 정한 확정 또는 지급 단계와 영업일 달력에 적용한다
- 기준 기간은 업무 타임존과 시작 포함·끝 제외 경계를 명시하고 원 거래 시각과 수집 시각을 구분한다
- 부분 취소·지연 유입·기준 기간 종료 후 반품은 원 거래를 참조한 보정과 적용 주기를 계약에 따라 결정한다

## 피해야 할 패턴

- 환불 가능 기간 전 지급하는 계약인데도 후속 반품 보정·회수 경로를 정의하지 않음
- 산정 기준일과 지급일을 혼동하거나 계약상 영업일 조정을 누락
- 부분 취소된 주문의 정산 금액 재계산 누락

## 검토 체크리스트

- [ ] 정산 기준일 유형(구매 확정/배송 완료/결제 완료)이 명확히 정의됐는가?
- [ ] 산정 기준일·확정일·예정/실제 지급일과 영업일 조정 정책이 구분되는가?

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
- timing
- purchase-confirm
- delivery
