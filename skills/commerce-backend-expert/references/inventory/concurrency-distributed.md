# 분산락 (Distributed Lock — Redis)

- id: concurrency-distributed
- domain: inventory
- category: concurrency
- severity: high
- status: needs-review
- evidenceLevel: external-source
- owner: commerce-context-maintainers
- verifiedBy: Codex (AI 문서 검토)
- lastReviewedAt: 2026-10-24
- changeNote: 기존 RLock 계약 검토에 더해 fencing과 DB version의 보호 범위를 구분했다. Redis 장애와 보호 자원의 실제 거부 동작은 미검증이다.
- jurisdiction: KR

## 요약

분산락은 여러 동시성 전략 중 하나이며 DB의 조건부 갱신·제약 조건과 실패 모델을 비교해 선택한다

## 적용 조건

- 여러 프로세스가 DB 트랜잭션만으로 묶기 어려운 공유 자원 작업을 조율해야 한다.

## 적용하지 않는 조건

- 공유 DB의 원자적 조건부 UPDATE, UNIQUE 제약 또는 행 잠금만으로 불변식을 보장할 수 있다.

## 전제

- Redis 장애, lease 만료, 일시 정지와 네트워크 분할을 실패 시나리오에 포함한다.

## 구현 가이드

- Redisson tryLock의 반환값을 확인하고 false면 보호 작업을 실행하지 않는다. 획득한 경우에만 try/finally로 해제를 보장하고, InterruptedException은 전파하거나 인터럽트 상태를 복원한다
- 고정 lease 예시 tryLock(3, 5, TimeUnit.SECONDS)는 최대 3초 대기·획득 후 5초 만료다. 5초 뒤 작업이 끝나지 않아도 락은 만료되므로 이 값만으로 안전성을 보장하지 않는다
- Redisson에서 leaseTime을 지정하지 않는 획득 방식은 watchdog이 살아 있는 인스턴스의 만료를 갱신한다. watchdog timeout·갱신 실패·인스턴스 중단 뒤의 만료를 검증하고, 명시적 leaseTime이 없다는 이유만으로 영구 점유라고 판단하지 않는다
- MSA라는 이유만으로 분산락을 선택하지 않는다. DB 조건부 UPDATE, 비관락, 메시지 직렬화와 비교한다
- 고정 lease 또는 watchdog 등 실제 만료·갱신 계약을 확인한다. 해제는 소유 스레드와 만료 경합을 처리하며 TTL에만 의존해 정상 해제를 생략하지 않는다
- 일반 RLock의 획득만으로 fencing token이 발급되지는 않는다. fencing을 쓰면 보호 자원이 토큰 순서를 원자적으로 확인해 오래된 쓰기를 거부해야 한다. DB version은 읽은 버전을 조건으로 갱신할 때의 충돌 방어이며 락 소유권이나 외부 부수효과까지 보장하는 것으로 대체하지 않는다

## 피해야 할 패턴

- tryLock 획득 실패 후에도 작업 실행, 소유권 없는 해제 또는 예외 경로에서 해제 누락
- 만료·갱신이 없는 락을 무기한 유지하거나 watchdog 동작을 확인하지 않고 고정 lease를 강제
- Redis 장애 시 폴백 전략 미준비
- Redis 락 획득만으로 DB 불변식이 보장된다고 가정하고 조건부 갱신·제약 조건을 제거

## 검토 체크리스트

- [ ] 획득 실패·인터럽트·정상/예외 해제와 고정 lease 또는 watchdog의 만료·갱신을 검증하는가?
- [ ] 동시 요청에 DB 조건부 갱신·제약 또는 적절한 락 등 동시성 제어가 적용됐는가?

## 출처

### 프로젝트 관리 지식 — 이관 출처

- source: src/main/resources/knowledge/inventory.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

### Redisson — Lock

- source: https://redisson.pro/docs/data-and-services/locks-and-synchronizers/#lock
- type: official-documentation
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: RLock의 watchdog·leaseTime·획득 결과·소유 스레드 해제 계약을 문서로 확인했다. Redis 장애·DB 불변식과 현장 설정의 안전성을 검증한 기록은 아니며 needs-review를 유지한다.

### Jakarta Persistence — Optimistic Locking

- source: https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html
- type: official-documentation
- sourceVersion: 3.2
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: 낙관락 검사 시점·OptimisticLockException의 rollback과 잠금 힌트 이식성 참고다. 운영 DB 성능·정합성 검증은 아니다.

## 태그

- concurrency
- distributed-lock
- redis
- msa

## 검색 표현

- fencing token
- 락 만료
- lock expiry
- redis lock
