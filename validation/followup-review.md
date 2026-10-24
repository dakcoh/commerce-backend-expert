# 규칙·클라이언트 후속 검토

2026-10-24, #14·#15의 후속 작업이다. 문서의 적용 조건·구현 가이드·실패 경로·체크리스트·관련 규칙을 함께 읽고 공식 근거의 범위를 비교했다. 19개 규칙 모두 AI 문서 검토자·날짜·미확인 조건을 기록했으며 `needs-review`는 19개 그대로다. 검토 기록을 운영 승인이나 정확성 인증으로 집계하지 않는다.

## 규칙별 결과

아래 경로는 `skills/commerce-backend-expert/references/` 기준이다. 각 규칙의 출처 절에 실제 열람한 URL·버전·접근일과 그 근거가 입증하지 않는 범위를 남겼다.

| 규칙 | 대조·수정한 경계 | 남은 확인 |
|---|---|---|
| payment/duplicate-payment-guard | 활성 시도 선점의 영속 커밋과 외부 승인 중복 방지를 분리 | 실제 PG 멱등 계약·DB 경합 |
| payment/network-cancellation | 외부 요청 전 시도 기록의 커밋, 응답 유실·늦은 승인 대사 | 사업자별 망취소·조회 가능 시점 |
| payment/partial-refund | 주문 총액 외 라인·개별 단위·수량의 진행 중/미확정 점유 명시 | 실제 DB의 원자적 확보·PG 결과 |
| payment/payment-idempotency | 요청 지문, 내부/외부 키, 처리 중·보장 기간 만료 구분 | 실제 오류·만료 뒤 원 거래 조회 |
| payment/payment-status-machine | 내부 UNCERTAIN과 PG 상태 이름·의미 구분 | 지연·역순 이벤트의 실제 전이 |
| payment/webhook-handling | 기존 인증·내구성·짧은 동기 처리 조건을 결제 상태 지침과 교차 검토 | 이벤트별 인증·부하·중단 |
| inventory/concurrency-distributed | RLock·fencing·DB version을 같은 보장으로 취급하지 않도록 수정 | 보호 자원의 오래된 쓰기 거부·Redis 장애 |
| inventory/concurrency-optimistic | flush/commit 충돌, rollback-only 종료 후 새 트랜잭션·컨텍스트 | 실제 JPA provider·DB 경합 |
| inventory/concurrency-pessimistic | 교착상태 위험 감소와 전체 트랜잭션 재시도, timeout 힌트 한계 | 실제 SQL·DB 설정·잠금 범위 |
| coupon/coupon-issuance | 큐 소비자·파티션·재전달에도 업무키·한도·커밋 뒤 ack 필요 | 큐/DB 조합의 중단·재전달 |
| coupon/coupon-issuance-compensation | 최종 DB 원장 커밋과 Redis 선점 유실·보상 대사 구분 | failover·중복 선점·보상 장애 |
| commerce/commerce-loyalty-point-ledger | 잔액 경쟁·원 거래별 복원 한도·이벤트 멱등성 대조 | 만료·복원·회계·법적 성격의 회사 정책 |
| commerce/commerce-security-privacy | 목적 종료 후 파기와 법정 분리 보존, SAD와 카드 데이터·토큰 구분 | 필드별 법적 근거·보존 기간·보안 통제 |
| settlement/settlement-cycle | 업무키·chunk·체크포인트, 페이징 외 스트리밍/커서 허용 | 실제 데이터 변경·중단·재시작 |
| settlement/settlement-integrity | UTC 저장과 업무 타임존 구분, 시작 포함·다음 시작 제외 | 실제 장부·계약상 cutoff·부담 주체 |
| settlement/settlement-payout | 접수/처리 중/성공, 미확정 확보액·이월·세금 이중 공제 대조 | 외부 이체 결과·개별 원천징수 판단 |
| settlement/settlement-tax | 중개 플랫폼을 적용 제외하지 않고 공급·발급·원천징수 역할 검토 | 상품별 과세·의무자·시점의 세무 검토 |
| spring-commerce/spring-commerce-locking-idempotency | 같은 키의 다른 요청 거부, 진행 상태, rollback-only 밖 재시도 | 실제 프록시·트랜잭션·외부 효과 |
| spring-commerce/spring-security-authz | JWT 검증과 리소스 인가, 메서드 보안 활성화 구분 | 실제 역할·테넌트·소유권 정책 |

## 근거를 적용한 범위

