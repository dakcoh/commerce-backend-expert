# 정산 세무 처리 — 부가세·원천징수·면세 구분

- id: settlement-tax
- domain: settlement
- category: tax
- severity: high
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정산 세무 데이터는 상품 과세 유형과 거래 당사자 관계를 분리 기록하되 실제 신고·발행·원천징수 기준은 최신 법령과 세무 검토로 확정한다

## 적용 조건

- 국내 셀러 정산에서 과세·면세·수수료·지급액을 계산하거나 세무 자료를 생성한다.

## 적용하지 않는 조건

- 플랫폼이 판매 당사자가 아니거나 정산·세금계산서 책임이 계약상 다른 주체에 있는 경우 세부 처리 방식이 달라질 수 있다.

## 전제

- 국세청 최신 안내, 거래 구조, 셀러 사업자 유형과 세무 전문가 검토를 기준으로 확정한다.

## 구현 가이드

- 공급가액·부가세·면세 금액을 분리 저장하고 계산에 사용한 tax_type과 세율 버전을 스냅샷으로 남긴다
- 상품의 과세·면세 판정은 단순 카테고리 예시가 아니라 관리되는 세무 정책과 최신 법령을 기준으로 한다
- 세금계산서 발행 주체·시점·합산 방식·역발행 여부는 거래 구조와 계약을 기준으로 정의한다
- 원천징수 대상과 세율을 개인 여부만으로 단정하지 않고 소득 유형·사업자 지위·최신 세법을 확인한다
- 중개수수료의 과세 대상·포함/별도 가격·증빙 발행 주체는 거래 구조와 최신 세무 검토로 정하고 수수료와 부가세를 중복 공제하지 않는다
- 세무 자료의 보존 기간과 원본성 요건은 최신 법정 기준으로 관리하고 정책 버전과 적용 기간을 기록한다

## 피해야 할 패턴

- 부가세 포함/별도를 혼동 — 공급가액 기준 수수료 계산과 결제금액 기준 계산이 섞이면 정산액 오차
- 면세 상품에 부가세를 부과하거나, 과세 상품의 부가세를 누락
- 개인 셀러라는 이유만으로 원천징수하거나 원천징수 적용 대상 소득을 누락 — 소득 유형·지위·최신 근거 없이 판단
- 거래 구조 검토 없이 세금계산서 발행 시점을 정산 확정 또는 결제 시점으로 일괄 고정

## 검토 체크리스트

- [ ] 정산에 공급가액과 부가세가 분리 기록되는가?
- [ ] 면세/과세 상품 구분이 정산 계산에 반영되는가?
- [ ] 원천징수 적용 대상·소득 유형·의무자와 최신 공식 근거를 확인했는가?
- [ ] 세금계산서 발행 주체와 시점이 거래 구조·계약·최신 세법에 근거하는가?

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

- settlement
- tax
- vat
- withholding
- tax-invoice
- exemption
