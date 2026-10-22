# Null과 예외 경계: 실패 가능성을 타입과 계약으로 드러낸다

- id: java-null-exception-boundary
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

null을 암묵적인 실패 신호로 쓰지 말고 Optional, 명시적 예외, 결과 타입으로 호출자 계약을 분명히 한다.

## 적용 조건

- spring-commerce 도메인의 java-core 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

상품 없음, 쿠폰 만료, 재고 부족, 결제 불명확은 서로 다른 의미를 가진 실패다.
이를 null이나 RuntimeException 하나로 표현하면 호출자가 후속 처리와 복구 흐름을 구분하기 어렵다.

## 업무 맥락

상품 없음, 쿠폰 만료, 재고 부족, 결제 불명확은 서로 다른 의미를 가진 실패다.
이를 null이나 RuntimeException 하나로 표현하면 호출자가 후속 처리와 복구 흐름을 구분하기 어렵다.

## Java Spring 구현 가이드

- 조회 결과가 없을 수 있는 Repository/Service는 Optional 또는 명시적 NotFound 예외를 사용한다.
- 비즈니스 규칙 위반은 도메인 예외와 안정적인 errorCode로 표현한다.
- 외부 API 실패는 timeout, retryable, non-retryable, uncertain 상태로 분리한다.
- 예외 변환은 ControllerAdvice 또는 adapter boundary에서 수행한다.

## 피해야 할 패턴

- null 반환 후 호출자에게 암묵적으로 판단을 맡기지 않는다.
- 모든 실패를 RuntimeException 또는 500 응답으로 처리하지 않는다.
- 외부 API 타임아웃을 단순 실패로 확정하지 않는다.

## 검토 체크리스트

- [ ] 없음, 규칙 위반, 외부 장애가 다른 타입/코드로 표현되는가?
- [ ] null 반환 정책이 명확하거나 제거됐는가?
- [ ] 예외가 계층 경계에서 일관되게 변환되는가?

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
- null
- optional
- exception
- error-code
- boundary
