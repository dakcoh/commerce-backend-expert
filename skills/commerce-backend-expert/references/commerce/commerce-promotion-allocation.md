# 쿠폰과 프로모션: 혜택 계산, 배부, 사용 이력을 분리한다

- id: commerce-promotion-allocation
- domain: commerce
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

할인 규칙 적용과 실제 주문 라인별 할인 배부 결과를 분리해 환불과 정산을 재현 가능하게 만든다.

## 적용 조건

- commerce 도메인의 promotion 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

쿠폰과 프로모션은 고객 경험뿐 아니라 환불 금액과 판매자 정산에 영향을 준다.
플랫폼 부담, 판매자 부담, 브랜드 부담을 구분하지 않으면 정산 시점에 비용 귀속을 알 수 없다.

## 반드시 지켜야 할 원칙

- 유효 기간, 대상 상품, 최소 주문 금액, 사용자 한도, 중복 적용 가능 여부를 검증한다.
- 적용된 혜택은 주문 라인별로 배부하고 부담 주체를 저장한다.
- 쿠폰 사용 상태 변경은 동시 요청에 안전해야 한다.

## 권장 흐름

- 적용 가능한 규칙을 조회하고 우선순위를 평가한다.
- 할인 캡과 중복 적용 정책을 반영해 혜택을 계산한다.
- 주문 라인별 할인액과 부담 주체별 금액을 배부한다.
- 부분 취소 시 주문 당시 정책 버전과 할인 배부 스냅샷을 기준으로 혜택 유지·회수·일부 회수와 환불액을 결정한다.

## 기술 구현 참고

- promotion_rule과 applied_benefit을 분리하고 정책 버전을 저장한다.
- 쿠폰 상태는 ISSUED, RESERVED, USED, RELEASED로 관리한다.
- 선착순 발급은 DB 조건부 수량 차감과 발급 범위에 맞는 UNIQUE 제약을 같은 트랜잭션에서 처리할 수 있다. Redis 선점을 선택하면 Lua Script와 영속 발급 원장·보상 대사를 함께 설계한다.

## 실패 시나리오

- 부분 취소 후 최소 주문 금액 미달 시 주문 당시 유지·회수 정책과 다르게 혜택을 처리한다.
- 같은 쿠폰이 동시 요청으로 두 주문에 사용된다.
- 판매자 부담 할인액을 알 수 없어 정산이 틀어진다.

## 검토 체크리스트

- [ ] 할인 캡, 우선순위, 중복 적용 정책이 있는가?
- [ ] 주문 라인별 배부와 부담 주체가 저장되는가?
- [ ] 부분 취소 시 주문 당시 정책 버전과 배부 스냅샷에 따라 혜택 유지·회수와 환불액을 결정하는가?

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

- promotion
- coupon
- allocation
- sponsor
- partial-refund
- lua
