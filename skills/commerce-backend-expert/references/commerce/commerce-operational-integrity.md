# 운영 정합성: 이벤트, 배치, 수동 조치를 추적 가능하게 만든다

- id: commerce-operational-integrity
- domain: commerce
- category: operations
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

장애가 없다고 가정하지 말고 중복, 지연, 순서 역전, 수동 보정을 운영 가능한 형태로 설계한다.

## 적용 조건

- commerce 도메인의 operations 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스 장애는 한 번의 예외보다 조용한 데이터 불일치가 더 위험하다.
결제는 성공했는데 주문이 멈추거나, 재고는 예약됐는데 만료되지 않거나,
정산 대상 주문이 누락되는 상황을 탐지하고 복구할 수 있어야 한다.

## 업무 맥락

이커머스 장애는 한 번의 예외보다 조용한 데이터 불일치가 더 위험하다.
결제는 성공했는데 주문이 멈추거나, 재고는 예약됐는데 만료되지 않거나,
정산 대상 주문이 누락되는 상황을 탐지하고 복구할 수 있어야 한다.

## 반드시 지켜야 할 원칙

- 외부 요청과 이벤트 소비는 멱등하게 처리한다.
- 핵심 상태 변경에는 correlation ID, 원인, 행위자, 시각을 남긴다.
- 자동 복구와 수동 보정 모두 감사 로그를 남긴다.

## 권장 흐름

- 핵심 지표와 불일치 조건을 정의한다.
- 주기적인 대사 작업으로 누락과 중복을 탐지한다.
- 재처리 큐와 운영자 보정 절차를 제공한다.
- 보정 결과를 원장과 감사 로그에 남긴다.

## 기술 구현 참고

- Outbox 패턴으로 DB 상태 변경과 이벤트 발행 간 유실을 줄인다.
- Consumer는 at-least-once 전달을 전제로 멱등하게 구현한다.
- DLQ, 재처리 횟수 제한, 운영 알람, runbook을 준비한다.

## 실패 시나리오

- 이벤트 중복 전달로 재고와 포인트가 두 번 변경된다.
- DB 반영 후 이벤트 발행 전에 장애가 발생한다.
- 운영자가 직접 값을 수정해 원인과 영향 범위를 알 수 없다.

## 검토 체크리스트

- [ ] 핵심 이벤트 소비자가 멱등한가?
- [ ] Outbox 또는 동등한 유실 방지 장치가 있는가?
- [ ] 대사 배치, DLQ, 수동 보정 감사 로그가 있는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/commerce.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- operations
- integrity
- outbox
- idempotency
- dlq
- audit
