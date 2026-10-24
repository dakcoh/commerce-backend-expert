# 선착순 쿠폰 발급 — 동시성 제어

- id: coupon-issuance
- domain: coupon
- category: issuance
- severity: high
- status: needs-review
- evidenceLevel: external-source
- owner: commerce-context-maintainers
- verifiedBy: Codex (AI 문서·격리 런타임 검토)
- lastReviewedAt: 2026-10-24
- changeNote: PostgreSQL 16.15·Redis 7.0.15 합성 시험으로 발급 한도·Streams 재전달·Lua 오류 후 쓰기 잔존을 확인했다. 실제 사업 정책·클러스터 failover는 미검증이다.
- jurisdiction: KR

## 요약

선착순 쿠폰 발급은 재고 확인과 사용자 중복 선점을 하나의 원자적 연산으로 처리하고 DB 제약으로 최종 방어한다

## 적용 조건

- coupon 도메인의 issuance 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 구현 가이드

- DB 조건부 수량 갱신과 발급 업무키 UNIQUE를 같은 트랜잭션에서 처리하는 DB-only 방식도 가능하다. 확보 성공 여부와 양수 수량·총 한도를 함께 검증한다
- Redis 사용 시 재고 확인·감소와 사용자 중복 선점을 하나의 Lua Script로 처리한다. DECR와 SETNX를 애플리케이션에서 따로 호출하면 전체 흐름은 원자적이지 않다
- Lua 실행 중 다른 요청이 끼어들지 않는 것과 오류 시 자동 롤백은 다르다. 입력·키 타입·자격·한도 검사를 쓰기 전에 수행하고, 쓰기 뒤 오류·응답 유실 시 영속 attempt와 원장을 대사한다. 스크립트 실패만으로 앞선 수량 감소가 없었다고 간주하지 않는다
- DB 비관락: SELECT ... FOR UPDATE → 발급 수량 체크 + 업데이트 원자적 처리 (단: 트래픽 폭주 시 DB 커넥션 소진 위험)
- 메시지 큐 (비동기 발급): 접수와 발급 확정을 구분한다. 다중 소비자·파티션·재전달이 있으므로 큐의 존재나 단일 소비자 설정만으로 중복 방지·전체 순서를 보장하지 않는다. 소비자도 업무키 제약과 원자적 한도 확보를 적용하고 DB 확정 뒤 ack하며, 중단 후 재전달을 멱등 처리한다
- 이중 발급 방어: 1인 1매 캠페인은 userId + campaignId 등을 업무키로 사용할 수 있다. couponId가 캠페인인지 개별 발급권인지 정의하고, 회차별 발급·1인 N매 한도는 그 자격 범위에 맞춰 제약과 원자적 수량 검증을 설계한다

## 피해야 할 패턴

- 동시성 제어 없이 발급 수량만 체크 — 동시 요청 폭주 시 오버이슈 발생
- 발급 업무키·사용자 한도·원자적 수량 제어 없이 사용자 중복 여부만 선조회

## 검토 체크리스트

- [ ] 선착순 쿠폰 발급 시 오버이슈 방지 로직이 있는가?
- [ ] 발급 자격·회차·사용자 한도에 맞춘 업무키 제약과 원자적 수량 검증이 있는가?
- [ ] Lua를 쓰면 첫 쓰기 전 검증과 오류·응답 유실 뒤 부분 반영 대사 경로가 있는가?

## 출처

### 프로젝트 관리 지식 — 이관 출처

- source: src/main/resources/knowledge/coupon.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

### Redis — Scripting with Lua

- source: https://redis.io/docs/latest/develop/programmability/eval-intro/
- type: official-documentation
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: Redis 안의 스크립트 원자성·스크립트 캐시 휘발성 참고다. Redis와 DB의 원자적 커밋·영속성을 보장하지 않는다.

### PostgreSQL — Constraints

- source: https://www.postgresql.org/docs/18/ddl-constraints.html
- type: official-documentation
- sourceVersion: 18
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: UNIQUE·CHECK 등 DB 제약의 기술적 범위만 참고한다. 업무키 설계·회계 정책이나 운영 DB 검증은 별도다.

### Redis — Transaction Rollbacks

- source: https://redis.io/blog/you-dont-need-transaction-rollbacks-in-redis/
- type: official-documentation
- sourceVersion: 2020-05-04 기술 설명; Redis 7.0.15 격리 실행 대조
- publishedAt: 2020-05-04
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: 스크립트 원자성과 오류 복구를 구분하는 참고다. DECR 뒤 WRONGTYPE의 쓰기 잔존은 격리 사례로 확인했으며 모든 장애·클러스터 복구를 입증하지 않는다.

## 태그

- coupon
- issuance
- concurrency
- redis
- queue
- oversue
