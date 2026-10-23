# 멱등성 설계 (중복 요청 방어)

- id: idempotency
- domain: inventory
- category: idempotency
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

네트워크 재시도로 인한 재고 이중 차감을 idempotency key로 방어한다

## 적용 조건

- inventory 도메인의 idempotency 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

네트워크 재시도로 인한 재고 이중 차감을 idempotency key로 방어한다

## 구현 가이드

- 같은 논리적 재고 작업의 재전송에는 같은 idempotency key를 사용한다. 예: 주문 라인·작업 종류·시도 식별자를 구분하는 업무키
- 업무키 형식은 UUID·전역 순번이나 원 업무일자·순번의 복합키 등으로 선택할 수 있다. 상점·작업 종류·주문 라인 등 고유 범위를 정의하고 원래 값을 영속 보관한다. 자정이 지난 재시도에도 날짜·순번·UUID를 재발급해 같은 작업을 새 차감으로 만들지 않는다
- 이미 처리된 키면 저장된 결과를 그대로 반환
- 보존 기간은 재시도·이벤트 재전달·운영 재처리 창에 맞춘다. 캐시 TTL 만료 뒤에도 영속 업무키와 처리 이력으로 같은 효과의 중복 반영을 막는다
- 키와 요청 수량 등 payload를 연결해 같은 키의 다른 요청을 거부하고, 처리중·완료·확정 실패 상태를 구분한다

## 피해야 할 패턴

- 멱등성 없으면 네트워크 재시도 시 재고 이중 차감 발생

## 검토 체크리스트

- [ ] 재고 차감 API에 멱등성 키가 적용됐는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/inventory.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- idempotency
- duplicate-request

## 검색 표현

- 재고 요청 멱등성
- 재고 이중 차감
- inventory idempotency
