# 낙관락 (Optimistic Lock)

- id: concurrency-optimistic
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

충돌이 드문 환경에서 버전 비교로 갱신 손실을 감지하고 제한된 재시도로 재고 동시성을 제어하는 방식

## 적용 조건

- inventory 도메인의 concurrency 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

충돌이 드문 환경에서 버전 비교로 갱신 손실을 감지하고 제한된 재시도로 재고 동시성을 제어하는 방식

## 구현 가이드

- @Version private Long version; 으로 적용
- 충돌이 드문 경우(재고 여유, 동시 주문 적음)에 사용
- 명시적 비관락을 먼저 잡지 않고 버전으로 충돌을 감지한다. UPDATE 과정의 DB 잠금까지 없어지는 것은 아니며 성능은 경합과 DB 동작에 따라 측정한다
- 재시도 가능한 충돌은 새 트랜잭션에서 다시 조회하고 backoff와 상한(예: 3회)을 적용한다. 재고 부족 같은 확정 거부는 충돌 재시도와 구분한다

## 피해야 할 패턴

- 재시도 횟수 제한 없으면 무한 루프 위험
- 충돌이 잦은 환경(한정 수량, 동시 요청 폭증)에 낙관락 적용 시 재시도 폭증

## 검토 체크리스트

- [ ] 재시도 횟수에 상한이 있는가?
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
- optimistic-lock

## 검색 표현

- lost update
- 갱신 손실
- version conflict
- 낙관적 락
