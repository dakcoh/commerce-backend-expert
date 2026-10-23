# 검색과 탐색: 검색 인덱스는 원장이 아니라 조회 모델이다

- id: commerce-search-discovery
- domain: commerce
- category: search
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

상품 검색, 필터, 정렬, 추천은 빠른 조회 모델로 관리하되 상품·가격·재고 원장과의 동기화 지연을 감시한다.

## 적용 조건

- commerce 도메인의 search 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

고객은 검색, 카테고리, 필터, 추천을 통해 상품을 발견한다.
검색 인덱스는 빠른 응답을 위해 비동기로 갱신되지만 가격이나 품절 상태가 늦게 반영되면 고객 경험과 주문 정합성이 깨진다.

## 업무 맥락

고객은 검색, 카테고리, 필터, 추천을 통해 상품을 발견한다.
검색 인덱스는 빠른 응답을 위해 비동기로 갱신되지만 가격이나 품절 상태가 늦게 반영되면 고객 경험과 주문 정합성이 깨진다.

## 반드시 지켜야 할 원칙

- 검색 인덱스는 상품 원장의 복제본이며 최종 진실 원천이 아니다.
- 주문 생성 전에는 검색 결과가 아니라 원장 기준으로 가격과 재고를 재검증한다.
- 검색 인덱스 갱신 지연과 실패를 관측한다.

## 권장 흐름

- 상품 변경 이벤트를 발행한다.
- 검색 인덱서가 이벤트를 소비해 문서를 갱신한다.
- 검색 결과에는 현재 노출 가능한 상품만 포함한다.
- 체크아웃 전 원장 재검증으로 인덱스 지연을 보정한다.

## 기술 구현 참고

- Elasticsearch/OpenSearch 같은 검색 엔진은 조회 모델로 격리한다.
- 검색 문서에는 productId, skuId, offerId, displayPrice, availability 요약을 포함한다.
- 인덱싱 실패는 DLQ와 재색인 작업으로 복구한다.

## 실패 시나리오

- 품절 상품이 검색 결과에 계속 노출되어 결제 직전 실패한다.
- 검색 인덱스 가격을 주문 금액으로 사용해 원장 가격과 불일치한다.
- 상품 삭제 이벤트 유실로 노출 중단 상품이 계속 검색된다.

## 검토 체크리스트

- [ ] 검색 인덱스와 상품 원장의 역할이 분리되어 있는가?
- [ ] 검색 결과의 가격과 재고를 주문 전 원장 기준으로 재검증하는가?
- [ ] 인덱싱 지연, 실패, 재색인 경로가 있는가?

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

- search
- discovery
- index
- opensearch
- projection
- reindex
