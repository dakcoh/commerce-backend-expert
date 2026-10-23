# 선착순 쿠폰 발급 — Redis 선점 + DB 확정 + 보상 처리

- id: coupon-issuance-compensation
- domain: coupon
- category: issuance
- severity: high
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

Redis 선점 + DB 확정 모델을 선택했다면 영속 attempt와 원장 대사로 중간 장애를 추적하고, DB 실패가 확정된 선점만 원자적·멱등적으로 보상한다

## 적용 조건

- 발급 접수에 Redis를 사용하고 DB 원장에 최종 발급을 확정하는 모델을 선택했다.

## 적용하지 않는 조건

- DB 조건부 갱신·행 잠금·업무키 제약만으로 수량과 중복 발급을 제어하는 DB-only 모델을 선택했다.

## 전제

- Redis와 DB는 하나의 원자적 트랜잭션이 아니며 DB commit 응답 유실과 프로세스 중단을 구분한다.

## 판단 근거

Redis 선점 + DB 확정 모델을 선택했다면 영속 attempt와 원장 대사로 중간 장애를 추적하고, DB 실패가 확정된 선점만 원자적·멱등적으로 보상한다

## 구현 가이드

- 선점 전에 attempt 식별자와 발급 업무키를 영속 저장하고 Redis 선점 기록을 연결한다. 메모리의 reserved boolean만으로는 프로세스 중단 후 상태를 복구할 수 없다
- 1단계 Redis 선점: 하나의 Lua Script에서 자격·사용자 한도·재고를 확인하고 수량 감소와 선점 토큰 저장을 원자적으로 처리한다
- 2단계 DB 저장 (@Transactional): 발급 원장과 자격 범위에 맞는 업무키 제약으로 최종 이중 발급을 방어한다
- 3단계 성공 확정: Redis 선점 성공 + DB 저장 성공 = 발급 확정
- DB commit 응답 유실이나 중복키 오류는 동일 attempt와 원장을 조회해 성공·실패·미확정을 구분한다. 이미 발급 성공한 요청을 실패로 오인해 수량을 되돌리지 않는다
- 4단계 DB 실패 확정 시 Lua Script 보상: 현재 선점 토큰이 해당 attempt와 일치하고 아직 보상되지 않은 경우에만 선점 제거와 INCR을 함께 수행한다
- SREM 성공 시에만 INCR하는 방식도 이전 시도의 늦은 보상이 새 선점을 지우지 않도록 선점 토큰·상태 검증이 필요하다
- 프로세스 중단·보상 실패·장기 미확정 attempt는 DB 원장과 Redis 수량을 대사하고, 재시도 상한·복구 작업·운영 알림으로 추적한다

## 피해야 할 패턴

- 무조건 INCR 보상 — 중복 보상 시 재고 원본보다 증가 (원래 100 → 보상 2회 → 101)
- DB @Transactional rollback으로 Redis 자동 복구 기대 — Redis는 DB 트랜잭션 범위 밖
- 보상 로직 누락 — DB 실패 후 Redis 선점 상태 방치, 재고 영구 손실
- Redis 유무만으로 발급 안전성을 판단하거나 DB-only 모델의 원자적 갱신·제약을 무시
- DB 결과가 미확정인데 즉시 보상하거나, 이전 시도의 선점 토큰으로 새 시도의 선점을 제거

## 검토 체크리스트

- [ ] Redis+DB 모델이라면 선점과 영속 attempt·DB 발급 원장을 연결해 대사할 수 있는가?
- [ ] DB 응답 유실과 확정 실패를 구분한 뒤 해당 선점만 복구하는가?
- [ ] Redis 사용 시 보상은 선점 토큰 검증과 수량 복구를 원자적·멱등적으로 처리하는가?
- [ ] 프로세스 중단·보상 실패 후에도 복구 작업과 운영 알림이 가능한가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/coupon.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- coupon
- issuance
- redis
- compensation
- saga
- lua
- idempotency
