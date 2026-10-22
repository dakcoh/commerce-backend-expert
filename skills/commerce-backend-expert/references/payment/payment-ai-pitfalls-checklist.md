# 결제 구현 체크리스트

- id: payment-ai-pitfalls-checklist
- domain: payment
- category: checklist
- severity: info
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

결제 구현 완료 후 반드시 점검할 체크리스트

## 적용 조건

- payment 도메인의 checklist 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

결제 구현 완료 후 반드시 점검할 체크리스트

## 검토 체크리스트

- [ ] 결제 상태 머신의 모든 전이에 가드 조건이 정의됐는가?
- [ ] 미확정 결제 시도를 검증된 웹훅·조회·대사로 확정하는가?
- [ ] 잘못된 전이 시도에 적절한 예외를 반환하는가?
- [ ] 웹훅 성공 응답 전에 계약상 필요한 검증과 내구성 있는 저장이 완료되는가?
- [ ] 이벤트별 서명·secret 또는 인증된 조회 검증이 계약에 맞는가?
- [ ] 웹훅 중복 수신 방어 (멱등성 처리)가 있는가?
- [ ] 외부 승인 전 결제 가능한 주문의 활성 시도를 원자적으로 선점하는가?
- [ ] 결제사업자의 멱등성 지원 여부를 확인하고 공식 계약에 맞게 사용하는가?
- [ ] 망취소 상황 (응답 타임아웃) 처리 로직이 있는가?
- [ ] 부분 취소 시 쿠폰/포인트 환불 금액을 역산하는가?
- [ ] 정산 완료 후 환불의 공제·출금 절차가 계약에 맞는가?
- [ ] 동일 결제 시도의 재전송과 명시적인 새 결제 시도를 구분하는가?
- [ ] 동시 결제 요청에 낙관락(@Version) 또는 상태 CAS 처리가 있는가?
- [ ] 환불 요청 전 허용 상태와 잔여 환불 가능액·처리 중 금액을 원자적으로 검증하는가?
- [ ] 같은 결제의 다른 거래와 동일 거래를 알리는 복수 이벤트를 구분하는가?
- [ ] 같은 환불 업무키를 재시도에도 유지하고, 요청 지문이 다른 요청은 거부하는가?
- [ ] 환불의 미확정 결과를 인증된 조회·검증된 웹훅으로 확인하고 취소·보상도 멱등하게 처리하는가?

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

- checklist
- pitfalls
- review
- payment

## 검색 표현

- 결제 체크리스트
- 결제 점검표
- payment checklist