[AWS의 멱등 API 설계](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)는 요청 식별과 파라미터 불일치 판단의 참고다. [토스 멱등키 계약](https://docs.tosspayments.com/reference/using-api/authorization), [결제 API](https://docs.tosspayments.com/reference), [지급대행 v2](https://docs.tosspayments.com/guides/v2/payouts)는 해당 사업자 범위로 제한했다. 할인 배부·포인트 복원·정산 대사식은 이 문서들이 인증한 표준 산식으로 설명하지 않는다.

[JPA 3.2](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)의 낙관락·잠금 힌트, [PostgreSQL 18 잠금](https://www.postgresql.org/docs/18/explicit-locking.html)·[제약](https://www.postgresql.org/docs/18/ddl-constraints.html)·[시각](https://www.postgresql.org/docs/18/datatype-datetime.html), [Redis Lua](https://redis.io/docs/latest/develop/programmability/eval-intro/), [Spring 트랜잭션](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html)·[Batch chunk](https://docs.spring.io/spring-batch/reference/step/chunk-oriented-processing.html)를 실제 제품 버전·실패 모델과 구분했다. 예를 들어 Redis의 스크립트 원자성이 DB 커밋까지 확장되지는 않는다.

[개인정보 보호법 제21조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029335641), [부가가치세법 제32조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032154901), [소득세법 제127조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029623555)의 적용 조건을 확인했다. 개별 사업자의 보존 기간·세율·신고 의무를 확정하지 않았다. [PCI FAQ 1154](https://www.pcisecuritystandards.org/faqs/1154/)의 SAD 범위를 모든 PG 식별자·토큰과 동일시하지 않았고, [JWT 검증](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html)과 [서비스 인가](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)도 분리했다.

## 인증 없는 클라이언트 확인

사용자 선택에 따라 외부 로그인·API 키·실제 모델 호출 없이 시험한다. 모델의 자동 선택·CSS 비선택·실제 문서 적용 품질은 이번 검증의 합격 수치에 넣지 않는다. 기존 2026-10-23 모델 평가도 이번 규칙 본문 변경 후 다시 실행한 결과로 집계하지 않는다.

Windows x64·OpenClaw 2026.10.6 (`fe06181`)·Node.js 24.22.1에서 별도 상태/설정/작업 폴더를 사용했다. `skills.load.extraDirs`로 대표 단독·리뷰 단독·동시 설치를 구분하고, 두 스킬의 `eligible`, `modelVisible`, `commandVisible`, `userInvocable`과 실제 SKILL.md 경로·배포 파일 내용을 비교했다. 매핑 제거 후 목록에서도 사라지는지 검사했다. 리뷰 단독 설치는 형제 폴더·추가 다운로드가 필요하지 않았다.

같은 소스의 런타임 복사본을 `plugins install --link`로 설치하면 Codex 형식 번들로 로딩되고 두 스킬을 발견한다. 외부 형식 훅은 감지해도 실행하지 않아 `hookCount`는 0이다. 제거 후 플러그인·스킬 목록에서 사라지고 원래 소스가 남는지 검사한다. 재현 명령은 `node scripts/smoke-openclaw.js /absolute/path/to/openclaw/openclaw.mjs`이며 클라이언트 자동 설치·게이트웨이 시작·모델 호출을 포함하지 않는다. 각 설치의 원문과 요약은 무시되는 `output/openclaw-discovery-*`에 남긴다. 이 플래그와 파일 일치는 사용 가능 목록의 증거이며 모델의 실제 선택 증거는 아니다.

[OpenClaw 번들 문서](https://docs.openclaw.ai/plugins/bundles)·[스킬 디렉터리](https://docs.openclaw.ai/tools/skills)·[CLI 발견 명령](https://docs.openclaw.ai/cli/skills)의 범위와 대조했다. 클라이언트 패키지는 `output/`에 `--ignore-scripts`로 준비했으며 평소 사용자 설정·PATH는 바꾸지 않았다.

Windows x64·Cursor CLI 2026.10.22-27dcf5f의 버전·옵션과 `--plugin-dir` 진입을 실행했다. 공식 설치 스크립트에서 확인한 배포 ZIP을 `output/`에 풀어 실행했고 전역 설치는 하지 않았다. 새 `CURSOR_CONFIG_DIR`·`CURSOR_DATA_DIR`와 빈 작업 폴더에서 `--print --mode ask --plugin-dir` 실행은 인증이 없어 `Authentication required`로 종료됐다. 따라서 실제 플러그인·규칙 발견을 통과로 기록하지 않는다. [Cursor 플러그인 형식](https://cursor.com/docs/reference/plugins)의 저장소 형식·경로 검사와 실제 클라이언트 검증을 구분하고 #15에서 인증 이후 시험을 계속 추적한다.

## 검증과 남은 범위

`npm run check`·`npm test`는 문서 구조·출처/검토 기록·경계·회귀를 확인한다. 재현 입력과 판정 기준은 [행동 사례](../benchmarks/scenarios.md)에 보강했다. 실제 모델·운영 DB/PG/Redis·개별 세무/개인정보 적용 검증은 수행하지 않았다.

English: All 19 high-risk rules received scoped AI document reviews and retain needs-review. Changes tighten request/transaction boundaries, refund unit limits, queue redelivery, fencing, tax roles, retention, and authorization. OpenClaw discovery is checked without inference; Cursor's unauthenticated run stops before verified discovery. These results do not certify production behavior or model selection.
