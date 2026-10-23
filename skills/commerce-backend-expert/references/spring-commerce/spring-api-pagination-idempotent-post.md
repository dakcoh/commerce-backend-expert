# REST API 설계: 페이지네이션과 멱등 POST 계약을 명확히 한다

- id: spring-api-pagination-idempotent-post
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

목록 API는 cursor 기반 탐색을 우선하고, 주문 생성 같은 POST는 idempotency key로 중복 실행을 방어한다.

## 적용 조건

- spring-commerce 도메인의 api 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 업무 맥락

상품, 주문, 정산 목록은 데이터가 빠르게 커지고 정렬 기준도 자주 바뀐다.
주문 생성이나 결제 요청은 사용자의 재클릭, 네트워크 재시도, 클라이언트 타임아웃으로 같은 요청이 여러 번 도착할 수 있다.

## Java Spring 구현 가이드

- 대량 목록 API는 offset/limit보다 cursor, sort key, hasNext를 포함한 응답을 우선한다.
- 정렬 기준은 안정적인 unique tie-breaker를 포함한다.
- 주문 생성, 결제 요청, 쿠폰 사용 같은 POST에는 idempotency key를 받는다.
- 같은 idempotency key 요청에는 최초 처리 결과 또는 동일한 오류 계약을 반환한다.
- 키의 범위를 호출자·업무 종류·논리적 시도로 정의하고 요청 지문을 저장한다. 같은 키의 다른 payload는 거부하고 처리 중·미확정·완료·확정 실패의 응답과 재처리 계약을 구분한다.

## 피해야 할 패턴

- page=99999 같은 offset 페이지로 대형 테이블을 깊게 스캔하지 않는다.
- createdAt 단독 정렬처럼 중복 값에서 순서가 흔들리는 cursor를 사용하지 않는다.
- 사용자 재시도마다 주문을 새로 만들지 않는다.

## 검토 체크리스트

- [ ] 목록 API에 안정적인 cursor와 tie-breaker가 있는가?
- [ ] 상태 변경 POST가 idempotency key를 받는가?
- [ ] 중복 요청의 응답 계약이 정의되어 있는가?

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
- rest-api
- cursor
- pagination
- idempotency
- post

## 검색 표현

- cursor pagination
- offset pagination
- 커서 페이징
- 중복 페이지

## 관련 규칙

- [idempotency](../inventory/idempotency.md)
- [payment-idempotency](../payment/payment-idempotency.md)
