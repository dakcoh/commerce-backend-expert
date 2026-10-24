# 비관락 (Pessimistic Lock)

- id: concurrency-pessimistic
- domain: inventory
- category: concurrency
- severity: high
- status: needs-review
- evidenceLevel: external-source
- owner: commerce-context-maintainers
- verifiedBy: Codex (AI 문서 검토)
- lastReviewedAt: 2026-10-24
- changeNote: DB 잠금 범위·교착상태 복구와 JPA timeout 힌트의 이식성 한계를 검토했다. 운영 DB 동작은 미검증이다.
- jurisdiction: KR

## 요약

충돌이 잦은 단일 DB 자원의 변경을 트랜잭션 잠금으로 직렬화하고 대기·교착상태·커넥션 점유를 관리하는 방식

## 적용 조건

- inventory 도메인의 concurrency 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 구현 가이드

- @Lock(LockModeType.PESSIMISTIC_WRITE) 로 적용
- 충돌이 잦은 경우(인기 상품, 한정 수량)에 사용
- 잠금으로 보호한 트랜잭션 범위의 동시 변경을 직렬화한다. 외부 작업이나 잠금 범위 밖의 경쟁까지 해결하지는 않는다
- DB별 락 대기·SQL·트랜잭션·네트워크 타임아웃을 구분하고 장기 점유를 제한한다
- 일반적인 DB 행 잠금은 트랜잭션 또는 세션 종료로 해제되지만, 연결 단절 감지 지연과 미완료 트랜잭션은 장기 대기를 만들 수 있다
- 락 획득 순서를 일관되게 유지해 데드락 위험을 줄이고, 교착상태로 중단된 트랜잭션은 전체를 종료한 뒤 제한적으로 재시도한다. 잠금 순서만으로 모든 교착상태가 사라진다고 보장하지 않는다
- JPA lock timeout 힌트가 모든 DB·provider에서 같은 방식으로 적용된다고 가정하지 않고 실제 SQL·설정과 실패 예외를 확인한다

## 피해야 할 패턴

- 락 대기와 미완료 트랜잭션을 방치해 잠금·DB 커넥션을 장시간 점유
- 락 순서 불일치로 데드락 발생
- DB 커넥션 점유 과다로 커넥션 풀 고갈

## 검토 체크리스트

- [ ] 비관락 사용 시 타임아웃 설정과 데드락 방어가 있는가?
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

### PostgreSQL — Explicit Locking

- source: https://www.postgresql.org/docs/18/explicit-locking.html
- type: official-documentation
- sourceVersion: 18
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: 행 잠금·교착상태·트랜잭션 종료의 PostgreSQL 범위다. 다른 DB와 실제 경합·장애는 미검증이다.

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
- pessimistic-lock
- deadlock
