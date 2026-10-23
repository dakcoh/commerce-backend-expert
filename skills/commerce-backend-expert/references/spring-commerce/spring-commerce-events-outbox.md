# 이벤트 발행: Outbox와 멱등 Consumer를 기본으로 고려한다

- id: spring-commerce-events-outbox
- domain: spring-commerce
- category: messaging
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

DB 커밋과 메시지 발행 사이의 유실을 줄이고, 이벤트 중복 전달을 안전하게 처리한다.

## 적용 조건

- spring-commerce 도메인의 messaging 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

주문 완료 후 재고, 포인트, 알림, 정산 이벤트를 발행할 수 있다.
DB 저장 직후 장애가 나거나 Consumer가 재시도되면 누락과 중복이 발생한다.

## 업무 맥락

주문 완료 후 재고, 포인트, 알림, 정산 이벤트를 발행할 수 있다.
DB 저장 직후 장애가 나거나 Consumer가 재시도되면 누락과 중복이 발생한다.

## Java Spring 구현 가이드

- 도메인 상태와 outbox 레코드를 같은 DB 트랜잭션에서 저장한다.
- 별도 publisher가 미발행 outbox를 읽어 메시지 브로커로 전달한다.
- Consumer는 eventId 또는 비즈니스 키로 처리 이력을 저장해 멱등하게 동작한다.
- 재시도 횟수 제한, DLQ, 운영자 재처리 절차를 준비한다.

## 피해야 할 패턴

- DB 커밋 후 즉시 메시지를 한 번만 보내고 성공을 가정하지 않는다.
- Consumer가 정확히 한 번만 호출된다고 가정하지 않는다.
- DLQ 없이 무한 재시도하지 않는다.

## 검토 체크리스트

- [ ] 상태 변경과 outbox 저장이 같은 트랜잭션인가?
- [ ] Consumer가 중복 이벤트에 안전한가?
- [ ] DLQ와 운영 재처리 절차가 있는가?

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
- outbox
- event
- consumer
- idempotency
- dlq
