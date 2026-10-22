# 운영 SLO와 장애 대응: 고객 영향 기준으로 감지하고 복구한다

- id: commerce-ops-slo-incident
- domain: commerce
- category: operations
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

CPU나 예외 수보다 주문 실패율, 결제 불명확 수, 재고 예약 지연처럼 고객 영향 지표를 SLO로 둔다.

## 적용 조건

- commerce 도메인의 operations 기능을 설계하거나 구현한다.

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 판단 근거

이커머스 장애는 매출, 고객 신뢰, 정산 오류로 바로 이어진다.
단순 서버 생존 여부만 보면 결제 웹훅 지연, 예약 만료 실패, 정산 누락 같은 조용한 장애를 놓친다.

## 업무 맥락

이커머스 장애는 매출, 고객 신뢰, 정산 오류로 바로 이어진다.
단순 서버 생존 여부만 보면 결제 웹훅 지연, 예약 만료 실패, 정산 누락 같은 조용한 장애를 놓친다.

## 반드시 지켜야 할 원칙

- 핵심 여정별 SLI를 정의한다: 주문 생성, 결제 승인, 재고 예약, 배송 생성, 정산 완료.
- 알림은 고객 영향과 복구 행동이 있는 조건에 연결한다.
- 장애 대응 후 원인, 영향 범위, 보정 결과를 기록한다.

## 권장 흐름

- 핵심 사용자 여정과 시스템 불변식을 SLI로 정한다.
- SLO와 알림 임계값을 설정한다.
- 장애 발생 시 runbook에 따라 차단, 재처리, 보정, 고객 안내를 수행한다.
- 사후 분석에서 재발 방지 액션을 추적한다.

## 기술 구현 참고

- Micrometer 지표에 uncertain payments, expired reservations backlog, settlement mismatch count를 노출한다.
- 대시보드는 도메인별 상태와 최근 배치 지연을 함께 보여준다.
- runbook에는 담당자, 확인 쿼리, 재처리 명령, 고객 영향 판단 기준을 포함한다.

## 실패 시나리오

- 서버는 정상인데 웹훅 큐가 쌓여 결제 완료 주문이 멈춘다.
- 알림이 너무 많아 실제 정산 불일치 알림을 놓친다.
- 장애 후 어떤 주문을 보정했는지 감사할 수 없다.

## 검토 체크리스트

- [ ] 도메인별 고객 영향 SLI/SLO가 정의되어 있는가?
- [ ] 알림에 명확한 runbook과 담당자가 연결되어 있는가?
- [ ] 장애 보정 결과와 영향 범위가 기록되는가?

## 출처

### 프로젝트 관리 지식 — 외부 근거 미첨부

- source: src/main/resources/knowledge/commerce.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

## 태그

- operations
- slo
- incident
- runbook
- metrics
- reconciliation
