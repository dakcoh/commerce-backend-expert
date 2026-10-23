# Java/Spring 구현

업무를 Java/Spring·DB·이벤트·배치로 구현하거나 리팩터링할 때 읽는다. 기존 트랜잭션·동시성·배포 보장을 추적하고 필요한 실패 구간을 기준으로 기술을 선택한다.

| 규칙 | 적용할 업무 |
|---|---|
| [Spring 이커머스 시작 구조: 모듈형 모놀리스](spring-commerce-modular-monolith.md) | 초기부터 MSA로 쪼개지 말고 도메인 경계를 코드 모듈로 분리한 Spring Boot 애플리케이션으로 시작한다. |
| [트랜잭션 경계: 짧고 명확하게 유지한다](spring-commerce-transaction-boundary.md) | DB 트랜잭션 안에서 외부 API를 오래 기다리지 말고, 로컬 상태 변경과 외부 연동을 분리한다. |
| [JPA 영속성: 엔티티와 조회 모델을 분리한다](spring-commerce-jpa-consistency.md) | 주문 원장 엔티티를 API 응답에 직접 노출하지 말고, 쓰기 모델과 조회 DTO를 분리한다. |
| [동시성 제어와 멱등성: DB 제약을 마지막 안전망으로 둔다](spring-commerce-locking-idempotency.md) | 낙관락, 비관락, Redis를 상황에 맞게 선택하고 UNIQUE 제약과 멱등성 키를 함께 사용한다. |
| [API 계약: 검증 오류와 비즈니스 오류를 분리한다](spring-commerce-validation-errors.md) | Bean Validation, 비즈니스 예외, 외부 연동 오류를 구분하고 일관된 오류 응답을 제공한다. |
| [이벤트 발행: Outbox와 멱등 Consumer를 기본으로 고려한다](spring-commerce-events-outbox.md) | DB 커밋과 메시지 발행 사이의 유실을 줄이고, 이벤트 중복 전달을 안전하게 처리한다. |
| [Redis 캐시: 원장과 가속 계층의 역할을 구분한다](spring-commerce-cache-boundary.md) | Redis를 빠른 조회와 접수 제어에 사용하되 주문·결제·정산의 최종 원장으로 취급하지 않는다. |
| [스케줄러와 배치: 중복 실행과 재시작을 견딘다](spring-commerce-scheduler-batch.md) | 정산, 예약 만료, 결제 대사 배치는 여러 번 실행되어도 안전하고 중단 지점부터 복구 가능해야 한다. |
| [테스트와 관측성: 핵심 불변식을 자동 검증한다](spring-commerce-testing-observability.md) | 단순 CRUD 테스트를 넘어 동시성, 멱등성, 금액 정합성, 복구 흐름을 검증한다. |
| [Java 도메인 모델링: 원시 타입 집착을 줄이고 의미 있는 타입을 둔다](java-domain-modeling.md) | orderId, money, quantity, email 같은 값을 String과 long으로 흩뿌리지 말고 값 객체와 검증 규칙으로 묶는다. |
| [Null과 예외 경계: 실패 가능성을 타입과 계약으로 드러낸다](java-null-exception-boundary.md) | null을 암묵적인 실패 신호로 쓰지 말고 Optional, 명시적 예외, 결과 타입으로 호출자 계약을 분명히 한다. |
| [컬렉션과 Stream: 대량 데이터와 부작용을 구분한다](java-collections-streams.md) | Stream은 메모리 안의 컬렉션 변환에 적합하며 DB 대량 처리나 외부 호출 반복을 숨기는 도구가 아니다. |
| [Spring Security 권한: 인증, 인가, 소유권 검증을 분리한다](spring-security-authz.md) | 로그인 여부만 확인하지 말고 사용자, 판매자, 운영자 권한과 리소스 소유권을 함께 검증한다. |
| [설정과 Secret: 환경별 설정과 민감 값을 코드에서 분리한다](spring-configuration-secrets.md) | PG 키, JWT secret, 외부 API endpoint, feature flag는 환경별 설정으로 관리하고 소스 코드와 로그에 노출하지 않는다. |
| [스키마 마이그레이션: 주문 원장은 무중단 변경을 전제로 설계한다](spring-schema-migration.md) | Flyway/Liquibase로 스키마 변경을 버전 관리하고, 대형 테이블 변경은 expand-migrate-contract 순서로 진행한다. |
| [REST API 설계: 페이지네이션과 멱등 POST 계약을 명확히 한다](spring-api-pagination-idempotent-post.md) | 목록 API는 cursor 기반 탐색을 우선하고, 주문 생성 같은 POST는 idempotency key로 중복 실행을 방어한다. |
| [DB 인덱스와 격리 수준: 조회 패턴과 정합성 위험을 함께 본다](spring-database-index-isolation.md) | 인덱스는 where/order by/join 패턴에 맞춰 설계하고, 격리 수준은 재고·정산 불변식을 기준으로 선택한다. |
| [Java 17 비동기 처리: Executor와 CompletableFuture 경계를 분명히 한다](java-concurrency-executor-completablefuture.md) | 비동기 코드는 전용 Executor, timeout, 예외 처리, 컨텍스트 전파를 명시하고 트랜잭션 경계를 넘기지 않는다. |
| [외부 연동 회복성: timeout, retry, circuit breaker를 업무별로 다르게 둔다](spring-resilience-retry-timeout.md) | PG, 택배, 알림, 검색, 외부 채널 API는 같은 재시도 정책을 쓰지 말고 업무 영향에 따라 실패 처리를 분리한다. |
| [배포와 헬스체크: readiness 기준과 롤백 조건을 명확히 한다](spring-deployment-health-rollout.md) | 애플리케이션 기동 성공만 보지 말고 DB, Redis, 외부 설정, 배치 중복, 핵심 API readiness를 검증한다. |
