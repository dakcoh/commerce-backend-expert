# DB 인덱스와 격리 수준: 조회 패턴과 정합성 위험을 함께 본다

- id: spring-database-index-isolation
- domain: spring-commerce
- category: persistence
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

인덱스는 where/order by/join 패턴에 맞춰 설계하고, 격리 수준은 재고·정산 불변식을 기준으로 선택한다.

## 적용 조건

- spring-commerce 도메인의 persistence 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

이커머스의 주문, 결제, 정산 테이블은 쓰기량과 조회량이 모두 많다.
잘못된 인덱스는 배치 지연을 만들고, 격리 수준 오해는 중복 처리와 정산 누락을 만든다.

## Java Spring 구현 가이드

- Repository 메서드의 where 조건, 정렬, join 대상에 맞춰 복합 인덱스를 설계한다.
- cursor pagination의 sort key와 index 순서를 일치시킨다.
- 재고 차감, 쿠폰 발급, 정산 대상 확정에는 격리 수준과 락 범위를 명시한다.
- 실행 계획과 slow query를 운영 지표로 관측한다.

## 피해야 할 패턴

- 인덱스 없이 상태 + 기간 조건으로 대형 주문 테이블을 스캔하지 않는다.
- 트랜잭션 격리 수준 기본값만 믿고 phantom read 가능성을 무시하지 않는다.
- 복합 인덱스 컬럼 순서를 조회 조건과 다르게 둔다.

## 검토 체크리스트

- [ ] 핵심 조회마다 실행 계획을 확인했는가?
- [ ] cursor 정렬과 복합 인덱스 순서가 맞는가?
- [ ] 동시 변경이 있는 업무의 격리 수준과 락 범위가 문서화됐는가?

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

- spring
- database
- index
- isolation
- lock
- slow-query
- cursor
