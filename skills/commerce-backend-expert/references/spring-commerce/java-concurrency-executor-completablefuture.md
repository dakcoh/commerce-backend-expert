# Java 17 비동기 처리: Executor와 CompletableFuture 경계를 분명히 한다

- id: java-concurrency-executor-completablefuture
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

비동기 코드는 전용 Executor, timeout, 예외 처리, 컨텍스트 전파를 명시하고 트랜잭션 경계를 넘기지 않는다.

## 적용 조건

- spring-commerce 도메인의 java-core 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

주문 후 알림, 외부 채널 동기화, 검색 인덱싱처럼 느린 후속 작업을 비동기로 처리할 수 있다.
하지만 무제한 thread pool이나 트랜잭션 컨텍스트 착각은 장애 시 더 큰 지연과 데이터 불일치를 만든다.

## Java Spring 구현 가이드

- @Async나 CompletableFuture에는 업무별 전용 Executor와 큐 크기 제한을 설정한다.
- 비동기 작업에는 timeout, retry, fallback, 실패 기록을 둔다.
- DB 트랜잭션 커밋 전 상태를 비동기 작업이 읽는 구조를 피한다.
- correlationId 같은 추적 컨텍스트를 명시적으로 전달한다.

## 피해야 할 패턴

- ForkJoinPool.commonPool에 결제, 재고, 외부 API 작업을 무분별하게 태우지 않는다.
- CompletableFuture 예외를 join 시점까지 방치하지 않는다.
- @Transactional 메서드 내부에서 비동기 작업이 같은 영속성 컨텍스트를 쓴다고 가정하지 않는다.

## 검토 체크리스트

- [ ] 비동기 업무별 Executor와 큐 제한이 있는가?
- [ ] timeout, 예외 처리, 실패 재처리 경로가 있는가?
- [ ] 트랜잭션 커밋 이후 실행되어야 하는 작업이 분리되어 있는가?

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
- java17
- async
- executor
- completablefuture
- timeout
- correlation-id
