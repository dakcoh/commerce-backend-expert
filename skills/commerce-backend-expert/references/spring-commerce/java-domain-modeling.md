# Java 도메인 모델링: 원시 타입 집착을 줄이고 의미 있는 타입을 둔다

- id: java-domain-modeling
- domain: spring-commerce
- category: java-core
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

orderId, money, quantity, email 같은 값을 String과 long으로 흩뿌리지 말고 값 객체와 검증 규칙으로 묶는다.

## 적용 조건

- spring-commerce 도메인의 java-core 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

이커머스 코드는 주문 ID, 상품 ID, 금액, 수량, 상태, 정책 버전처럼 비슷해 보이지만 의미가 다른 값을 많이 다룬다.
의미 없는 원시 타입만 사용하면 파라미터 순서 실수, 통화 혼동, 음수 수량 같은 오류가 컴파일 단계에서 걸리지 않는다.

## Java Spring 구현 가이드

- Money, Quantity, OrderNo, SkuId 같은 값 객체를 사용해 의미와 검증을 묶는다.
- 불변 값은 record 또는 final 필드를 가진 클래스로 표현한다.
- 도메인 생성자나 정적 팩토리에서 null, 음수, 빈 문자열을 검증한다.
- JPA Entity와 도메인 값 객체 사이의 매핑 책임을 명확히 둔다.

## 피해야 할 패턴

- 모든 식별자와 상태를 String으로만 전달하지 않는다.
- 금액, 수량, 할인율을 검증 없이 primitive로 넘기지 않는다.
- DTO 검증만 믿고 도메인 내부 검증을 생략하지 않는다.

## 검토 체크리스트

- [ ] 식별자, 금액, 수량에 의미 있는 타입이 있는가?
- [ ] 값 객체가 불변이고 생성 시 검증되는가?
- [ ] DTO와 도메인 모델의 책임이 분리되어 있는가?

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

- java
- domain-model
- value-object
- record
- validation
- type-safety
