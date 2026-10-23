# 결제 API 멱등성 키 설계

- id: payment-idempotency
- domain: payment
- category: idempotency
- severity: high
- status: needs-review
- evidenceLevel: external-source
- owner: commerce-context-maintainers
- verifiedBy: not-recorded
- lastReviewedAt: not-recorded
- changeNote: not-recorded
- jurisdiction: KR

## 요약

업무키는 UUID뿐 아니라 날짜·순번 등의 고유 범위가 확보된 식별자도 가능하며, 같은 시도의 재시도에 유지하고 요청 내용을 검증한다. 외부 멱등키는 PG 계약에 맞춰 연결한다

## 적용 조건

- payment 도메인의 idempotency 기능을 설계하거나 구현한다.

## 적용하지 않는 조건

## 전제

- 실제 사업 정책과 외부 사업자 계약을 함께 확인한다.

## 구현 가이드

- 업무키는 같은 논리적 업무를 구분하는 식별자다. UUID·전역 순번 또는 (상점, 업무 종류, 원 업무일자, 순번) 등의 복합키를 사용할 수 있으며, 고유 범위와 저장된 요청 지문으로 업무를 식별한다
- 동일한 논리적 결제 시도의 네트워크 재전송은 영속 저장한 같은 키를 사용해 기존 상태·결과를 재사용한다. 자정이 지나도 원 업무일자를 유지하고 날짜·순번·UUID를 재발급하지 않는다
- 같은 키의 금액·통화·원 주문 등 요청 지문을 대조하고 다른 요청은 거부한다. 금액이나 요청 내용이 같다는 이유만으로 서로 다른 정상 업무를 하나로 합치지 않는다
- 순번이 일자·상점·작업별로 초기화되면 그 범위를 키와 UNIQUE 제약에 포함한다. 날짜만으로도 해당 고유 범위에서 하루 한 업무가 보장된다면 사용할 수 있지만, 같은 날 여러 업무가 있으면 구분자가 더 필요하다
- 내부 업무키와 외부 멱등키는 별개로 관리할 수 있다. PG 계약의 문자·길이·무작위성·고유 범위에 맞는 외부 키를 한 번 생성해 내부 업무키와 영속 매핑하고 재사용한다. 내부 복합키를 모든 PG에 그대로 보낼 수 있다고 단정하지 않는다
- 결제 실패가 확정되어 사용자가 명시적으로 새 결제 시도를 시작할 때만 attempt를 증가시키거나 새 키를 발급한다
- 주문 단위 키 예시: "payment:{orderId}:{attempt}"
- 또는 UUID v4를 논리적 결제 시도 생성 시 한 번 생성해 DB에 저장한다. 요청마다 새 UUID를 생성하는 방식과 구분한다
- 외부 전달 헤더나 필드 이름은 결제사업자의 공식 문서를 따른다
- 같은 키 재요청의 응답과 처리 보장은 결제사업자마다 다르므로 공식 문서의 의미와 보존 기간을 확인한다
- 키 보존 기간은 PG사 중복 요청 보장 기간과 내부 재시도·분쟁 조회 기간을 기준으로 정한다
- 외부 키의 보존 기간이 끝나도 내부 업무키·원 거래 이력을 대사한다. 결과가 미확정이면 새 외부 키를 만들어 같은 결제를 재승인하지 않는다

## 피해야 할 패턴

- 응답이 불명확한데 새 키로 재요청 — 기존 결제가 성공한 경우 이중 결제 가능
- 확정 실패와 네트워크 타임아웃을 구분하지 않고 항상 같은 키 또는 항상 새 키를 사용
- 멱등성 키 미사용 — 네트워크 오류로 같은 결제 요청이 2번 전달되면 이중 결제 발생

## 검토 체크리스트

- [ ] 동일 결제 시도의 재전송과 명시적인 새 결제 시도를 구분하는가?
- [ ] 고유 범위가 확보된 원 업무일자·순번·UUID 등의 업무키를 재시도에도 유지하고 같은 키의 다른 요청을 거부하는가?
- [ ] 내부 업무키와 PG 계약에 맞는 외부 멱등키의 매핑을 영속 보관하는가?

## 출처

### AWS Builders' Library — Making retries safe with idempotent APIs

- source: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
- type: official-documentation
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: 2026-10-21
- note: 호출자 범위의 요청 식별·파라미터 대조·원자적 반영에 관한 설계 참고다. 특정 키 형식을 모든 PG의 계약으로 일반화하지 않는다.

### 토스페이먼츠 API — 인증 및 기타 헤더 설정

- source: https://docs.tosspayments.com/reference/using-api/authorization
- type: official-documentation
- sourceVersion: not-recorded
- publishedAt: not-recorded
- reviewedAt: not-recorded
- accessedAt: 2026-10-21
- note: 토스페이먼츠의 인증·멱등키 규격 확인용 예시다. 무작위 고유값 권고와 보장 범위·기간은 해당 사업자의 계약이며 다른 PG나 내부 업무키의 공통 규격이 아니다.

## 태그

- idempotency
- payment-key
- retry
- pg

## 검색 표현

- 결제 업무키
- 결제 복합키
- 결제 일자 순번
- 결제 날짜 seq
