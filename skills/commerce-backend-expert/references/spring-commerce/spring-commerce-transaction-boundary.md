# 트랜잭션 경계: 짧고 명확하게 유지한다

- id: spring-commerce-transaction-boundary
- domain: spring-commerce
- category: transaction
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

DB 트랜잭션 안에서 외부 API를 오래 기다리지 말고, 로컬 상태 변경과 외부 연동을 분리한다.

## 적용 조건

- spring-commerce 도메인의 transaction 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

주문 처리 중 PG, 택배사, 외부 채널을 호출하면 응답 지연과 타임아웃이 발생할 수 있다.
긴 트랜잭션은 DB 커넥션과 락을 오래 점유해 주문 처리량을 떨어뜨린다.

## Java Spring 구현 가이드

- @Transactional은 public application service 메서드에 적용한다.
- 외부 API 호출 전후의 로컬 상태를 PENDING, UNCERTAIN 같은 상태로 기록한다.
- 외부 API 호출과 후속 처리는 Outbox, 이벤트, 스케줄러로 연결한다.
- readOnly = true를 조회 트랜잭션에 적용하되 실제 쓰기가 섞이지 않도록 한다.

## 피해야 할 패턴

- @Transactional 메서드 안에서 PG 응답을 장시간 기다리지 않는다.
- 같은 클래스 내부 호출로 @Transactional 프록시가 우회되는 구조를 만들지 않는다.
- 예외를 삼켜 롤백이 누락되게 하지 않는다.

## 검토 체크리스트

- [ ] 트랜잭션 안에 느린 외부 API 호출이 없는가?
- [ ] 실패와 타임아웃 상태를 DB에 남기는가?
- [ ] self-invocation으로 트랜잭션 프록시를 우회하지 않는가?

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
- transaction
- transactional
- outbox
- timeout
- self-invocation

## 검색 표현

- 트랜잭션 경계
- 짧은 트랜잭션
- transaction boundary
- @Transactional
- 외부 호출 트랜잭션
