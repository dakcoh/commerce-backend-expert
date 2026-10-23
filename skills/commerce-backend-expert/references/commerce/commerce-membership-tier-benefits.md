# 멤버십 등급: 산정 기준과 혜택 적용 시점을 고정한다

- id: commerce-membership-tier-benefits
- domain: commerce
- category: membership
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

회원 등급은 주문 시점의 혜택 스냅샷과 등급 산정 이력을 분리해 계산한다.

## 적용 조건

- commerce 도메인의 membership 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

멤버십은 할인, 적립률, 무료배송, 쿠폰 발급에 영향을 준다.
등급 산정 기간과 혜택 적용 시점이 불명확하면 고객별 혜택 차이를 설명하기 어렵고 환불 시 금액이 어긋난다.

## 반드시 지켜야 할 원칙

- 등급 산정 기준 기간, 제외 주문, 반품 반영 기준을 명시한다.
- 주문에는 주문 당시 적용된 등급과 혜택 정책 버전을 스냅샷으로 저장한다.
- 등급 변경은 이력으로 남기고 소급 적용 여부를 정책으로 고정한다.

## 권장 흐름

- 월별 또는 분기별 등급 산정 대상 주문을 수집한다.
- 취소, 반품, 비정상 주문을 제외하고 실적을 계산한다.
- 등급 변경 예정 이력을 만들고 적용일에 활성화한다.
- 주문 생성 시 현재 등급 혜택을 가격 계산에 반영하고 스냅샷을 저장한다.

## 기술 구현 참고

- membership_tier_history와 benefit_policy_version을 분리한다.
- 등급 배치는 재실행 가능하도록 산정 기간 + userId에 UNIQUE 제약을 둔다.
- 혜택 계산은 쿠폰/프로모션 엔진과 충돌하지 않도록 우선순위를 명시한다.

## 실패 시나리오

- 반품 주문을 실적에 포함해 등급이 과다 상승한다.
- 등급 정책 변경 후 과거 주문 환불 금액이 재계산되어 달라진다.
- 등급 산정 배치 재실행으로 등급 변경 알림과 쿠폰이 중복 발급된다.

## 검토 체크리스트

- [ ] 등급 산정 기간과 제외 조건이 명시되어 있는가?
- [ ] 주문 시점 등급과 혜택 정책 버전을 저장하는가?
- [ ] 등급 배치가 멱등하고 변경 이력을 남기는가?

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

- membership
- tier
- benefit
- policy-version
- batch
- snapshot
