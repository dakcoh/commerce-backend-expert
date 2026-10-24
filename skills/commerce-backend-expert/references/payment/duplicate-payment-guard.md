# 중복 결제 방어

- id: duplicate-payment-guard
- domain: payment
- category: duplicate
- severity: high
- status: needs-review
- evidenceLevel: external-source
- owner: commerce-context-maintainers
- verifiedBy: Codex (AI 문서 검토)
- lastReviewedAt: 2026-10-24
- changeNote: 활성 시도 선점의 영속 커밋과 외부 중복 방지의 범위를 검토했다. 실제 PG·DB 경합은 미검증이다.
- jurisdiction: KR

## 요약

결제 버튼 중복 클릭·네트워크 재시도로 인한 이중 결제를 상태·시도 식별자·외부 거래 ID·동시성 제어로 다층 방어한다

## 적용 조건

- 외부 결제 승인 요청이 사용자 중복 동작이나 네트워크 재시도로 다시 전송될 수 있다.

## 적용하지 않는 조건

- 결제 수단이나 사업자 계약이 별도의 중복 방지·승인 확정 절차만 허용하면 해당 계약을 우선한다.

## 전제

- 멱등성 키의 지원 여부, 전달 위치와 보장 기간은 사용하는 결제사업자의 최신 공식 문서로 확인한다.

## 구현 가이드

- 외부 승인 전 주문의 결제 가능 상태와 활성 결제 시도를 짧은 DB 트랜잭션의 조건부 갱신·UNIQUE 등으로 원자적 선점하고 영속 커밋한다. 선조회 후 승인하거나 승인 후 낙관락만 검사해서는 외부 이중 승인을 막지 못한다
- 결제사업자가 멱등성 기능을 제공하면 공식 계약의 헤더·필드와 재사용 규칙에 따라 같은 논리적 시도에 같은 키를 전달한다
- 외부 멱등성 기능이 없더라도 내부 결제 시도 ID와 상태 전이 가드로 동일 시도의 중복 실행을 차단한다
- 결제 시도에 금액·통화·수단 등 요청 지문과 결과를 저장한다. 같은 키의 다른 요청은 거부하고 처리 중·미확정이면 새 승인을 보내기 전에 기존 결과를 조회한다
- PG 거래 ID는 상점·사업자별 고유 범위에 맞는 DB UNIQUE 제약으로 저장한다. 중복 선조회만으로 동시 삽입을 방어하지 않는다
- 낙관락(@Version) 또는 CAS는 내부 상태 전이를 보호한다. 외부 멱등성 지원이 없으면 미확정 요청을 자동 재승인하지 않고 사업자 조회·대사로 확인한다
- 승인·취소 결과는 인증된 조회·검증된 웹훅으로 확인한다. 중복 승인 보상도 원 거래에 연결한 별도 업무로 영속 선점하고, 같은 보상의 재시도는 동일 키로 멱등하게 처리한다. 보상 결과가 미확정이면 조회·대사하고 새 키로 취소·환불을 반복하지 않는다

## 피해야 할 패턴

- 주문 상태 검증 없이 결제 요청 — 이미 결제된 주문에 중복 결제 발생
- 결제사업자의 중복 방지 계약과 내부 상태 가드가 모두 없음 — 네트워크 재시도 시 실제 결제 중복 가능

## 검토 체크리스트

- [ ] 외부 승인 전 결제 가능한 주문의 활성 시도를 원자적으로 선점하는가?
- [ ] 결제사업자가 제공하는 멱등성 기능의 전달 방식과 보장 범위를 공식 문서로 확인했는가?
- [ ] 동시 결제 요청에 낙관락(@Version) 또는 상태 CAS 처리가 있는가?
- [ ] 같은 키의 요청 지문을 대조해 다른 요청을 거부하고, 승인뿐 아니라 취소·보상도 멱등하게 처리하는가?

## 출처

### 프로젝트 관리 지식 — 이관 출처

- source: src/main/resources/knowledge/payment.yml
- type: project-guidance
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: not-recorded
- note: 프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다.

### AWS Builders Library — Idempotent APIs

- source: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
- type: official-documentation
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: 요청 식별·파라미터 불일치·재시도의 설계 참고다. 회사 정책이나 특정 PG 보장을 입증하지 않는다.

### 토스페이먼츠 — 멱등키 헤더

- source: https://docs.tosspayments.com/reference/using-api/authorization
- type: official-documentation
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: 토스의 키 규격·유효기간·요청 범위 참고다. 내부 업무키와 미확정 거래 대사는 별도 설계다.

### PostgreSQL — Constraints

- source: https://www.postgresql.org/docs/18/ddl-constraints.html
- type: official-documentation
- sourceVersion: 18
- publishedAt: not-recorded
- reviewedAt: 2026-10-24
- accessedAt: 2026-10-24
- note: UNIQUE·CHECK 등 DB 제약의 기술적 범위만 참고한다. 업무키 설계·회계 정책이나 운영 DB 검증은 별도다.

## 태그

- duplicate
- idempotency
- optimistic-lock
- payment-status

## 검색 표현

- 이중 결제
- 두 번 결제
- 결제 두번
- 돈이 두 번 빠짐
- double payment
- 중복 승인
