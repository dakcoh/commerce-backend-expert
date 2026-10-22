# 비관락 (Pessimistic Lock)

- id: concurrency-pessimistic
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

충돌이 잦은 단일 DB 자원의 변경을 트랜잭션 잠금으로 직렬화하고 대기·교착상태·커넥션 점유를 관리하는 방식

## 적용 조건

- inventory 도메인의 concurrency 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

충돌이 잦은 단일 DB 자원의 변경을 트랜잭션 잠금으로 직렬화하고 대기·교착상태·커넥션 점유를 관리하는 방식

## 구현 가이드

- @Lock(LockModeType.PESSIMISTIC_WRITE) 로 적용
- 충돌이 잦은 경우(인기 상품, 한정 수량)에 사용
- 잠금으로 보호한 트랜잭션 범위의 동시 변경을 직렬화한다. 외부 작업이나 잠금 범위 밖의 경쟁까지 해결하지는 않는다
- DB별 락 대기·SQL·트랜잭션·네트워크 타임아웃을 구분하고 장기 점유를 제한한다
- 일반적인 DB 행 잠금은 트랜잭션 또는 세션 종료로 해제되지만, 연결 단절 감지 지연과 미완료 트랜잭션은 장기 대기를 만들 수 있다
- 락 획득 순서를 일관되게 유지해 데드락 방지

## 피해야 할 패턴

- 락 대기와 미완료 트랜잭션을 방치해 잠금·DB 커넥션을 장시간 점유
- 락 순서 불일치로 데드락 발생
- DB 커넥션 점유 과다로 커넥션 풀 고갈

## 검토 체크리스트

- [ ] 비관락 사용 시 타임아웃 설정과 데드락 방어가 있는가?
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
- pessimistic-lock
- deadlock
