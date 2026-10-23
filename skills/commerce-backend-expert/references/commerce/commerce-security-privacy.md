# 보안과 개인정보: 최소 수집, 권한 경계, 감사 가능성을 기본값으로 둔다

- id: commerce-security-privacy
- domain: commerce
- category: security
- severity: high
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

이커머스는 개인정보와 결제 민감 정보를 다루므로 기능 설계 단계부터 권한, 마스킹, 감사 로그를 포함한다.

## 적용 조건

- commerce 도메인의 security 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

주문, 배송, 결제, CS 데이터에는 이름, 주소, 전화번호, 결제 식별자 등 민감 정보가 포함된다.
운영자 도구와 외부 연동이 많기 때문에 권한 경계가 흐려지면 개인정보 노출과 부정 조작 위험이 커진다.

## 업무 맥락

주문, 배송, 결제, CS 데이터에는 이름, 주소, 전화번호, 결제 식별자 등 민감 정보가 포함된다.
운영자 도구와 외부 연동이 많기 때문에 권한 경계가 흐려지면 개인정보 노출과 부정 조작 위험이 커진다.

## 반드시 지켜야 할 원칙

- 개인정보는 목적에 필요한 최소 범위만 저장한다.
- 운영자 조회와 수정은 권한, 사유, 감사 로그를 요구한다.
- 결제 카드 원문, 인증 값, 불필요한 민감 정보는 저장하지 않는다.

## 권장 흐름

- 데이터 필드별 민감도와 보존 기간을 정의한다.
- API와 관리자 기능에 역할 기반 접근 제어를 적용한다.
- 로그와 이벤트에서 개인정보를 마스킹한다.
- 수동 변경과 민감 정보 조회를 감사 로그로 남긴다.

## 기술 구현 참고

- PII 필드는 암호화, 마스킹, 접근 로그를 함께 설계한다.
- 관리자 API는 read 권한과 write 권한을 분리한다.
- 외부 연동 payload에는 필요한 필드만 전달하고 correlationId로 추적한다.

## 실패 시나리오

- 주문 로그에 전화번호와 주소가 평문으로 남는다.
- CS 운영자가 권한 없이 환불 계좌나 배송지를 수정한다.
- 외부 채널 연동에 불필요한 개인정보가 과다 전송된다.

## 검토 체크리스트

- [ ] 개인정보 필드별 보존, 암호화, 마스킹 정책이 있는가?
- [ ] 운영자 조회와 수정이 권한과 감사 로그로 통제되는가?
- [ ] 결제 민감 정보와 인증 값이 저장되지 않는가?

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

- security
- privacy
- pii
- masking
- audit
- rbac
