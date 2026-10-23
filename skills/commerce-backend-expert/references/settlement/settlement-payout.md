# 정산 지급(실이체) — 확정과 이체를 분리하고 멱등하게

- id: settlement-payout
- domain: settlement
- category: payout
- severity: high
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정산 확정과 실제 은행 이체는 상태를 분리하고, 이체 결과 확인 전에는 완료로 처리하지 않으며 이중 지급을 멱등 키로 막아야 한다

## 적용 조건

- settlement 도메인의 payout 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

정산 확정과 실제 은행 이체는 상태를 분리하고, 이체 결과 확인 전에는 완료로 처리하지 않으며 이중 지급을 멱등 키로 막아야 한다

## 구현 가이드

- 상태 분리: 정산 확정(SETTLED)은 금액 확정이며 이체 완료가 아니다. 지급 시도는 PAYOUT_REQUESTED·PROCESSING·PAID·FAILED·UNCERTAIN 등으로 별도 기록한다
- 이체 전 지급 업무키·요청 금액·계좌 버전 등 요청 지문과 동일 지급 시도를 영속 기록하고 원자적으로 선점한다. DB UNIQUE 제약은 내부 기록의 중복 방어이며 외부 이체의 한 번 실행을 단독 보장하지 않는다
- 외부 기관의 멱등성 지원 범위·조회 계약에 맞춰 동일 지급 시도에 같은 업무키를 사용한다. 미확정 이체는 기존 거래를 조회하고 새 시도 ID로 다시 송금하지 않는다
- 명확한 거절·확정 실패와 응답 유실을 구분한다. 확정 실패 후 계약에 맞게 재시도하며 이미 성공한 시도의 완료 처리만 재실행할 수 있어야 한다
- 분할 지급·합산 지급은 지급 항목과 명세 배부를 구분한다. 성공 지급 누계 + 처리 중·미확정 지급 확보액 + 새 요청액이 계약상 배부된 지급 한도(기지급분 차감 전, 보류·공제 반영 후)를 초과하지 않도록 원자적으로 검증한다
- 결과 불명확(이체 요청 후 응답 없음): UNCERTAIN 상태로 두고 은행 거래 내역 조회로 확정한다. 실패로 간주해 확보액을 해제하거나 성공 지급으로 임의 집계하지 않는다
- 최소 지급액과 소액 이월(carry-over)은 계약과 비용 정책에 따라 적용한다. 기말 미지급 잔액과 보류·진행 중 금액을 구분하고 음수 정산액을 송금하지 않는다
- 원천징수 적용 대상과 소득 유형을 확인한 경우에만 세무 정책에 따른 실이체액을 산정한다. 확정액에 이미 반영한 세금·공제를 다시 차감하지 않는다
- 지급대행/PG 정산금과 플랫폼 자체 지급을 구분 — 자금 출처와 책임 주체 분리

## 피해야 할 패턴

- 정산 확정 SETTLED를 이체 완료 PAID로 간주해 미지급 잔액을 누락
- 멱등 키 없이 배치 재실행 — 같은 정산 건이 두 번 이체돼 과다 지급
- 이체 실패를 단순 예외로 흘림 — 미지급 잔액 추적 불가
- 대상 여부나 이미 반영한 세금을 확인하지 않고 원천징수를 일괄 추가 차감
- 미확정 이체를 새 업무키로 다시 전송하거나 선조회만으로 지급 가능 잔액을 보호

## 검토 체크리스트

- [ ] 정산 확정과 실제 이체 상태가 분리돼 있는가?
- [ ] 지급 업무키·원자적 선점과 외부 멱등/조회 계약으로 같은 이체의 중복 실행을 막는가?
- [ ] 이체 결과 확인 전에는 완료로 처리하지 않는가? (불명확 시 UNCERTAIN)
- [ ] 원천징수 적용 대상·소득 유형·의무자와 최신 공식 근거를 확인했는가?
- [ ] 명세·보정·성공 지급 누계·미지급 잔액을 분할/이월과 중복 공제 없이 대사하는가?
- [ ] 미확정 지급 확보액을 보존하고 동일 시도를 조회한 뒤 확정하는가?

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
- payout
- transfer
- idempotency
- uncertain
- carry-over
- withholding
