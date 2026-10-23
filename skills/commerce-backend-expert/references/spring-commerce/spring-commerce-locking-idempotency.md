# 동시성 제어와 멱등성: DB 제약을 마지막 안전망으로 둔다

- id: spring-commerce-locking-idempotency
- domain: spring-commerce
- category: concurrency
- severity: high
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

낙관락, 비관락, Redis를 상황에 맞게 선택하고 UNIQUE 제약과 멱등성 키를 함께 사용한다.

## 적용 조건

- spring-commerce 도메인의 concurrency 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

재고 차감, 결제 요청, 쿠폰 발급은 동시에 같은 자원을 변경한다.
애플리케이션의 사전 조회만으로는 중복 처리와 오버셀링을 막을 수 없다.

## 업무 맥락

재고 차감, 결제 요청, 쿠폰 발급은 동시에 같은 자원을 변경한다.
애플리케이션의 사전 조회만으로는 중복 처리와 오버셀링을 막을 수 없다.

## Java Spring 구현 가이드

- 충돌이 드문 엔티티는 @Version 낙관락과 제한된 재시도를 사용한다.
- 충돌이 잦은 단일 DB 자원은 PESSIMISTIC_WRITE와 락 타임아웃을 검토한다.
- 선착순 발급은 DB 조건부 수량 차감과 발급 범위별 UNIQUE 제약을 같은 트랜잭션에서 처리할 수 있다. Redis Lua Script를 선택하면 DB 발급 원장과 영속 시도 기록, 실패 보상과 대사를 함께 설계한다.
- 멱등성 키와 처리 결과를 저장하고 같은 키 요청에는 기존 결과를 반환한다.

## 피해야 할 패턴

- SELECT 후 애플리케이션 if 검사만으로 중복 처리를 막지 않는다.
- 재시도 횟수 제한 없는 낙관락 루프를 만들지 않는다.
- Redis 성공만으로 최종 원장 저장이 완료됐다고 간주하지 않는다.

## 검토 체크리스트

- [ ] 충돌 빈도에 맞는 락 전략을 선택했는가?
- [ ] UNIQUE 제약과 멱등성 키가 있는가?
- [ ] 재시도 횟수, backoff, 락 타임아웃이 있는가?

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
- jpa
- version
- pessimistic-lock
- redis
- idempotency
- unique
