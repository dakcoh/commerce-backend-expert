---
name: commerce-backend-expert
description: 한국 이커머스 백엔드의 설계·구현·리팩터링·리뷰·장애 분석. 주문·재고·결제·환불·쿠폰·정산·회원·배송의 정합성과 Java/Spring 구현에 사용한다. 일반 코딩·화면 스타일·마케팅·MCP 설치 문의에는 적용하지 않는다.
license: MIT
metadata:
  author: dakcoh
  tags: ecommerce, korean-commerce, backend, java, spring, payments, inventory, settlement
---

# 이커머스 백엔드 개발

사용자 지시와 기존 계약을 우선한다. 실제 코드·업무 조건으로 설계·구현·리팩터링·리뷰·장애 분석을 수행하며 리뷰 요청을 코드 수정이나 운영 결제·환불 실행으로 확대하지 않는다.

## 코드와 필요한 근거만 확인

- 호출자 → 실제 분기·조기 반환 → 서비스·SQL/제약 → 외부 연동·이벤트·관련 테스트를 필요한 범위까지 추적한다. 다른 경로에 있는 검증·트랜잭션·멱등 처리를 누락으로 단정하지 않는다.
- 주문·라인/수량·개별 시도와 업무키/요청 지문, 금액·허용 전이·확정/미확정 상태를 구분한다. 미제공 계약·정책은 추정하지 말고 결론을 바꾸는 조건만 확인한다.
- 주제가 아래 직접 링크와 맞으면 해당 규칙부터 읽는다. 경로를 모를 때만 색인에서 선택한다. 조건·예외·전제·실패 복구와 근거를 읽고 적용하며, 이미 문맥에 있는 내용은 다시 읽지 않는다. 추가 조회는 판단에 필요한 경계만 확장하고 전체 파트를 로딩하지 않는다.

OpenClaw: use the skill directory supplied as `{baseDir}` for file reads. For example, read `{baseDir}/references/coupon/INDEX.md`, never `references/coupon/INDEX.md` relative to the project workspace. In other clients, resolve links against the directory containing this SKILL.md.

| 주제 | 직접 읽을 규칙 |
|---|---|
| 승인 응답 유실·미확정 결제 | [조회·대사](references/payment/network-cancellation.md) |
| 부분 환불·수량 점유 | [부분 환불](references/payment/partial-refund.md) |
| 웹훅 응답·내구성 | [웹훅](references/payment/webhook-handling.md) |
| 쿠폰 발급·재전달·한도 | [발급 정합성](references/coupon/coupon-issuance.md) |
| 락·업무키·저장소 방어 | [동시성·멱등성](references/spring-commerce/spring-commerce-locking-idempotency.md) |
| 트랜잭션 실패 뒤 재시도 | [재시도 경계](references/spring-commerce/spring-resilience-retry-timeout.md) |

그 밖의 색인: [상품·주문·회원·배송](references/commerce/INDEX.md) · [재고](references/inventory/INDEX.md) · [결제](references/payment/INDEX.md) · [쿠폰](references/coupon/INDEX.md) · [정산](references/settlement/INDEX.md) · [Java/Spring](references/spring-commerce/INDEX.md).

## 적용과 결과

- `status`·`evidenceLevel`·검토자/날짜와 출처 범위를 확인한다. `active`는 인증이 아니며 `needs-review`·`not-recorded`는 완료로 바꾸지 않는다. 과거 YAML 경로는 이관 출처다. 읽기 실패·미확인 조건을 검증된 근거로 쓰지 않는다.
- 기존 스택과 공통 처리를 활용하고 금액 산식·업무키·트랜잭션·부수 효과 순서를 보존한다. 구현 요청은 변경과 필요한 검증으로 완성한다. 미확정 거래를 새 승인·중복 보상으로 덮지 않으며 스킬 때문에 Java 버전을 올리지 않는다.
- 결과는 확인된 변경/결함부터 코드 위치·발생 조건·영향·근거·최소 수정 방향으로 전달한다. 사실·추가 확인과 실행한 검사·미검증 범위를 구분한다. 요약·체크리스트를 반복하지 말고 단위/합성 시험을 실제 DB·PG·사업 승인으로 확대하지 않는다.
