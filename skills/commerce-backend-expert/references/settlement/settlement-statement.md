# 정산 명세서 — 시점 스냅샷으로 박제한다

- id: settlement-statement
- domain: settlement
- category: statement
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정산 명세서는 매번 재계산하지 말고 정산 확정 시점의 금액·요율을 불변 스냅샷으로 저장해야 한다

## 적용 조건

- settlement 도메인의 statement 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

정산 명세서는 매번 재계산하지 말고 정산 확정 시점의 금액·요율을 불변 스냅샷으로 저장해야 한다

## 구현 가이드

- 명세 구성: 정산 ID + 셀러 ID + 정산 기준 기간 + 원 거래 라인(판매금액·수수료·공제) + 확정 순액 breakdown. 명세의 금액이 실제 이체액과 같은 범위인지 정의한다
- 스냅샷 저장: 명세 생성 시점의 수수료율, 쿠폰/프로모션 분담률, 적용 금액을 컬럼에 그대로 기록 — 이후 정책이 바뀌어도 과거 명세는 불변
- 판매·반품·수수료·분담금·배송비·세금의 포함/제외를 항목별로 명시해 할인·공제를 중복 반영하지 않는다
- 셀러 조회 API: 본인 정산 명세만 조회(소유권 검증), 기간·상태 필터, cursor 페이징
- 명세-원장 정합성: 기초 이월 + 명세 확정액 + 보정액 - 명세 후 별도 확정 공제 = 성공 지급 누계 + 기말 정산 잔액. 확정 순액에 이미 포함한 세금·상계를 다시 공제하지 않는다
- 분할 지급·합산 지급은 명세와 지급 원장의 배부 링크로 대사한다. 양수 기말 잔액의 미지급 잔액·보류·진행 중 이체·차기 이월을 구분하고 음수는 회수·상계 잔액으로 관리한다
- 명세는 생성 후 수정 불가(append-only) — 정정이 필요하면 보정 명세를 새로 발행

## 피해야 할 패턴

- 명세를 조회할 때마다 현재 요율로 재계산 — 수수료율이 바뀌면 과거 명세 금액이 흔들려 셀러 분쟁 발생
- 명세 라인 없이 합계 금액만 저장 — 셀러가 '왜 이 금액인지' 검증 불가, CS 폭증
- 명세를 가변(mutable) 레코드로 두고 in-place 수정 — 감사 추적 불가, 정정 이력 소실

## 검토 체크리스트

- [ ] 정산 명세가 생성 시점의 요율·금액을 스냅샷으로 박제하는가?
- [ ] 명세에 주문별 라인과 공제 breakdown이 남는가?
- [ ] 명세·보정·성공 지급 누계·미지급 잔액을 분할/이월과 중복 공제 없이 대사하는가?
- [ ] 셀러 명세 조회에 소유권 검증이 있는가?

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
- statement
- snapshot
- immutable
- breakdown
- seller

## 검색 표현

- 정산서
- 과거 명세
