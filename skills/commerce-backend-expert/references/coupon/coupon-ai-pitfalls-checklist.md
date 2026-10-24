# 쿠폰·프로모션 구현 체크리스트

- id: coupon-ai-pitfalls-checklist
- domain: coupon
- category: checklist
- severity: info
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

쿠폰/프로모션 구현 완료 후 반드시 점검할 체크리스트

## 적용 조건

- coupon 도메인의 checklist 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 검토 체크리스트

- [ ] 선택한 발급 모델에서 총 수량·사용자 한도·중복 발급을 원자적으로 제어하는가?
- [ ] Redis+DB 모델이라면 영속 attempt와 대사·멱등 복구 경로가 있는가?
- [ ] Lua를 사용하면 오류 전 쓰기의 자동 롤백을 가정하지 않고 사전 검증·부분 반영 대사를 하는가?
- [ ] 쿠폰 유효 기간을 서버 시간 기준으로 검증하는가?
- [ ] 쿠폰 적용 대상 조건(카테고리/상품/최소금액)을 검증하는가?
- [ ] 쿠폰 중복 사용 방지 (상태 USED 확인)가 있는가?
- [ ] 쿠폰 상태 업데이트 시 동시성 제어(낙관락/CAS)가 있는가?
- [ ] 정률 할인의 최대 할인 금액 캡(cap)이 처리됐는가?
- [ ] 복수 쿠폰 적용 순서와 정책 버전을 주문 시점에 저장하는가?
- [ ] 선착순 쿠폰 발급 시 오버이슈 방지 로직이 있는가?
- [ ] 발급 자격·회차·사용자 한도에 맞춘 업무키 제약과 원자적 수량 검증이 있는가?
- [ ] 부분 취소 시 배부 스냅샷과 혜택 유지·회수 정책으로 할인액을 재현하는가?
- [ ] 프로모션 중복 적용 시 최대 할인 한도가 설정됐는가?

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

- checklist
- coupon
- promotion
- pitfalls
- review

## 검색 표현

- 쿠폰 체크리스트
- 쿠폰 점검표
- coupon checklist
