# 컬렉션과 Stream: 대량 데이터와 부작용을 구분한다

- id: java-collections-streams
- domain: spring-commerce
- category: java-core
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

Stream은 메모리 안의 컬렉션 변환에 적합하며 DB 대량 처리나 외부 호출 반복을 숨기는 도구가 아니다.

## 적용 조건

- spring-commerce 도메인의 java-core 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

주문, 정산, 상품 인덱싱은 데이터가 빠르게 커진다.
작은 목록에서 동작하던 stream().map() 코드가 전체 주문 테이블이나 외부 API 호출과 결합되면 장애를 만들 수 있다.

## Java Spring 구현 가이드

- 대량 DB 처리는 cursor, slice, chunk 단위로 나눈다.
- Stream 내부에서 외부 API 호출이나 Repository 호출을 반복하지 않는다.
- parallelStream은 트랜잭션, EntityManager, 외부 API rate limit과 충돌할 수 있으므로 신중히 사용한다.
- 변경 가능한 컬렉션을 공유할 때는 동시성 경계를 명시한다.

## 피해야 할 패턴

- findAll().stream()으로 대량 배치를 처리하지 않는다.
- stream map 안에서 N+1 Repository 호출을 만들지 않는다.
- parallelStream으로 결제, 재고, 정산 같은 상태 변경을 병렬 처리하지 않는다.

## 검토 체크리스트

- [ ] 대량 처리가 cursor 또는 chunk 기반인가?
- [ ] Stream 내부에 숨은 DB/API 반복 호출이 없는가?
- [ ] 병렬 처리 시 트랜잭션과 rate limit 경계가 명확한가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/spring-commerce.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- java
- collection
- stream
- batch
- cursor
- n-plus-one
- parallel
