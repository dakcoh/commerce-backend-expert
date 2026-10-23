# 테스트와 관측성: 핵심 불변식을 자동 검증한다

- id: spring-commerce-testing-observability
- domain: spring-commerce
- category: quality
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

단순 CRUD 테스트를 넘어 동시성, 멱등성, 금액 정합성, 복구 흐름을 검증한다.

## 적용 조건

- spring-commerce 도메인의 quality 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스 장애는 정상 흐름보다 재시도와 경계값에서 발생한다.
운영 중에는 특정 주문이 왜 멈췄는지 correlation ID로 추적할 수 있어야 한다.

## 업무 맥락

이커머스 장애는 정상 흐름보다 재시도와 경계값에서 발생한다.
운영 중에는 특정 주문이 왜 멈췄는지 correlation ID로 추적할 수 있어야 한다.

## Java Spring 구현 가이드

- 실제 운영 DB의 종류·버전·격리 수준에 맞는 통합 테스트를 구성한다. Testcontainers 등 재현 가능한 환경을 활용하고 Redis는 사용하는 경우 해당 기능과 장애 경계를 검증한다.
- 동시 요청 테스트로 오버셀링, 중복 쿠폰, 중복 결제를 검증한다.
- Micrometer 지표에 주문 실패율, 결제 UNCERTAIN 수, 예약 만료 수, 정산 누락 수를 노출한다.
- 구조화 로그에 orderId, paymentId, correlationId를 남긴다.

## 피해야 할 패턴

- H2 등 대체 저장소 테스트만 통과하면 실제 운영 DB의 잠금·SQL·격리 동작도 안전하다고 가정하지 않는다.
- 정상 흐름 테스트만 작성하지 않는다.
- 주문 ID 없이 자유 형식 로그만 남기지 않는다.

## 검토 체크리스트

- [ ] 실제 운영 저장소와 격리 수준을 검증하고 Redis는 사용하는 경우 통합 테스트하는가?
- [ ] 동시성과 재시도 테스트가 있는가?
- [ ] 핵심 운영 지표와 correlationId 로그가 있는가?

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
- testcontainers
- postgres
- redis
- micrometer
- observability
- concurrency-test

## 관련 규칙

- [spring-database-index-isolation](../spring-commerce/spring-database-index-isolation.md)
- [concurrency-optimistic](../inventory/concurrency-optimistic.md)
- [settlement-integrity](../settlement/settlement-integrity.md)
