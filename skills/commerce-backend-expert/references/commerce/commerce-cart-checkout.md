# 장바구니와 체크아웃: 임시 견적과 확정 주문을 분리한다

- id: commerce-cart-checkout
- domain: commerce
- category: checkout
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

장바구니 금액은 임시 견적이며 주문 생성 시 가격, 재고, 쿠폰, 배송비를 반드시 재검증한다.

## 적용 조건

- commerce 도메인의 checkout 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

장바구니는 오래 유지될 수 있고 그 사이 가격, 재고, 쿠폰 조건, 배송 가능 여부가 바뀐다.
고객에게 보인 금액과 실제 결제 금액이 달라질 수 있으므로 체크아웃 단계에서 확정 계산이 필요하다.

## 업무 맥락

장바구니는 오래 유지될 수 있고 그 사이 가격, 재고, 쿠폰 조건, 배송 가능 여부가 바뀐다.
고객에게 보인 금액과 실제 결제 금액이 달라질 수 있으므로 체크아웃 단계에서 확정 계산이 필요하다.

## 반드시 지켜야 할 원칙

- 장바구니 항목은 주문 라인이 아니며 회계 원장이 아니다.
- 주문 생성 직전 가격, 재고, 쿠폰, 배송비, 구매 제한을 다시 검증한다.
- 체크아웃 견적에는 만료 시각과 정책 버전을 포함한다.

## 권장 흐름

- 장바구니에 상품과 수량을 담는다.
- 체크아웃 진입 시 견적을 계산하고 고객에게 보여준다.
- 주문 생성 시 견적을 재검증하고 선택한 재고 모델에 따라 원자적으로 수량을 확보한 뒤 결제 대기를 시작한다.
- 견적과 실제 주문 금액이 다르면 고객 확인 또는 재계산 응답을 반환한다.

## 기술 구현 참고

- cart_item과 order_line을 분리하고 cart는 soft state로 취급한다.
- checkout_quote에는 quoteId, expiresAt, priceVersion, promotionVersion을 둔다.
- 주문 생성 API는 quoteId 멱등성 키를 사용해 중복 주문 생성을 방어한다.

## 실패 시나리오

- 장바구니 가격을 그대로 주문에 복사해 만료 쿠폰이 적용된다.
- 재고 품절 후에도 오래된 장바구니로 결제가 진행된다.
- 사용자 재시도로 같은 체크아웃이 두 주문으로 생성된다.

## 검토 체크리스트

- [ ] 장바구니와 주문 라인이 분리되어 있는가?
- [ ] 주문 생성 직전에 가격, 재고, 쿠폰, 배송비를 재검증하는가?
- [ ] 체크아웃 견적 만료와 중복 주문 방어가 있는가?

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

- cart
- checkout
- quote
- price-validation
- reservation
- idempotency
