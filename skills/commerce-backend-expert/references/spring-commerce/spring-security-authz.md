# Spring Security 권한: 인증, 인가, 소유권 검증을 분리한다

- id: spring-security-authz
- domain: spring-commerce
- category: security
- severity: high
- status: needs-review
- evidenceLevel: external-source
- owner: commerce-context-maintainers
- verifiedBy: Codex (AI 문서 검토)
- lastReviewedAt: 2026-10-24
- changeNote: JWT 유효성 검증과 역할·소유권 인가, 메서드 보안 활성화를 구분했다. 실제 권한 정책·공격 시나리오는 미검증이다.
- jurisdiction: KR

## 요약

로그인 여부만 확인하지 말고 사용자, 판매자, 운영자 권한과 리소스 소유권을 함께 검증한다.

## 적용 조건

- spring-commerce 도메인의 security 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

이커머스에는 고객, 판매자, CS 운영자, 관리자, 배치 시스템처럼 서로 다른 행위자가 있다.
주문 조회, 환불, 정산, 상품 수정은 권한과 소유권이 잘못되면 개인정보 노출이나 금전 피해로 이어진다.

## Java Spring 구현 가이드

- 인증(Authentication), 역할 기반 인가(Role), 리소스 소유권 검증을 분리한다.
- Controller 진입 전에는 coarse-grained 권한을 확인하고 Service에서 도메인 소유권을 검증한다.
- 관리자 기능은 조회 권한과 수정 권한을 나누고 사유 입력과 감사 로그를 요구한다.
- JWT를 사용하면 서명·허용 알고리즘·exp/nbf·issuer와 계약상 audience를 검증한 뒤 claim을 사용한다. 유효한 토큰이라도 요청한 리소스의 소유권·판매자/테넌트 범위를 따로 인가하며, 권한 변경의 반영 정책에 따라 서버 원장과 대조한다.
- 메서드 보안을 사용하면 @EnableMethodSecurity 등 활성화와 실제 호출 경로를 확인한다. 애너테이션을 붙였다는 사실만으로 서비스 인가가 실행됐다고 간주하지 않는다.

## 피해야 할 패턴

- isAuthenticated()만으로 주문 상세 조회를 허용하지 않는다.
- 판매자 ID를 요청 파라미터로 받아 그대로 신뢰하지 않는다.
- 관리자 권한 하나로 모든 조회와 수정을 허용하지 않는다.

## 검토 체크리스트

- [ ] 사용자 역할과 리소스 소유권 검증이 모두 있는가?
- [ ] 판매자/운영자 기능의 권한 경계가 분리되어 있는가?
- [ ] 민감 조작에 감사 로그와 사유가 남는가?

## 출처

### 프로젝트 관리 지식 — 이관 출처

- source: src/main/resources/knowledge/spring-commerce.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

### Spring Security — JWT Resource Server

- source: https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html
- type: official-documentation
- sourceVersion: 7.1.2
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: 서명·시간·issuer 검증과 별도 audience 설정 참고다. 토큰의 유효성이 리소스 접근 권한을 대신하지 않는다.

### Spring Security — Method Security

- source: https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html
- type: official-documentation
- sourceVersion: 7.1.2
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: 서비스 메서드 인가와 명시적 활성화의 기술 참고다. 회사 역할·소유권 정책은 별도 정의한다.

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
