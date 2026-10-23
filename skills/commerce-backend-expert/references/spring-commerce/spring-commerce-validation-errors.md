# API 계약: 검증 오류와 비즈니스 오류를 분리한다

- id: spring-commerce-validation-errors
- domain: spring-commerce
- category: api
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

Bean Validation, 비즈니스 예외, 외부 연동 오류를 구분하고 일관된 오류 응답을 제공한다.

## 적용 조건

- spring-commerce 도메인의 api 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

주문 수량 오류, 재고 부족, 결제 타임아웃은 서로 다른 후속 조치가 필요하다.
모두 500 오류로 반환하면 클라이언트와 운영자가 복구 방법을 결정할 수 없다.

## Java Spring 구현 가이드

- 요청 DTO에는 @NotNull, @Positive, @Size 같은 Bean Validation을 적용한다.
- @RestControllerAdvice에서 오류 코드, 메시지, correlationId를 일관되게 반환한다.
- 재고 부족, 쿠폰 만료, 상태 전이 거부는 명시적인 비즈니스 오류 코드로 표현한다.
- 로그에는 correlationId를 남기고 개인정보와 결제 민감 정보는 마스킹한다.

## 피해야 할 패턴

- 예상 가능한 비즈니스 오류를 RuntimeException 하나로 처리하지 않는다.
- 내부 stack trace를 API 응답에 노출하지 않는다.
- 카드 정보, 이메일, 전화번호를 평문 로그로 남기지 않는다.

## 검토 체크리스트

- [ ] 입력 검증과 비즈니스 검증이 분리됐는가?
- [ ] 오류 응답에 안정적인 errorCode와 correlationId가 있는가?
- [ ] 민감 정보가 로그에서 마스킹되는가?

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
- validation
- controller-advice
- error-code
- correlation-id
- masking
