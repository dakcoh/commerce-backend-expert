# 재고·동시성

동시 주문·수량 확보·실패 복구·중복 차감을 다룰 때 읽는다. 예약형과 DB 즉시 차감형을 구분하고 상태 전이와 실제 차감 이력을 함께 확인한다.

| 규칙 | 적용할 업무 |
|---|---|
| [재고 예약/확정/복구 단계 분리](stock-reservation.md) | 재고 예약→확정→복구와 DB 조건부 즉시 차감은 선택 가능한 재고 모델이며, 동시 주문과 실패 복구에서 수량을 보존해야 한다 |
| [가용 재고 조회 패턴](available-stock-query.md) | 판매 가능 수량은 선택한 재고 모델의 수량 정의를 따르며, 예약형의 total_quantity - reserved_quantity와 DB 조건부 즉시 차감형을 구분한다 |
| [낙관락 (Optimistic Lock)](concurrency-optimistic.md) | 충돌이 드문 환경에서 버전 비교로 갱신 손실을 감지하고 제한된 재시도로 재고 동시성을 제어하는 방식 |
| [비관락 (Pessimistic Lock)](concurrency-pessimistic.md) | 충돌이 잦은 단일 DB 자원의 변경을 트랜잭션 잠금으로 직렬화하고 대기·교착상태·커넥션 점유를 관리하는 방식 |
| [분산락 (Distributed Lock — Redis)](concurrency-distributed.md) | 분산락은 여러 동시성 전략 중 하나이며 DB의 조건부 갱신·제약 조건과 실패 모델을 비교해 선택한다 |
| [멱등성 설계 (중복 요청 방어)](idempotency.md) | 네트워크 재시도로 인한 재고 이중 차감을 idempotency key로 방어한다 |
| [Saga 패턴 (주문-결제-재고 정합성)](saga-pattern.md) | 여러 로컬 트랜잭션에 걸친 작업은 Saga 보상과 Outbox 발행·소비자 멱등성·대사를 조합해 실패 후 정합성을 회복한다 |
| [재고 구현 체크리스트](ai-pitfalls-checklist.md) | 재고 구현 완료 후 반드시 점검할 체크리스트 |
