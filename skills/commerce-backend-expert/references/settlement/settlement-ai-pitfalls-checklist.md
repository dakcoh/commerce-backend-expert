# 정산 구현 체크리스트

- id: settlement-ai-pitfalls-checklist
- domain: settlement
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

정산 구현 완료 후 반드시 점검할 체크리스트

## 적용 조건

- settlement 도메인의 checklist 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

정산 구현 완료 후 반드시 점검할 체크리스트

## 검토 체크리스트

- [ ] 정산 기준일 유형(구매 확정/배송 완료/결제 완료)이 명확히 정의됐는가?
- [ ] 산정 기준일·확정일·예정/실제 지급일과 영업일 조정 정책이 구분되는가?
- [ ] 정산 배치에 멱등성 처리가 있는가? (중복 실행 방지)
- [ ] 대용량 주문 처리 시 페이징이 적용됐는가?
- [ ] 이미 정산·지급된 건의 반품을 원 거래와 연결해 계약상 보정·상계·회수하는가?
- [ ] 쿠폰/프로모션 분담금 비율 계산 로직이 있는가?
- [ ] 정산 공제 후 음수 발생 케이스가 처리됐는가?
- [ ] 정산 완료 후 금액/건수 정합성 검증 로직이 있는가?
- [ ] 타임존(UTC/KST)이 일관되게 적용됐는가?
- [ ] 정산 상태 전이 흐름이 정의됐는가? (UNSETTLED → SETTLED)
- [ ] 정산 명세가 생성 시점의 요율·금액을 스냅샷으로 박제하는가?
- [ ] 정산에 공급가액·부가세가 분리되고 과세·면세·포함/별도 정책이 기록되는가?
- [ ] 원천징수 적용 대상·소득 유형·의무자와 최신 공식 근거를 확인했는가?
- [ ] 반품/클레임/분쟁의 산정 제외와 지급 보류를 계약에 따라 구분하는가?
- [ ] 정산 확정과 실제 이체가 분리되고 지급이 멱등한가? (이중 이체 방지)
- [ ] 실행 ID가 달라도 같은 업무키의 효과를 한 번만 확정하는가?
- [ ] 명세·보정·성공 지급 누계·미지급 잔액을 분할/이월과 중복 공제 없이 대사하는가?
- [ ] 미확정 지급 확보액을 보존하고 동일 시도를 조회한 뒤 확정하는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/settlement.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- checklist
- pitfalls
- settlement
- review

## 검색 표현

- 정산 체크리스트
- 정산 점검표
- settlement checklist
