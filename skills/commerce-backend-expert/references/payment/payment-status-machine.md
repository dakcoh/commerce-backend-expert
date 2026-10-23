# 결제 상태 머신과 전이 가드

- id: payment-status-machine
- domain: payment
- category: state-machine
- severity: high
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

결제 상태는 유한 상태 머신으로 정의하고 각 전이에 가드 조건을 반드시 적용해야 중복 결제와 잘못된 상태 전이를 막을 수 있다

## 적용 조건

- payment 도메인의 state-machine 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 구현 가이드

- 결제 시도 상태 예시: PENDING → PROCESSING → PAID | FAILED | UNCERTAIN | CANCELLED. 주문 상태와 승인·환불 거래 상태를 분리하고 PG 상태는 계약에 맞게 매핑한다
- UNCERTAIN은 검증된 웹훅·인증된 조회·대사 워커 등 허용된 경로로 확정한다. 사용자의 성공 주장만으로 변경하지 않으며, 과거 이벤트로 최신 상태를 덮지 않는다
- 환불 거래는 원 결제를 참조해 REQUESTED·PROCESSING·SUCCEEDED·FAILED·UNCERTAIN 등을 별도로 기록한다. 원 결제 요약은 PAID·PARTIAL_CANCELLED·REFUNDED 등으로 집계한다
- 전이 가드 — 결제 가능한 주문에서 활성 결제 시도를 원자적으로 선점한다. 같은 시도의 중복 실행을 막고 확정 실패 후 새 시도는 별도로 생성한다
- 전이 가드 — PAID 또는 PARTIAL_CANCELLED 등 허용 상태에서 잔여 환불 가능액과 처리 중 환불을 검사한다. 부분 환불 후에도 잔액 범위 안의 추가 환불을 허용한다
- 취소 의사와 실제 승인·취소 결과는 다르다. 취소와 늦은 승인 경합은 원 거래 조회·조건부 전이·멱등 보상으로 대사하고 취소 의사를 지우지 않는다
- 상태 전이는 낙관락(@Version) 또는 CAS로 원자적 처리 — 동시 요청이 같은 전이를 중복 실행 방지
- 허용되지 않는 전이 요청은 즉시 IllegalStateException 등 명확한 예외 반환

## 피해야 할 패턴

- 상태 검증 없이 결제 요청 — 이미 PAID인 주문에 중복 결제 시도 발생
- PAID → PENDING 역방향 전이 허용 — 결제 완료된 주문을 재결제 가능 상태로 되돌림
- UNCERTAIN 상태 미구현 — 망취소 응답 불명확 시 영구 PENDING 방치
- 전이 로직을 여러 서비스에 분산 — 상태 전이 규칙 불일치로 정합성 파괴

## 검토 체크리스트

- [ ] 결제 요청 전 주문과 결제 시도의 허용 상태를 검증하는가?
- [ ] 미확정 결제 시도를 검증된 웹훅·조회·대사로 확정하는가?
- [ ] 잘못된 전이 시도에 적절한 예외를 반환하는가?
- [ ] 상태 전이가 낙관락(@Version) 또는 CAS로 원자적으로 처리되는가?
- [ ] 환불 요청 전 허용 상태와 잔여 환불 가능액·처리 중 금액을 원자적으로 검증하는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/payment.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- state-machine
- payment-status
- transition
- guard
- concurrency
