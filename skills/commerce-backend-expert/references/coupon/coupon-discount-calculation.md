# 쿠폰 할인 금액 계산 — 복잡도 높은 케이스

- id: coupon-discount-calculation
- domain: coupon
- category: calculation
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정률 할인의 cap 처리, 복수 쿠폰 적용 순서, 부분 취소 역산까지 정책을 명확히 정의해야 한다

## 적용 조건

- 정률·정액 쿠폰, 포인트 또는 부분 취소가 주문 할인과 환불 계산에 영향을 준다.

## 적용하지 않는 조건

## 전제

- 할인 순서·배부·반올림·혜택 회수 조건은 주문 시점의 정책 버전과 스냅샷을 따른다.

## 구현 가이드

- 정률 할인 cap(최대 할인 금액) 처리: 예) 20% 할인, 최대 5,000원 → 50,000원 주문 시 할인액 = min(10,000, 5,000) = 5,000원
- 복수 쿠폰 적용 순서: 정률→정액 또는 정액→정률 등 정책에 따라 최종 할인액이 달라진다. 적용 순서와 정책 버전을 주문 스냅샷에 저장한다
- 플랫폼 정책으로 쿠폰 중복 적용 가능 여부 정의 필요
- 쿠폰 + 포인트 병행 사용: 쿠폰 할인 후 잔액에 포인트 적용인지 원금에 적용인지 정책 확인 필수
- 주문 시점에 주문 라인별 할인·부담 주체·반올림 잔차를 배부하고 스냅샷을 저장한다. 배부 합계는 실제 적용한 총 할인액과 일치해야 한다
- 부분 취소는 저장된 배부 결과와 정책으로 역산한다. 최소 주문금액 미달 시 혜택 유지·회수·부분 회수 여부를 정책에 따라 결정하며, 모든 쿠폰에 단순 비례 배부나 자동 회수를 요구하지 않는다

## 피해야 할 패턴

- 정률 할인 cap 처리 누락 — 최대 할인 금액 초과 발생
- 복수 쿠폰 적용 순서 미정의 — 최종 할인액이 정책과 달라짐
- 현재 정책으로 과거 주문을 다시 계산하거나, 혜택 유지 정책인데 최소금액 미달만으로 할인액을 회수

## 검토 체크리스트

- [ ] 정률 할인의 최대 할인 금액 캡(cap)이 처리됐는가?
- [ ] 복수 쿠폰 적용 순서와 정책 버전을 주문 시점에 저장하는가?
- [ ] 부분 취소 시 배부 스냅샷과 혜택 유지·회수 정책으로 할인액을 재현하는가?

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
- discount
- calculation
- partial-cancel
- point
