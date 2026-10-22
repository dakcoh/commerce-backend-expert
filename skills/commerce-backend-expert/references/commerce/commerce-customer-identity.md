# 고객과 식별자: 회원, 비회원, 수신자를 분리한다

- id: commerce-customer-identity
- domain: commerce
- category: customer
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

로그인 계정, 주문자, 수령자, 결제자, 배송지는 같은 사람이 아닐 수 있으므로 식별자를 분리한다.

## 적용 조건

- commerce 도메인의 customer 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스에서는 회원 주문, 비회원 주문, 선물하기, 대리 구매, 법인 구매가 모두 발생한다.
주문자는 결제를 수행한 사람이고 수령자는 상품을 받는 사람이며, 계정 소유자와도 다를 수 있다.
개인정보 삭제 요청과 과거 주문 보존 의무가 충돌할 수 있으므로 식별자와 스냅샷 정책이 필요하다.

## 업무 맥락

이커머스에서는 회원 주문, 비회원 주문, 선물하기, 대리 구매, 법인 구매가 모두 발생한다.
주문자는 결제를 수행한 사람이고 수령자는 상품을 받는 사람이며, 계정 소유자와도 다를 수 있다.
개인정보 삭제 요청과 과거 주문 보존 의무가 충돌할 수 있으므로 식별자와 스냅샷 정책이 필요하다.

## 반드시 지켜야 할 원칙

- customerId, orderer snapshot, recipient snapshot, delivery address snapshot을 분리한다.
- 비회원 주문도 추적 가능한 주문 식별자와 인증 수단을 가진다.
- 개인정보 변경이나 탈퇴가 과거 주문의 회계, 정산, 배송 이력을 깨지 않는다.

## 권장 흐름

- 계정 식별자와 주문 시점 주문자 정보를 분리해 저장한다.
- 배송지와 수령자 연락처는 주문 시점 스냅샷으로 보존한다.
- 개인정보 삭제 요청 시 법적 보존 대상과 마스킹 대상을 구분한다.

## 기술 구현 참고

- 회원 테이블을 주문 이력의 유일한 개인정보 원천으로 사용하지 않는다.
- 주문에는 필요한 최소 개인정보 스냅샷만 저장하고 민감 값은 암호화 또는 마스킹한다.
- 탈퇴 회원은 계정 상태와 주문 참조 무결성을 분리해 처리한다.

## 실패 시나리오

- 회원 이름 변경 후 과거 주문의 주문자명이 함께 바뀐다.
- 회원 탈퇴 시 주문, 환불, 정산 이력이 조회 불가능해진다.
- 선물 주문에서 주문자와 수령자를 혼동해 개인정보가 잘못 노출된다.

## 검토 체크리스트

- [ ] 회원, 주문자, 수령자, 결제자가 분리되어 있는가?
- [ ] 비회원 주문 조회와 인증 경로가 있는가?
- [ ] 개인정보 보존, 마스킹, 삭제 정책이 주문 이력과 충돌하지 않는가?

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

- customer
- identity
- guest-order
- privacy
- snapshot
- pii
