# Redis 캐시: 원장과 가속 계층의 역할을 구분한다

- id: spring-commerce-cache-boundary
- domain: spring-commerce
- category: cache
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

Redis를 빠른 조회와 접수 제어에 사용하되 주문·결제·정산의 최종 원장으로 취급하지 않는다.

## 적용 조건

- spring-commerce 도메인의 cache 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

상품 조회와 선착순 이벤트는 Redis의 도움을 받을 수 있다.
하지만 캐시 만료, 장애, 데이터 유실을 전제로 DB 원장과 복구 경로가 필요하다.

## 업무 맥락

상품 조회와 선착순 이벤트는 Redis의 도움을 받을 수 있다.
하지만 캐시 만료, 장애, 데이터 유실을 전제로 DB 원장과 복구 경로가 필요하다.

## Java Spring 구현 가이드

- @Cacheable은 변경 빈도와 허용 가능한 stale time이 명확한 조회에만 적용한다.
- 캐시 키에 도메인, 버전, 식별자를 포함한다.
- 재고와 쿠폰 접수에 Redis를 사용하면 DB 원장과 불일치 보정 작업을 준비한다.
- 장애 시 fail-open과 fail-closed 정책을 기능별로 결정한다.

## 피해야 할 패턴

- 결제 성공 여부와 정산 결과를 Redis에만 저장하지 않는다.
- 캐시 무효화 정책 없이 상품 가격을 장시간 캐시하지 않는다.
- Redis 장애 시 무제한 DB fallback으로 장애를 증폭시키지 않는다.

## 검토 체크리스트

- [ ] DB 원장과 Redis 역할이 분리됐는가?
- [ ] TTL과 캐시 무효화 정책이 있는가?
- [ ] Redis 장애 시 기능별 정책과 보정 작업이 있는가?

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
- redis
- cache
- ttl
- fail-open
- fail-closed
- reconciliation

## 검색 표현

- 캐시 원장
- cache as source of truth
- redis cache boundary
