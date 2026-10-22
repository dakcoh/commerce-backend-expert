# 가격과 금액: 계산 근거를 스냅샷으로 남긴다

- id: commerce-pricing-money
- domain: commerce
- category: pricing
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

표시 가격만 저장하지 말고 판매가, 할인, 배송비, 세금, 최종 결제액의 계산 근거를 보존한다.

## 적용 조건

- commerce 도메인의 pricing 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스 가격은 상품 판매가 하나로 끝나지 않는다.
채널 가격, 회원 등급, 쿠폰, 프로모션, 포인트, 배송비, 세금이 결제액을 바꾼다.
환불과 정산은 주문 당시 계산 근거가 없으면 재현할 수 없다.

## 업무 맥락

이커머스 가격은 상품 판매가 하나로 끝나지 않는다.
채널 가격, 회원 등급, 쿠폰, 프로모션, 포인트, 배송비, 세금이 결제액을 바꾼다.
환불과 정산은 주문 당시 계산 근거가 없으면 재현할 수 없다.

## 반드시 지켜야 할 원칙

- 금액은 부동소수점이 아니라 통화의 최소 단위 정수 또는 BigDecimal로 계산한다.
- 주문 시점의 가격 구성 요소와 정책 버전을 스냅샷으로 저장한다.
- 상품·배송비의 세금 포함/별도 여부와 포인트의 할인/결제 수단 분류를 정의한다. 주문 합계에는 아직 포함되지 않은 세금만 가산해 중복 가산을 막는다.

## 권장 흐름

- 상품별 기준 판매가를 결정한다.
- 적용 가능한 할인 규칙을 우선순위에 따라 평가한다.
- 배송비와 과세·면세 구성을 계산한다. 세금 포함 최종가 11,000원에 별도 변경 항목이 없다면 내재된 세금을 다시 더하지 않는다.
- 최종 결제액과 항목별 배부 금액을 저장한다.

## 기술 구현 참고

- Money 값에는 amount와 currency를 함께 둔다.
- 할인은 order_discount와 order_line_discount처럼 근거별로 기록한다.
- 나눗셈 반올림 잔차는 마지막 라인 또는 최대 잔여 등 선택한 정책으로 배부하고 합계를 일치시킨다. 배부 정책과 잔차 귀속도 주문 스냅샷으로 보존한다.

## 실패 시나리오

- double 계산 오차로 결제 금액과 정산 금액이 1원 차이 난다.
- 부분 환불 시 할인액을 어느 상품에 배부했는지 알 수 없다.
- 프로모션 변경 후 과거 주문 금액을 재현하지 못한다.

## 검토 체크리스트

- [ ] 통화와 반올림 정책이 명시됐는가?
- [ ] 할인 배부 결과와 정책 버전을 저장하는가?
- [ ] 주문 합계 검증 로직이 있는가?
- [ ] 세금 포함 가격의 중복 가산과 할인·결제 수단의 중복 차감을 방지하는가?

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

- pricing
- money
- currency
- rounding
- discount
- snapshot
