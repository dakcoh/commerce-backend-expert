# 설정과 Secret: 환경별 설정과 민감 값을 코드에서 분리한다

- id: spring-configuration-secrets
- domain: spring-commerce
- category: configuration
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

PG 키, JWT secret, 외부 API endpoint, feature flag는 환경별 설정으로 관리하고 소스 코드와 로그에 노출하지 않는다.

## 적용 조건

- spring-commerce 도메인의 configuration 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

이커머스는 PG, 택배사, 알림, 검색, 외부 채널처럼 많은 외부 시스템과 연결된다.
운영과 개발 설정이 섞이면 실제 결제 호출, 잘못된 웹훅 검증, 개인정보 유출 같은 사고가 발생할 수 있다.

## Java Spring 구현 가이드

- @ConfigurationProperties로 설정을 타입 안전하게 바인딩하고 검증한다.
- dev, local, staging, prod profile을 분리하고 기본값이 운영 사고를 만들지 않게 한다.
- Secret은 환경 변수, vault, secret manager로 주입한다.
- 설정 값 출력 로그에서 key, token, secret, password를 마스킹한다.

## 피해야 할 패턴

- PG secret이나 JWT secret을 application.yml에 평문 커밋하지 않는다.
- 운영 profile 기본값을 local endpoint로 두지 않는다.
- 외부 API 키를 예외 메시지나 디버그 로그에 출력하지 않는다.

## 검토 체크리스트

- [ ] 외부 연동 설정이 @ConfigurationProperties로 검증되는가?
- [ ] 운영 Secret이 소스 코드에 없고 로그에서 마스킹되는가?
- [ ] 환경별 profile과 feature flag 기본값이 안전한가?

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
- configuration
- profile
- secret
- vault
- properties
- masking
