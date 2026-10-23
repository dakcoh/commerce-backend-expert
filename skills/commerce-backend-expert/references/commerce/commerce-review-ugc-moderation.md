# 리뷰와 UGC: 작성 권한, 노출 상태, 신고 처리를 분리한다

- id: commerce-review-ugc-moderation
- domain: commerce
- category: review
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

리뷰는 구매 검증, 수정 이력, 이미지 검수, 신고와 블라인드 상태를 함께 관리해야 한다.

## 적용 조건

- commerce 도메인의 review 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

리뷰는 상품 탐색과 전환율에 직접 영향을 주지만 허위 리뷰, 개인정보 노출, 광고성 콘텐츠 위험이 있다.
작성 가능 주문과 노출 가능한 리뷰를 분리하지 않으면 운영자가 문제 콘텐츠를 통제하기 어렵다.

## 반드시 지켜야 할 원칙

- 리뷰 작성 권한은 주문 라인의 구매 이력·소유권과 정책으로 검증한다. 작성 허용 시점은 배송 완료 또는 구매 확정 등 선택한 사업 정책을 따른다.
- 리뷰 본문, 평점, 이미지, 노출 상태, 신고 상태를 분리한다.
- 수정과 삭제는 이력과 감사 로그를 남긴다.

## 권장 흐름

- 정책에서 정한 배송 완료·구매 확정 등 기준 이벤트 이후 작성 가능 기간을 연다.
- 리뷰 작성 시 주문 라인 소유권과 중복 작성을 검증한다.
- 금칙어, 이미지, 개인정보 노출을 검수하고 노출 상태를 결정한다.
- 신고 누적 또는 운영자 판단에 따라 블라인드, 복구, 삭제를 처리한다.

## 기술 구현 참고

- 주문 라인당 1회 작성 정책이라면 orderLineId + userId 등으로 중복을 방어한다. 삭제 후 재작성·복수 작성 허용 여부에 맞게 제약과 수정 이력을 설계한다.
- review_status를 PENDING, VISIBLE, BLINDED, DELETED로 구분한다.
- 평점 집계는 이벤트 기반 projection으로 관리하고 재집계 작업을 준비한다.

## 실패 시나리오

- 구매하지 않은 사용자가 리뷰를 작성해 평점 신뢰도가 떨어진다.
- 리뷰 삭제 후 상품 평점 집계가 갱신되지 않는다.
- 이미지에 개인정보가 포함됐는데 즉시 공개된다.

## 검토 체크리스트

- [ ] 구매 검증과 중복 작성 방어가 있는가?
- [ ] 리뷰 노출 상태와 신고 처리가 분리되어 있는가?
- [ ] 평점 집계 projection과 재집계 경로가 있는가?

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

- review
- ugc
- moderation
- rating
- purchase-verification
- audit

## 관련 규칙

- [commerce-order-lifecycle](../commerce/commerce-order-lifecycle.md)
- [spring-security-authz](../spring-commerce/spring-security-authz.md)
