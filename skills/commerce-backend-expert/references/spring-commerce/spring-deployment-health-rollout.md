# 배포와 헬스체크: readiness 기준과 롤백 조건을 명확히 한다

- id: spring-deployment-health-rollout
- domain: spring-commerce
- category: operations
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

애플리케이션 기동 성공만 보지 말고 DB, Redis, 외부 설정, 배치 중복, 핵심 API readiness를 검증한다.

## 적용 조건

- spring-commerce 도메인의 operations 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스 배포는 주문과 결제 흐름을 건드릴 수 있다.
새 버전이 기동은 됐지만 DB 마이그레이션, 외부 API 설정, 캐시 연결이 틀리면 고객 주문이 바로 실패한다.

## 업무 맥락

이커머스 배포는 주문과 결제 흐름을 건드릴 수 있다.
새 버전이 기동은 됐지만 DB 마이그레이션, 외부 API 설정, 캐시 연결이 틀리면 고객 주문이 바로 실패한다.

## Java Spring 구현 가이드

- Spring Boot Actuator health에 liveness와 readiness를 분리한다.
- readiness에는 DB 연결, migration 상태, Redis 필요 기능, 핵심 설정 검증을 포함한다.
- blue-green 또는 rolling 배포 시 이전 버전과 새 버전의 스키마 호환성을 확인한다.
- 배포 후 주문 생성, 결제 웹훅, 재고 예약 같은 smoke test를 자동화한다.

## 피해야 할 패턴

- 프로세스 기동만으로 트래픽을 받게 하지 않는다.
- 스키마 변경과 애플리케이션 변경을 호환성 없이 동시에 적용하지 않는다.
- 배포 후 핵심 도메인 지표 악화를 롤백 조건에 포함하지 않는다.

## 검토 체크리스트

- [ ] liveness와 readiness가 분리되어 있는가?
- [ ] 배포 전후 스키마 호환성과 smoke test가 있는가?
- [ ] 주문 실패율, 결제 불명확 수 같은 롤백 지표가 있는가?

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
- deployment
- actuator
- readiness
- health-check
- rollback
- smoke-test
