# 정산 보류 — 분쟁·클레임 중인 건은 지급에서 제외한다

- id: settlement-hold
- domain: settlement
- category: hold
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

반품·클레임·분쟁에 대한 산정 제외와 지급 보류를 구분하고 계약상 사유·범위·권한·해제 시점을 추적한다

## 적용 조건

- settlement 도메인의 hold 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

반품·클레임·분쟁에 대한 산정 제외와 지급 보류를 구분하고 계약상 사유·범위·권한·해제 시점을 추적한다

## 구현 가이드

- 산정 대상에서 제외할지, 확정액은 유지하고 지급 보류할지는 계약으로 구분한다. 반품 요청 자체를 모든 정산 중단의 근거로 단정하지 않는다
- 주문·항목·셀러 단위 보류 사유와 금액 범위·한도를 정의한다. 전체 보류와 부분 보류는 계약상 근거와 권한을 확인한다
- 보류 해제는 즉시·예정일·차기 주기 등 계약상 시점으로 결정하고 동일 보류액을 중복 해제하거나 다시 공제하지 않는다
- 보류·해제 상태 전이에 사유·행위자·권한·시각·대상 금액의 감사 로그를 남긴다
- 보류액은 미지급 잔액 안에서 별도 식별한다. 충당금 등 회계 계정 분류는 회계 정책 검토로 결정하며 보류와 공제를 혼용하지 않는다

## 피해야 할 패턴

- 계약상 필요한 보류를 누락하거나 지급 후 반품의 회수 경로를 정의하지 않음
- 계약상 근거·권한 없이 한 주문 문제로 셀러 전체 금액을 보류
- 보류 사유·해제 이력 미기록 — 셀러 분쟁 시 근거 제시 불가

## 검토 체크리스트

- [ ] 반품/클레임/분쟁의 산정 제외와 지급 보류를 계약에 따라 구분하는가?
- [ ] 셀러 단위 보류와 주문 단위 보류가 분리됐는가? (부분 보류 가능)
- [ ] 보류 해제 시점·권한·금액이 계약에 맞고 중복 해제·공제를 방지하는가?
- [ ] 보류 사유와 해제 이력이 감사 로그로 남는가?

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
- hold
- dispute
- chargeback
- claim
- audit
