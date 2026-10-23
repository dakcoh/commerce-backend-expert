# 정산 데이터 정합성 검증

- id: settlement-integrity
- domain: settlement
- category: integrity
- severity: high
- status: needs-review
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

정산 완료 후 금액·건수 정합성을 검증하고 타임존을 일관되게 적용해야 한다

## 적용 조건

- 판매·환불·공제·보정·지급 원장과 미지급 잔액을 대사한다.

## 적용하지 않는 조건

## 전제

- 정산 거래 단위와 산정 기간·포함 항목·부담 주체를 정의한다.

## 구현 가이드

- 금액 정합성: 매출·할인·배송비·세금·수수료의 포함 항목과 부담 주체를 정의하고 확정액·보정·보류·지급·미지급 잔액을 원장으로 대사한다. 수수료를 공제 합계에도 포함해 두 번 더하지 않는다
- 건수와 중복은 판매자·원 거래 라인·정산 항목·종류 등 거래 단위로 검증한다. 같은 주문의 복수 판매자·부분 정산·환불 보정은 정상적인 여러 레코드일 수 있다
- 누락은 정의한 기준 이벤트와 cutoff의 대상 집합 대비 확정·보류·차기 처리·실패 집합으로 검증하고 각 차이의 사유를 추적한다
- 정산 잔액 대사 예시: 기초 잔액 + 당기 확정액 + 보정액 - 별도 확정 공제 - 성공 지급 누계 = 기말 잔액. 지급 보류·진행 중 이체는 미지급 잔액의 구성으로 추적하고 성공 지급으로 세지 않는다
- 음수 기말 잔액은 회수 채권·차기 상계 등 정책상 잔액으로 구분한다. 지급 보류액을 공제와 미지급 잔액 양쪽에 중복 차감하지 않는다
- 타임존(UTC vs KST)을 서비스 전반에서 일관되게 적용

## 피해야 할 패턴

- 거래 스냅샷·버전·후속 보정 없이 변경 중인 주문 값을 섞어 산정
- UTC/KST 혼용 — 타임존 설정 오류로 정산 기준일 경계값 오차
- 정산 기준일 경계값 처리 오류 (23:59:59 vs 24:00:00)

## 검토 체크리스트

- [ ] 정산 완료 후 금액/건수 정합성 검증 로직이 있는가?
- [ ] 타임존(UTC/KST)이 일관되게 적용됐는가?

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
- integrity
- validation
- timezone
