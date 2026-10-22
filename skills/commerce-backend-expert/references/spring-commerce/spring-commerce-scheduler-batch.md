# 스케줄러와 배치: 중복 실행과 재시작을 견딘다

- id: spring-commerce-scheduler-batch
- domain: spring-commerce
- category: batch
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정산, 예약 만료, 결제 대사 배치는 여러 번 실행되어도 안전하고 중단 지점부터 복구 가능해야 한다.

## 적용 조건

- spring-commerce 도메인의 batch 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스 운영에는 재고 예약 만료, 망취소 대사, 정산 같은 주기 작업이 필요하다.
서버가 여러 대면 같은 스케줄러가 동시에 실행될 수 있다.

## 업무 맥락

이커머스 운영에는 재고 예약 만료, 망취소 대사, 정산 같은 주기 작업이 필요하다.
서버가 여러 대면 같은 스케줄러가 동시에 실행될 수 있다.

## Java Spring 구현 가이드

- 실행 ID는 추적용이며 재실행에도 유지되는 처리 대상 업무키를 UNIQUE·조건부 갱신으로 원자적 확정한다. 실행 조정 락은 업무 효과의 중복 방어를 대신하지 않는다.
- 다중 인스턴스에서는 DB 락 또는 ShedLock 같은 실행 조정 수단을 검토한다.
- 대량 처리는 cursor 기반 페이징과 chunk 단위 커밋을 사용한다.
- 실패 시 마지막 처리 지점과 실패 원인을 기록한다.
- 대상 스냅샷·cutoff와 안정적인 cursor를 정의한다. chunk 결과와 체크포인트를 함께 커밋하거나 업무키 기반 재처리로 커밋 경계 차이를 견딘다.

## 피해야 할 패턴

- @Scheduled가 한 번만 실행된다고 가정하지 않는다.
- 전체 테이블을 한 번에 메모리에 올리지 않는다.
- 부분 실패 후 처음부터 무조건 다시 처리하지 않는다.

## 검토 체크리스트

- [ ] 배치가 멱등한가?
- [ ] 다중 인스턴스 중복 실행을 제어하는가?
- [ ] cursor, chunk, 재시작 지점이 있는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/spring-commerce.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- spring
- scheduled
- batch
- shedlock
- cursor
- chunk
- restart
