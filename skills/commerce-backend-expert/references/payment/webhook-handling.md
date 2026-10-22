# 결제 웹훅 처리 원칙

- id: webhook-handling
- domain: payment
- category: webhook
- severity: critical
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

PG사 웹훅은 이벤트별 인증·검증과 내구성 있는 인수를 짧게 완료한 뒤 계약에 맞는 성공 응답을 반환하고 비즈니스 처리는 비동기로 수행한다

## 적용 조건

- PG사가 결제 결과를 HTTP 웹훅으로 전달한다.

## 적용하지 않는 조건

- PG 계약이 웹훅 외 별도의 신뢰 가능한 결과 조회·확정 절차만 사용하도록 규정한다.

## 전제

- 성공 상태 코드와 응답 제한시간은 사용하는 PG사의 최신 공식 문서를 기준으로 한다.

## 판단 근거

PG사 웹훅은 이벤트별 인증·검증과 내구성 있는 인수를 짧게 완료한 뒤 계약에 맞는 성공 응답을 반환하고 비즈니스 처리는 비동기로 수행한다

## 구현 가이드

- 패턴: 수신 → PG·이벤트별 출처와 진위 검증 → inbox/queue에 내구성 있게 저장 → PG 계약에 맞는 성공 응답 → 별도 워커 처리
- 컨트롤러에서 전체 비즈니스 후처리를 기다리지 말고, 내구성 있는 인수까지만 짧게 완료한다
- 서명이 제공되는 이벤트는 PG 공식 문서의 서명 알고리즘·원문 body·재전송 검증 절차를 따른다. 서명이 없는 이벤트는 계약상 secret 등 검증 수단 또는 인증된 조회 API로 결제 ID·주문·금액·상태를 확인하고, 수신 body만으로 승인 확정하지 않는다
- 이벤트 ID·거래 ID의 고유 범위를 PG·상점·이벤트 유형별로 정의한다. 같은 결제의 승인·부분 취소 등 서로 다른 거래를 결제 번호 하나로 모두 중복 제거하지 않는다
- 같은 업무 효과를 알리는 서로 다른 이벤트도 거래 원장의 업무키와 조건부 상태 전이로 한 번만 반영한다. 역순 이벤트는 발생 순서·현재 조회 결과·원 거래를 대사한다

## 피해야 할 패턴

- inbox/queue 저장 전에 성공 응답 — 응답 직후 장애가 나면 이벤트 영구 유실 가능
- 전체 주문·결제 후처리가 끝날 때까지 응답 지연 — PG 재전송과 중복 처리 증가
- 이벤트별 진위 검증 누락 — 제공되는 서명·secret 검증이나 인증된 조회 없이 외부 body로 결제 완료 처리
- 멱등성 처리 누락 — PG사 재전송 시 중복 결제 완료 처리

## 검토 체크리스트

- [ ] 성공 응답 전에 계약상 필요한 검증과 내구성 있는 저장이 완료되는가?
- [ ] 성공 상태 코드와 응답 제한시간이 PG 공식 계약과 일치하는가?
- [ ] 이벤트별 서명·secret 또는 인증된 조회 검증이 계약에 맞는가?
- [ ] 웹훅 중복 수신 방어 (멱등성 처리)가 있는가?
- [ ] 같은 결제의 다른 거래와 동일 거래를 알리는 복수 이벤트를 구분하는가?

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

- webhook
- async
- signature
- idempotency
- security

## 검색 표현

- 결제 콜백
- payment callback
- callback signature
- PG callback
- 콜백 위조
- 웹훅 위조
