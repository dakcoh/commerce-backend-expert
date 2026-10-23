# 재고 예약/확정/복구 단계 분리

- id: stock-reservation
- domain: inventory
- category: lifecycle
- severity: medium
- status: active
- evidenceLevel: project-guidance
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

재고 예약→확정→복구와 DB 조건부 즉시 차감은 선택 가능한 재고 모델이며, 동시 주문과 실패 복구에서 수량을 보존해야 한다

## 적용 조건

- 주문·결제와 재고 확보를 연결하고 실패·취소·만료 시 수량을 조정한다.

## 적용하지 않는 조건

## 전제

- 재고 모델에 따라 수량의 의미와 확보·확정·복구 시점을 먼저 정의한다.

## 구현 가이드

- 예약형 예시 — 예약(Reserve): 주문 요청 시 가용 수량을 원자적으로 확보하고 예약 만료 시각과 상태를 기록한다
- 예약형 예시 — 확정(Confirm): 선택한 확정 시점에 예약 상태와 재고를 같은 로컬 트랜잭션에서 반영한다
- 예약형 예시 — 복구(Release): 결제 실패·취소·만료에 해당하는 예약만 한 번 해제한다
- 즉시 차감형 대안: DB 조건부 UPDATE로 판매 가능 수량을 원자적으로 차감하고, 실패·취소 시 같은 업무에 대한 보상을 한 번만 반영한다
- 결제 타임아웃은 미확정으로 보존하고 인증된 조회·검증된 웹훅으로 원 시도를 대사한다. 이미 커밋된 실제 차감에 한해 확정 실패·취소 등 복구 근거를 확인하고 원 업무키·조건부 상태 전이로 한 번만 복구한다. 응답 유실만으로 재고를 먼저 풀지 않는다
- 예약 만료와 결제 성공이 경합하면 상태 CAS 또는 버전 검증으로 중복 확정·복구를 막고, 늦은 승인 결과는 주문·결제 상태와 대사한다

## 피해야 할 패턴

- 재고 모델의 수량 검증·원자적 확보·실패 보상 없이 애플리케이션 선조회 후 차감
- 예약 컬럼이나 예약 단계의 유무만으로 재고 설계의 안전성을 판단

## 검토 체크리스트

- [ ] 선택한 재고 모델에서 동시 주문에도 판매 가능 수량을 초과하지 않는가?
- [ ] 실패·취소·만료 시 해당 업무의 수량 복구가 한 번만 반영되는가?
- [ ] 미확정 결제를 인증된 조회·검증된 웹훅으로 확인한 뒤 실제 커밋된 차감만 한 번 복구하는가?
- [ ] 예약형이라면 만료와 결제 성공의 경합을 상태 전이와 대사로 처리하는가?

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

- reservation
- lifecycle
- overselling

## 검색 표현

- 예약 해제
- 예약 확정
- 예약 만료
