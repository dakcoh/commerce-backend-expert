# 쿠폰 유효성 검증 핵심 항목

- id: coupon-validation
- domain: coupon
- category: validation
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

쿠폰 적용 전 유효 기간·사용 조건·중복 사용·발급 대상을 서버 측에서 모두 검증해야 한다

## 적용 조건

- coupon 도메인의 validation 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

쿠폰 적용 전 유효 기간·사용 조건·중복 사용·발급 대상을 서버 측에서 모두 검증해야 한다

## 구현 가이드

- 유효 기간: 발급일 기준 만료 여부 — 서버 시간 기준, 클라이언트 시간 믿지 말 것
- 사용 대상 조건: 특정 카테고리/상품/최소 주문금액 제한 여부 확인
- 중복 사용 여부: 이미 사용된 쿠폰인지 확인 (쿠폰 상태: ISSUED → USED)
- 1인 사용 한도: 동일 쿠폰 코드를 동일 유저가 여러 번 사용하는 시나리오 방어
- 발급 대상 검증: 특정 유저에게만 발급된 쿠폰을 타인이 사용하는 시나리오 방어
- 쿠폰 상태 업데이트 시 낙관락 또는 CAS(Compare-And-Swap) 처리 — 동시 요청으로 중복 사용 방지

## 피해야 할 패턴

- 클라이언트 만료 시간 신뢰 — 서버 시간 기준으로 반드시 재검증
- 동시성 제어 없이 쿠폰 상태 업데이트 — 동시에 같은 쿠폰 적용 요청 시 중복 사용 가능

## 검토 체크리스트

- [ ] 쿠폰 유효 기간을 서버 시간 기준으로 검증하는가?
- [ ] 쿠폰 적용 대상 조건(카테고리/상품/최소금액)을 검증하는가?
- [ ] 쿠폰 중복 사용 방지 (상태 USED 확인)가 있는가?
- [ ] 쿠폰 상태 업데이트 시 동시성 제어(낙관락/CAS)가 있는가?

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
- validation
- expiry
- duplicate-use
- concurrency

## 검색 표현

- 쿠폰 유효성
- 쿠폰 사용 조건
- 쿠폰 중복 사용
- coupon validation
