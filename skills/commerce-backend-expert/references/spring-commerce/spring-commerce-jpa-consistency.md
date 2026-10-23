# JPA 영속성: 엔티티와 조회 모델을 분리한다

- id: spring-commerce-jpa-consistency
- domain: spring-commerce
- category: persistence
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

주문 원장 엔티티를 API 응답에 직접 노출하지 말고, 쓰기 모델과 조회 DTO를 분리한다.

## 적용 조건

- spring-commerce 도메인의 persistence 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

주문과 상품은 연관관계가 많고 데이터가 빠르게 늘어난다.
엔티티 그래프를 그대로 직렬화하면 N+1, 순환 참조, 과도한 조회가 발생하기 쉽다.

## Java Spring 구현 가이드

- JPA Entity는 내부 쓰기 모델로 사용하고 API 응답은 DTO 또는 projection으로 반환한다.
- 목록 조회는 fetch join 남용보다 projection, batch fetch, 별도 조회 모델을 선택한다.
- 주문 라인 가격과 상품 정보는 현재 Product Entity 참조만 믿지 말고 스냅샷으로 저장한다.
- 대량 배치는 offset보다 cursor 기반 페이징을 우선한다.

## 피해야 할 패턴

- Entity를 Controller 응답으로 직접 반환하지 않는다.
- 모든 연관관계를 EAGER로 설정하지 않는다.
- 대량 데이터를 findAll()로 메모리에 올리지 않는다.

## 검토 체크리스트

- [ ] API DTO와 JPA Entity가 분리됐는가?
- [ ] 목록 조회의 N+1을 검증했는가?
- [ ] 대량 배치가 cursor 기반으로 동작하는가?

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
- jpa
- entity
- dto
- projection
- n-plus-one
- cursor
