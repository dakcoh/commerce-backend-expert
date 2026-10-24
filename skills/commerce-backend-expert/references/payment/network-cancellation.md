# 망취소 처리 (결제 응답 불명확 상황)

- id: network-cancellation
- domain: payment
- category: network-cancel
- severity: high
- status: needs-review
- evidenceLevel: external-source
- owner: commerce-context-maintainers
- verifiedBy: Codex (AI 문서 검토)
- lastReviewedAt: 2026-10-24
- changeNote: 응답 유실·늦은 승인·보상의 대사 경계와 시도 기록의 커밋을 검토했다. 실제 PG 망취소 계약은 별도 확인한다.
- jurisdiction: KR

## 요약

결제 응답을 받지 못한 상황은 미확정 상태로 기록하고 결제사업자의 조회·망취소 계약에 따라 비동기로 최종 상태를 확인한다

## 적용 조건

- 결제 승인 요청 후 timeout, 연결 종료 또는 응답 유실로 승인 결과를 확정할 수 없다.

## 적용하지 않는 조건

- 결제사업자가 동기 응답 외의 별도 상태 확인이나 취소 절차를 제공하지 않는 경우 계약에 따른 예외 처리가 필요하다.

## 전제

- 조회 가능 시점, 망취소 지원 여부와 최종 상태 값은 결제사업자 공식 문서를 기준으로 한다.

## 구현 가이드

- 외부 결제 요청 전에 DB에 결제 시도 ID·요청 지문·PENDING 상태를 영속 커밋한다. 외부 호출 실패로 이 시도 기록까지 롤백해 복구 근거를 잃지 않는다
- 응답 타임아웃은 해당 결제 시도를 UNCERTAIN으로 기록한다. 주문·예약 상태와 취소 의사는 별도로 보존하고 미확정 결과만으로 재고를 무조건 해제하지 않는다
- 스케줄러나 재처리 워커가 계약상 허용된 시점에 인증된 조회 API를 호출하거나 검증된 웹훅으로 원 시도를 확인한다. 결제 ID·주문·금액·통화를 대조하고 검증되지 않은 수신 body만으로 확정하지 않는다
- 결제사업자 응답을 내부 상태에 매핑하고 성공·실패·취소·계속 미확정 상태를 구분한다
- 일정 시간 후 자동 취소할지는 결제사업자의 망취소 계약과 내부 보상 정책으로 결정한다
- 주문 취소와 늦은 승인 경합은 원 시도를 조회하고, 승인·취소 결과에 따라 주문 확정 또는 멱등 보상한다. 보상은 원 거래와 보상 업무키·요청 지문을 영속 연결하고 같은 보상의 재시도에 동일 키를 사용한다. 보상 결과도 미확정이면 조회·대사하며 새 키로 재승인하거나 이미 해제한 재고를 중복 복구하지 않는다
- 가상계좌는 입금 대기·입금 기한·입금 취소를 구분한다. 기한 만료 후 입금 통지는 실제 거래와 주문·재고를 대사하고 수락·환불 등 계약상 경로로 처리한다

## 피해야 할 패턴

- 망취소 상태 주문 방치 — 재고가 예약된 채 고객에게 서비스 불가
- 응답 불명확 상태와 후속 조회·망취소 절차를 구현하지 않아 주문이 영구 미확정으로 남음

## 검토 체크리스트

- [ ] 망취소 상황 (응답 타임아웃) 처리 로직이 있는가?
- [ ] 미확정 결과를 인증된 조회·검증된 웹훅으로 확인하고, 취소·보상의 재시도도 멱등하게 처리하는가?

## 출처

### 프로젝트 관리 지식 — 이관 출처

- source: src/main/resources/knowledge/payment.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

### 토스페이먼츠 — 결제 상태와 취소 API

- source: https://docs.tosspayments.com/reference
- type: official-documentation
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: 토스의 상태·조회·부분취소 계약 참고다. 내부 환불 한도·배부 정책이나 다른 PG를 검증한 기록은 아니다.

### AWS Builders Library — Idempotent APIs

- source: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
- type: official-documentation
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: 요청 식별·파라미터 불일치·재시도의 설계 참고다. 회사 정책이나 특정 PG 보장을 입증하지 않는다.

## 태그

- network-cancel
- timeout
- scheduler
- payment-status
- uncertainty

## 검색 표현

- 망취소
- 결제 응답 유실
- unknown payment
- 승인 결과 불명
- 카드 승인 타임아웃
