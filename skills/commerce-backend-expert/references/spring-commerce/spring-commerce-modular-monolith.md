# Spring 이커머스 시작 구조: 모듈형 모놀리스

- id: spring-commerce-modular-monolith
- domain: spring-commerce
- category: architecture
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

초기부터 MSA로 쪼개지 말고 도메인 경계를 코드 모듈로 분리한 Spring Boot 애플리케이션으로 시작한다.

## 적용 조건

- spring-commerce 도메인의 architecture 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스는 상품, 주문, 재고, 결제, 프로모션, 배송, 정산이 서로 연결된다.
초기 단계에서 서비스까지 물리적으로 분리하면 장애 추적, 배포, 데이터 정합성 관리 비용이 빠르게 커진다.

## 업무 맥락

이커머스는 상품, 주문, 재고, 결제, 프로모션, 배송, 정산이 서로 연결된다.
초기 단계에서 서비스까지 물리적으로 분리하면 장애 추적, 배포, 데이터 정합성 관리 비용이 빠르게 커진다.

## Java Spring 구현 가이드

- catalog, order, inventory, payment, promotion, fulfillment, settlement 패키지를 도메인 기준으로 분리한다.
- 도메인 간 호출은 공개 application service를 통해 수행하고 다른 모듈의 Repository를 직접 사용하지 않는다.
- 트랜잭션 경계는 application service에 두고 Controller는 입력 검증과 응답 변환만 담당한다.
- 외부 연동은 adapter 패키지로 격리한다.

## 피해야 할 패턴

- Controller에서 여러 Repository를 직접 호출하지 않는다.
- 처음부터 모든 도메인을 독립 MSA로 분리하지 않는다.
- common 패키지에 도메인 로직을 무분별하게 모으지 않는다.

## 검토 체크리스트

- [ ] 도메인별 패키지 경계가 있는가?
- [ ] 다른 모듈의 Repository를 직접 참조하지 않는가?
- [ ] 외부 PG, 택배, 채널 API가 adapter로 격리됐는가?

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
- architecture
- modular-monolith
- package
- adapter
