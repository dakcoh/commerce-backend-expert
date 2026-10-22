# 유통 채널과 판매자: 원장과 채널별 노출 모델을 분리한다

- id: commerce-channel-seller-distribution
- domain: commerce
- category: distribution
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

자사몰, 오픈마켓, 판매자, 창고가 늘어날 것을 고려해 채널별 상품·가격·재고 동기화를 경계로 분리한다.

## 적용 조건

- commerce 도메인의 distribution 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스 유통은 자사몰 하나에서 시작해도 외부 마켓, 입점 판매자, 여러 창고로 확장될 수 있다.
채널마다 상품 코드, 가격 정책, 재고 반영 지연, 주문 수집 방식이 다르다.

## 업무 맥락

이커머스 유통은 자사몰 하나에서 시작해도 외부 마켓, 입점 판매자, 여러 창고로 확장될 수 있다.
채널마다 상품 코드, 가격 정책, 재고 반영 지연, 주문 수집 방식이 다르다.

## 반드시 지켜야 할 원칙

- 내부 SKU를 원장 식별자로 두고 외부 채널 상품 코드는 매핑 테이블로 관리한다.
- 채널에 전송한 재고와 실제 원장 재고의 차이를 감시한다.
- 외부 주문 수집은 외부 주문 번호와 채널 ID 조합으로 멱등 처리한다.

## 권장 흐름

- 내부 상품과 채널 상품 코드를 매핑한다.
- 채널별 판매가와 노출 상태를 발행한다.
- 외부 주문을 수집하고 내부 주문으로 변환한다.
- 재고, 취소, 배송 상태를 채널로 다시 동기화한다.

## 기술 구현 참고

- channel_product_mapping과 channel_sync_history를 둔다.
- 외부 API 호출은 재시도, 지수 백오프, 실패 큐를 포함한다.
- 채널별 어댑터로 외부 스키마를 내부 모델과 격리한다.

## 실패 시나리오

- 외부 마켓 주문을 중복 수집해 배송이 두 번 진행된다.
- 채널 재고 반영 지연으로 품절 상품이 계속 판매된다.
- 채널 API 장애가 내부 주문 처리까지 연쇄 중단시킨다.

## 검토 체크리스트

- [ ] 내부 SKU와 외부 상품 코드 매핑이 분리됐는가?
- [ ] 외부 주문 수집이 멱등한가?
- [ ] 재고 동기화 지연과 API 장애를 감시하는가?

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

- distribution
- channel
- seller
- marketplace
- sync
- adapter
