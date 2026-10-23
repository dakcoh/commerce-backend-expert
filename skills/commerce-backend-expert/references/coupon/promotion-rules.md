# 프로모션 규칙 엔진 설계

- id: promotion-rules
- domain: coupon
- category: promotion
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

프로모션은 우선순위·조합·버전을 명시하고, 규칙 규모와 운영 변경 요구에 따라 단순 코드·Strategy/Specification·DB 기반 규칙 엔진을 선택한다

## 적용 조건

- coupon 도메인의 promotion 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 구현 가이드

- 작고 고정된 규칙은 명확한 조건문과 테스트로 관리할 수 있다. 조합 규모·변경 빈도·운영자 편집·감사 요구가 커지면 Strategy/Specification 또는 규칙 엔진을 비교한다
- DB 기반 규칙은 지원하는 조건·할인 유형·우선순위·기간을 검증하고 정책 버전·활성화·롤백을 관리한다. 새로운 조건의 표현력을 추가할 때는 코드 변경이 필요할 수 있다
- 우선순위 기반 적용: 우선순위 높은 프로모션 먼저 적용, 중복 적용 여부는 플래그로 제어
- 프로모션 중복 적용 허용 시 최대 할인 한도 반드시 설정

## 피해야 할 패턴

- 규칙 규모와 운영 요구를 확인하지 않고 조건문 또는 규칙 엔진 중 하나를 무조건 강제
- 프로모션 중복 적용 시 최대 할인 한도 미설정 — 할인 금액 통제 불가

## 검토 체크리스트

- [ ] 프로모션 중복 적용 시 최대 할인 한도가 설정됐는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/coupon.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- promotion
- rule-engine
- strategy
- specification
- priority
