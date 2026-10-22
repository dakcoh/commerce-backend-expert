# 정산 주기와 배치 처리

- id: settlement-cycle
- domain: settlement
- category: cycle
- severity: high
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정산 배치는 멱등성·페이징·재시작 지점을 반드시 구현해 중복 정산과 OOM을 방지해야 한다

## 적용 조건

- 정산 대상 거래를 배치로 확정하며 동시 실행·재시작이 같은 업무 효과를 중복 반영할 수 있다.

## 전제

- 실행 ID와 정산 업무키를 구분하고 확정 내역과 체크포인트의 커밋 경계를 검증한다.

## 판단 근거

정산 배치는 멱등성·페이징·재시작 지점을 반드시 구현해 중복 정산과 OOM을 방지해야 한다

## 구현 가이드

- 일반적인 정산 주기: 일 정산, 주 정산, 월 정산
- 멱등성 보장: 재실행에도 바뀌지 않는 업무키를 판매자·원 거래 라인·정산 항목·정산 종류 등 실제 처리 단위로 정의하고 UNIQUE·조건부 상태 전이로 원자적 확정한다. 완료 여부 선조회는 보조 검사다
- 배치 실행 ID는 추적용이다. 새 실행 ID로 다시 시작하거나 두 워커가 동시에 미완료를 읽어도 같은 업무 효과를 중복 확정하지 않는다
- 대용량 처리: 주문 건수가 많을 때 페이징 처리 필수 (전체 조회 금지)
- 실패 복구: 안정적인 대상 스냅샷·cutoff와 cursor를 정의한다. chunk 결과와 체크포인트를 같은 트랜잭션으로 커밋하거나 업무키 기반 재처리로 커밋 경계 차이를 견딘다
- 동시 환불·상태 변경은 스냅샷·버전·필요 범위의 잠금으로 산정 경계를 고정하고 이후 거래는 별도 보정으로 반영한다. 배치 전체 시간 동안 모든 주문 변경을 막을 필요는 없다
- 정산 상태 예시: UNSETTLED → SETTLEMENT_PENDING → SETTLED(정산액 확정). 지급 상태와 보류는 별도 관리하고 반품은 원 확정 내역을 참조하는 보정 원장으로 남긴다

## 피해야 할 패턴

- 전체 주문 한 번에 조회 — 대용량 데이터 OOM 발생
- 배치 중복 실행 시 멱등성 처리 누락 — 중복 정산 발생

## 검토 체크리스트

- [ ] 정산 배치에 멱등성 처리가 있는가? (중복 실행 방지)
- [ ] 실행 ID가 달라도 같은 업무키의 효과를 한 번만 확정하는가?
- [ ] chunk 결과와 체크포인트의 커밋 경계를 재시작 시 견디는가?
- [ ] 대용량 주문 처리 시 페이징이 적용됐는가?
- [ ] 정산 상태 전이 흐름이 정의됐는가? (UNSETTLED → SETTLED)

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/settlement.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- settlement
- batch
- cycle
- idempotency
- cursor
