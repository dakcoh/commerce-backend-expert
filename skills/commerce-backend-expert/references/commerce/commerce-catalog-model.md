# 상품 카탈로그: Product, SKU, Offer를 분리한다

- id: commerce-catalog-model
- domain: commerce
- category: catalog
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

고객이 보는 상품, 실제 판매 단위, 채널별 판매 조건을 하나의 테이블로 합치지 않는다.

## 적용 조건

- commerce 도메인의 catalog 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

이커머스 유통에서는 같은 상품도 옵션, 판매자, 채널, 판매 기간에 따라 재고와 가격이 달라진다.
Product는 고객이 탐색하는 상품 설명, SKU는 재고를 관리하는 최소 단위,
Offer는 특정 판매자가 특정 채널에서 제시하는 가격과 판매 조건이다.

## 반드시 지켜야 할 원칙

- 재고는 Product가 아니라 SKU 단위로 관리한다.
- 주문 라인에는 주문 당시의 상품명, 옵션명, 판매자, 가격을 스냅샷으로 보존한다.
- 판매 중단과 상품 데이터 삭제를 구분한다. 과거 주문의 참조 무결성을 깨지 않는다.

## 권장 흐름

- Product에 노출용 이름, 설명, 카테고리, 미디어를 연결한다.
- SKU에 옵션 조합, 바코드, 재고 관리 코드를 연결한다.
- Offer에 판매자, 채널, 판매가, 판매 기간, 판매 상태를 연결한다.

## 기술 구현 참고

- product_id, sku_id, offer_id를 분리하고 주문에는 세 식별자와 스냅샷을 함께 저장한다.
- SKU 옵션 조합에는 중복 방지 UNIQUE 제약을 둔다.
- 검색 인덱스는 조회 모델로 취급하고 DB 원장과 분리한다.

## 실패 시나리오

- 상품명 변경 후 과거 주문 상세의 상품명이 함께 바뀐다.
- 색상 옵션 하나의 품절이 전체 상품 품절로 처리된다.
- 판매자별 가격 차이를 표현하지 못해 채널 확장이 막힌다.

## 검토 체크리스트

- [ ] Product, SKU, Offer의 책임이 분리됐는가?
- [ ] 주문 라인에 상품 정보 스냅샷이 남는가?
- [ ] 판매 중단 상품도 과거 주문에서 조회 가능한가?

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

- catalog
- product
- sku
- offer
- snapshot
- distribution
