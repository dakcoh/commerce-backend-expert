# 분산락 (Distributed Lock — Redis)

- id: concurrency-distributed
- domain: inventory
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

분산락은 여러 동시성 전략 중 하나이며 DB의 조건부 갱신·제약 조건과 실패 모델을 비교해 선택한다

## 적용 조건

- 여러 프로세스가 DB 트랜잭션만으로 묶기 어려운 공유 자원 작업을 조율해야 한다.

## 적용하지 않는 조건

- 공유 DB의 원자적 조건부 UPDATE, UNIQUE 제약 또는 행 잠금만으로 불변식을 보장할 수 있다.

## 전제

- Redis 장애, lease 만료, 일시 정지와 네트워크 분할을 실패 시나리오에 포함한다.

## 판단 근거

분산락은 여러 동시성 전략 중 하나이며 DB의 조건부 갱신·제약 조건과 실패 모델을 비교해 선택한다

## 구현 가이드

- Redisson: RLock lock = redissonClient.getLock("inventory:" + productId);
- lock.tryLock(3, 5, TimeUnit.SECONDS); // 대기 3초, 점유 5초
- MSA라는 이유만으로 분산락을 선택하지 않는다. DB 조건부 UPDATE, 비관락, 메시지 직렬화와 비교한다
- 락 TTL 반드시 설정 — 서버 장애 시 자동 해제
- lease 만료 후 늦게 도착한 작업이 최신 상태를 덮지 않도록 fencing token 또는 DB version 검증을 함께 사용한다

## 피해야 할 패턴

- 락 TTL 미설정 시 서버 장애 후 락 영구 점유
- Redis 장애 시 폴백 전략 미준비
- Redis 락 획득만으로 DB 불변식이 보장된다고 가정하고 조건부 갱신·제약 조건을 제거

## 검토 체크리스트

- [ ] 분산락 사용 시 TTL이 설정됐는가?
- [ ] 동시 요청에 DB 조건부 갱신·제약 또는 적절한 락 등 동시성 제어가 적용됐는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/inventory.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

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
