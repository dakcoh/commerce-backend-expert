# 재고 구현 체크리스트

- id: ai-pitfalls-checklist
- domain: inventory
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

재고 구현 완료 후 반드시 점검할 체크리스트

## 적용 조건

- inventory 도메인의 checklist 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

재고 구현 완료 후 반드시 점검할 체크리스트

## 검토 체크리스트

- [ ] 선택한 재고 모델에서 동시 주문에도 판매 가능 수량을 초과하지 않는가?
- [ ] 선택한 재고 모델에서 수량의 의미와 확보·확정·복구 시점이 일관되는가?
- [ ] 실패·취소·만료 시 해당 업무의 수량 복구가 한 번만 반영되는가?
- [ ] 동시 요청에 DB 조건부 갱신·제약 또는 적절한 락 등 동시성 제어가 적용됐는가?
- [ ] 재고 차감 API에 멱등성 키가 적용됐는가?
- [ ] 비관락 사용 시 타임아웃 설정과 데드락 방어가 있는가?
- [ ] 분산락 사용 시 TTL이 설정됐는가?
- [ ] 여러 로컬 트랜잭션에 걸친 작업이라면 멱등 보상·재시도·대사 경로가 있는가?
- [ ] 재고 부족 시 적절한 예외 처리와 메시지가 있는가?

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

- checklist
- pitfalls
- review

## 검색 표현

- 재고 체크리스트
- 재고 점검표
- inventory checklist
