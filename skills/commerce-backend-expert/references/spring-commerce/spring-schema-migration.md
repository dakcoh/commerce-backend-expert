# 스키마 마이그레이션: 주문 원장은 무중단 변경을 전제로 설계한다

- id: spring-schema-migration
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

Flyway/Liquibase로 스키마 변경을 버전 관리하고, 대형 테이블 변경은 expand-migrate-contract 순서로 진행한다.

## 적용 조건

- spring-commerce 도메인의 persistence 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

주문, 결제, 정산 테이블은 서비스가 커질수록 중단 없이 변경해야 한다.
컬럼 추가, 인덱스 생성, 상태 값 변경을 단순 DDL로 처리하면 배포 중 락, 데이터 불일치, 롤백 불가 문제가 생긴다.

## 업무 맥락

주문, 결제, 정산 테이블은 서비스가 커질수록 중단 없이 변경해야 한다.
컬럼 추가, 인덱스 생성, 상태 값 변경을 단순 DDL로 처리하면 배포 중 락, 데이터 불일치, 롤백 불가 문제가 생긴다.

## Java Spring 구현 가이드

- Flyway 또는 Liquibase로 스키마 변경 이력을 코드와 함께 관리한다.
- nullable 컬럼 추가, 백필, 코드 전환, not null 제약 추가를 단계적으로 수행한다.
- 대형 테이블 인덱스는 DB별 online/concurrent 옵션을 검토한다.
- enum 상태 변경은 이전 버전 코드와의 호환성을 고려한다.

## 피해야 할 패턴

- 운영 DB에 수동 DDL을 적용하고 이력을 남기지 않는 방식을 피한다.
- 대형 주문 테이블에 default not null 컬럼을 한 번에 추가하지 않는다.
- 배포 전후 코드가 함께 읽는 상태 값을 갑자기 삭제하지 않는다.

## 검토 체크리스트

- [ ] 스키마 변경이 Flyway/Liquibase로 버전 관리되는가?
- [ ] 대형 테이블 변경에 expand-migrate-contract 계획이 있는가?
- [ ] 롤백 또는 forward-fix 전략이 명확한가?

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
- database
- migration
- flyway
- liquibase
- zero-downtime
- schema
