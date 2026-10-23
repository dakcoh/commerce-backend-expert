# 선착순 쿠폰 발급 — 동시성 제어

- id: coupon-issuance
- domain: coupon
- category: issuance
- severity: high
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

선착순 쿠폰 발급은 재고 확인과 사용자 중복 선점을 하나의 원자적 연산으로 처리하고 DB 제약으로 최종 방어한다

## 적용 조건

- coupon 도메인의 issuance 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 구현 가이드

- DB 조건부 수량 갱신과 발급 업무키 UNIQUE를 같은 트랜잭션에서 처리하는 DB-only 방식도 가능하다. 확보 성공 여부와 양수 수량·총 한도를 함께 검증한다
- Redis 사용 시 재고 확인·감소와 사용자 중복 선점을 하나의 Lua Script로 처리한다. DECR와 SETNX를 애플리케이션에서 따로 호출하면 전체 흐름은 원자적이지 않다
- DB 비관락: SELECT ... FOR UPDATE → 발급 수량 체크 + 업데이트 원자적 처리 (단: 트래픽 폭주 시 DB 커넥션 소진 위험)
- 메시지 큐 (비동기 발급): 발급 요청 → 큐 적재 → 워커가 순차 처리 (장점: DB 부하 분산 / 단점: 즉시 발급 피드백 불가)
- 이중 발급 방어: 1인 1매 캠페인은 userId + campaignId 등을 업무키로 사용할 수 있다. couponId가 캠페인인지 개별 발급권인지 정의하고, 회차별 발급·1인 N매 한도는 그 자격 범위에 맞춰 제약과 원자적 수량 검증을 설계한다

## 피해야 할 패턴

- 동시성 제어 없이 발급 수량만 체크 — 동시 요청 폭주 시 오버이슈 발생
- 발급 업무키·사용자 한도·원자적 수량 제어 없이 사용자 중복 여부만 선조회

## 검토 체크리스트

- [ ] 선착순 쿠폰 발급 시 오버이슈 방지 로직이 있는가?
- [ ] 발급 자격·회차·사용자 한도에 맞춘 업무키 제약과 원자적 수량 검증이 있는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/coupon.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- coupon
- issuance
- concurrency
- redis
- queue
- oversue
