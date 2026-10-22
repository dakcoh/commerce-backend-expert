# Spring Security 권한: 인증, 인가, 소유권 검증을 분리한다

- id: spring-security-authz
- domain: spring-commerce
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

로그인 여부만 확인하지 말고 사용자, 판매자, 운영자 권한과 리소스 소유권을 함께 검증한다.

## 적용 조건

- spring-commerce 도메인의 security 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스에는 고객, 판매자, CS 운영자, 관리자, 배치 시스템처럼 서로 다른 행위자가 있다.
주문 조회, 환불, 정산, 상품 수정은 권한과 소유권이 잘못되면 개인정보 노출이나 금전 피해로 이어진다.

## 업무 맥락

이커머스에는 고객, 판매자, CS 운영자, 관리자, 배치 시스템처럼 서로 다른 행위자가 있다.
주문 조회, 환불, 정산, 상품 수정은 권한과 소유권이 잘못되면 개인정보 노출이나 금전 피해로 이어진다.

## Java Spring 구현 가이드

- 인증(Authentication), 역할 기반 인가(Role), 리소스 소유권 검증을 분리한다.
- Controller 진입 전에는 coarse-grained 권한을 확인하고 Service에서 도메인 소유권을 검증한다.
- 관리자 기능은 조회 권한과 수정 권한을 나누고 사유 입력과 감사 로그를 요구한다.
- JWT claim을 그대로 신뢰하지 말고 필요한 경우 서버 원장과 대조한다.

## 피해야 할 패턴

- isAuthenticated()만으로 주문 상세 조회를 허용하지 않는다.
- 판매자 ID를 요청 파라미터로 받아 그대로 신뢰하지 않는다.
- 관리자 권한 하나로 모든 조회와 수정을 허용하지 않는다.

## 검토 체크리스트

- [ ] 사용자 역할과 리소스 소유권 검증이 모두 있는가?
- [ ] 판매자/운영자 기능의 권한 경계가 분리되어 있는가?
- [ ] 민감 조작에 감사 로그와 사유가 남는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/spring-commerce.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- spring
- security
- authentication
- authorization
- ownership
- audit
- jwt

## 검색 표현

- 소유권 검증
- object ownership
- ownership check
- 다른 사용자 데이터 접근
- 다른 회원
- 다른 고객
- 타인 주문
- 주문번호 변조
- IDOR
