---
name: commerce-review
description: 한국 이커머스 결제·환불 코드와 변경 사항을 리뷰한다. 웹훅, 멱등성, 미확정 거래, 할인 배부와 재고 보상의 정합성을 호출 경로까지 추적할 때 사용한다. 구현 요청·일반 화면 수정에는 적용하지 않는다.
license: MIT
metadata:
  author: dakcoh
  tags: ecommerce, korean-commerce, code-review, payments, refunds, idempotency
---

# 결제·환불 코드 리뷰

요청한 코드·diff의 범위를 확인하고 실제 결함과 추가 확인 조건을 구분한다. 리뷰 요청만으로 코드를 수정하거나 운영 결제·환불을 실행하지 않는다.

Before claiming a defect, trace the supplied input through the actual predicates, early returns and state writes. Distinguish same-key retries, different-key requests and overlapping business units. Compute totals before claiming that an amount limit is exceeded.

For refunds, both amount and line/unit/quantity limits include succeeded refunds and reservations held by processing or unknown attempts. Pending/unknown status never permits an overlapping claim and is not proof of success. Release a reservation only after definitive failure; reconcile an unknown outcome before replacing its attempt. An unchanged retry preserves the original key and request fingerprint.

## 코드와 계약을 함께 추적

1. 변경 코드에서 호출자 → 서비스 → SQL·제약 → PG 연동·이벤트·워커와 테스트를 필요한 범위까지 읽는다. 상위 경로의 검증·영속 수신·트랜잭션을 확인하기 전에 누락으로 판정하지 않는다.
2. 업무키의 고유 범위와 요청 지문, 처리 단위, 허용 상태 전이, 성공 확정 근거를 확인한다. 타임아웃·응답 유실을 실패로 확정하지 않는다.
3. 금액·통화·수량의 한도를 주문 전체와 라인·개별 단위에서 확인한다. 동시 요청과 처리 중·미확정 금액의 점유, 원자적 확보, 실패 확정 후 해제를 함께 검토한다.
4. 외부 승인·환불과 로컬 저장 사이의 실패 구간을 추적한다. 원 거래 조회·통지·대사, 같은 시도의 키 유지, 재고·쿠폰·포인트의 중복 복원 방어를 확인한다. 실제 계약이 없는 보장이나 기술을 가정하지 않는다.

## 업무 경계에서 확인할 것

- **부분 환불:** 주문 전체 한도 안에서도 같은 라인·수량이 두 번 환불될 수 있다. 확정·처리 중·미확정 환불이 점유한 금액과 대상을 함께 확인한다. 할인 배부·반올림 잔차·혜택 유지/회수는 주문 당시 스냅샷과 정책으로 재현하며 새 정책으로 소급 계산하지 않는다.
- **웹훅:** PG·이벤트별 인증, 허용된 성공 응답, 응답 전 내구성 있는 반영, 중복·역순 처리를 확인한다. 짧은 DB 트랜잭션으로 안전하게 끝나는 동기 처리는 허용한다. 느린 외부 호출·긴 후처리만 응답 경계에서 분리하며 큐·워커의 존재 자체를 필수로 판단하지 않는다.
- **재고·혜택 복원:** 미확정 결제를 실패로 보고 먼저 복구하지 않는다. 확정된 취소·환불의 대상과 원 업무를 연결해 한 번 반영하고, 반품 검수 전 재고와 출고 전 확보 수량의 해제를 구별한다.
- **Spring·저장소:** 원자적 선점·한도 검증·업무키 제약의 커밋 경계를 확인한다. 외부 PG 효과가 로컬 롤백으로 취소된다고 가정하지 않으며, 락은 실제 범위·획득 성공·해제·만료 후 쓰기까지 검토한다.

이 스킬은 단독 설치로 위 절차를 수행하며 상세 규칙 파일을 포함하지 않는다. 단독 설치에서는 이 파일과 제공된 코드로 리뷰한다. 환경에 `commerce-backend-expert`가 실제로 제공된 경우에만 필요한 상세 규칙을 해당 스킬의 색인에서 고른다. 형제 폴더의 존재를 가정하거나 문서를 자동 다운로드하지 않는다.

This skill works alone and bundles no detailed-rule files. A planned, failed, or unavailable read is not evidence that a rule was verified.

현재 맥락의 문서를 중복 조회하거나 모든 파트를 로딩하지 않는다. 규칙의 조건·예외·전제와 출처 범위를 읽고 실제 코드·PG 계약에 적용되는지 판단한다. `active`는 정확성 인증이 아니며 `needs-review`·검토자/검토일 미기록을 검토 완료로 설명하지 않는다.

## 결론과 확인 방법

- 확인된 결함부터 영향도 순으로 설명한다. 코드 위치, 발생 조건·입력 또는 동시 실행 순서, 잘못되는 금액·상태·효과, 최소 수정 방향과 검증 방법을 연결한다.
- 결함마다 코드·계약에서 확인한 근거를 제시하고, 실제로 읽은 상세 규칙이 있으면 함께 연결한다. 읽지 않은 규칙 ID를 꾸미거나 키워드 일치만으로 결함을 만들지 않는다.
- 근거가 부족한 위험은 추가 확인으로 분리한다. 정상인 계약상 응답 코드나 제공된 상위 검증을 결함으로 바꾸지 않는다. 확정 결함이 없으면 그렇게 설명한다.
- 허용된 로컬 테스트로 확인할 수 있으면 실행하고, 실행하지 않았거나 대역으로만 확인한 범위를 밝힌다. 단위 테스트를 실제 DB 동시성·PG 검증으로 확대하지 않는다.
