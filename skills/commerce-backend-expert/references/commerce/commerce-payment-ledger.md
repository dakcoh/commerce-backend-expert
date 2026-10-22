# 결제: 주문 상태와 결제 거래 원장을 분리한다

- id: commerce-payment-ledger
- domain: commerce
- category: payment
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

결제는 성공 여부 한 칸이 아니라 승인, 매입, 취소, 환불 거래의 누적 원장이다.

## 적용 조건

- commerce 도메인의 payment 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

결제는 PG사와 네트워크를 사이에 둔 외부 거래다.
요청 타임아웃이 실패를 의미하지 않으며, 웹훅은 중복 또는 순서가 뒤바뀌어 도착할 수 있다.

## 업무 맥락

결제는 PG사와 네트워크를 사이에 둔 외부 거래다.
요청 타임아웃이 실패를 의미하지 않으며, 웹훅은 중복 또는 순서가 뒤바뀌어 도착할 수 있다.

## 반드시 지켜야 할 원칙

- 주문 상태와 payment_transaction 원장을 분리한다.
- 동일 결제 시도의 재전송은 같은 업무키를 사용한다. PG 결제 식별자와 승인·부분 취소별 거래 식별자의 범위를 구분하고 사업자·상점별 고유 범위에 맞는 제약을 둔다.
- 타임아웃은 FAILED가 아니라 결과를 확인해야 하는 UNCERTAIN 상태로 처리한다.

## 권장 흐름

- 결제 요청 전에 PENDING 거래를 저장한다.
- 외부 승인 전 활성 시도를 원자적으로 선점한다. PG가 멱등성을 지원하면 공식 계약에 맞게 같은 시도의 키를 전달하고 미지원 시 미확정 요청의 자동 재승인을 피한다.
- 동기 응답과 이벤트별 인증·검증을 마친 웹훅 또는 인증된 조회 결과로 거래 상태를 확정한다.
- 불명확 거래는 조회 API와 스케줄러로 대사한다.
- 가상계좌의 입금 기한 만료 후 통지·입금 취소는 원 거래와 주문·재고 상태를 대사해 수락·환불 등 계약상 절차를 선택한다.

## 기술 구현 참고

- payment_transaction은 요청 지문·허용된 거래 식별자·상태·금액·시각과 결과 요약을 보존한다. 요청/응답 전문의 카드·계좌·인증 secret 등 민감정보는 수집을 최소화하고 로그에 노출하지 않는다.
- 웹훅 수신은 계약상 검증과 내구성 있는 인수 후 빠르게 응답하고 비동기 후처리한다. 이벤트 ID 중복과 동일 업무 효과의 중복 처리를 별도로 방어한다.
- 환불은 원 결제 거래를 참조하는 별도 거래로 기록한다.

## 실패 시나리오

- 사용자 재클릭으로 같은 주문이 두 번 결제된다.
- PG사는 승인했지만 타임아웃 때문에 서비스가 실패로 기록한다.
- 중복 웹훅으로 포인트와 재고가 두 번 처리된다.

## 검토 체크리스트

- [ ] 결제 멱등성 키와 PG 거래 번호 UNIQUE 제약이 있는가?
- [ ] UNCERTAIN 상태와 대사 작업이 있는가?
- [ ] 웹훅 서명 검증과 중복 방어가 있는가?

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

- payment
- ledger
- idempotency
- webhook
- reconciliation
- uncertain

## 검색 표현

- 결제 거래 원장
- 승인 취소 환불 원장
- payment ledger
- payment transaction
