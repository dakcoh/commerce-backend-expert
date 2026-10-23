# Saga 패턴 (주문-결제-재고 정합성)

- id: saga-pattern
- domain: inventory
- category: consistency
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

여러 로컬 트랜잭션에 걸친 작업은 Saga 보상과 Outbox 발행·소비자 멱등성·대사를 조합해 실패 후 정합성을 회복한다

## 적용 조건

- inventory 도메인의 consistency 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

여러 로컬 트랜잭션에 걸친 작업은 Saga 보상과 Outbox 발행·소비자 멱등성·대사를 조합해 실패 후 정합성을 회복한다

## 구현 가이드

- 단일 DB 로컬 트랜잭션으로 충분한지 먼저 확인한다. MSA라는 배포 형태만으로 Saga를 요구하지 않는다
- 예약형 정상 흐름 예시: 주문 생성 → 재고 예약 → 결제 요청 → 결제 성공 → 재고 확정 차감 → 주문 완료; 즉시 차감형은 해당 재고 모델의 확보·보상으로 대체한다
- 실패 보상(Compensation) 예시: 결제 실패 확정 → 해당 재고 작업의 해제 또는 복구 → 주문 취소. 결제 응답 유실은 실패로 단정하지 않고 대사한다
- Outbox는 로컬 상태와 발행할 이벤트 기록을 같은 로컬 트랜잭션에 저장하고 별도 발행자가 재시도하도록 한다. 업무 보상 완료를 자동 보증하지 않는다
- 소비자는 at-least-once 전달을 전제로 멱등하게 처리하고, 보상 재시도·실패 상태·대사·운영자 개입 경로를 기록한다

## 피해야 할 패턴

- 로컬 @Transactional만으로 외부 시스템 변경까지 원자적으로 롤백된다고 가정
- 보상 트랜잭션 정의 누락 시 결제 실패 후 재고가 예약된 채 방치
- Outbox 발행 성공을 소비자 처리 또는 업무 보상 완료와 동일하게 취급

## 검토 체크리스트

- [ ] 여러 로컬 트랜잭션에 걸친 작업이라면 멱등 보상·재시도·대사 경로가 있는가?
- [ ] 재고 부족 시 적절한 예외 처리와 메시지가 있는가?

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

- saga
- consistency
- distributed-transaction
- outbox
