# 행동 평가 / Behavior evaluation

이 평가는 **현재 SKILL.md 전체를 명시적으로 제공했을 때의 적용**을 확인한다. 반복 비교 모드에서는 같은 모델의 미사용 대조군도 실행한다. 자동 스킬 선택·훅·클라이언트 설치 전체의 성능과 실제 DB·PG·Redis 업무는 평가하지 않는다.

[미사용 대비 48회 비교 수치와 해석](comparison-2026-10-26.md) · [정책 구분 수정 후 회귀](results/2026-10-26-policy-followup.json). 실제 호출·실패·미실행과 실행 당시의 소스·기준을 구분한다.

[원문/압축본 비교와 채택 결정](token-optimization-2026-10-26.md)은 별도 실험이다. 대표 스킬은 압축본을 채택했고 리뷰 압축은 정책 표현의 명확성 때문에 보류했다. 초기 문제 결과와 중단한 진단도 보존한다.

세션 훅의 로컬 기동 비용은 `npm run benchmark:hooks`로 모델 없이 따로 측정한다. 등록 명령과 빈 Node stdin 처리의 30회씩 비교이며, 클라이언트 내부의 실행 대기·모델 시간은 포함하지 않는다.

## 실행

Node.js 24.22.1 LTS와 이미 로그인한 Codex CLI를 사용한다. 모델 호출은 해당 계정의 사용량을 소비하며 CI에서는 실행하지 않는다. `model`에는 계정에서 실제 지원하는 모델을 전달하고, `-`를 전달하면 사용자 기본 모델을 요청한다. 카탈로그에 표시돼도 실제 추론 요청이 거절될 수 있다.

```bash
npm run benchmark -- /absolute/path/to/codex model
```

Windows에서는 첫 번째 인자에 `codex.exe` 경로를 전달한다. 끝에 사례 ID를 지정하면 일부만 실행한다.

```bash
npm run benchmark -- /absolute/path/to/codex model refund-overlap webhook-sync
```

입력은 [cases.json](cases.json), 판정 기준은 [시나리오](scenarios.md), 합성 코드는 [fixtures/](fixtures/)에 있다. 판정 기준은 모델에 전달하지 않는다. 각 사례에는 선택한 스킬 폴더 하나와 필요한 합성 입력만 복사한다.

평가기는 기존 인증을 CLI를 통해 사용하며 인증 파일을 복사하거나 설정을 저장하지 않는다. 임시 스레드·읽기 전용 sandbox를 사용하고, shell·web search와 기존 플러그인에 대해 프로세스 내 비활성 설정을 전달한다. 기본·사용자 지침의 영향을 줄이기 위해 평가용 base/developer instructions를 명시한다. 추가 파일 읽기는 선택한 스킬·입력 디렉터리의 실제 경로와 64KiB 제한으로 검사하며, 쉘·파일 변경·MCP·웹 검색·하위 에이전트 이벤트가 나타나면 실행을 합격 근거로 수용하지 않는다.

두 조건에 동일한 실제 작업 파일 목록을 주며 빈 목록이면 업무 사실은 프롬프트에만 있음을 알린다. 없는 프로젝트 파일을 추정해 탐색하는 비용을 검증 결과와 섞지 않는다. 조회 실패가 8회 누적되면 실행을 실패로 중단하며, 최초 실패 샘플과 시점별 사용량을 보존한다. 이 한도는 평가 전용이며 사용자 프로젝트의 파일 읽기를 제한하는 플러그인 기능이 아니다.

`output/behavior-eval-*`에 실제 모델·설정, 제공한 스킬의 SHA-256, 추가로 읽은 문서의 경로·SHA-256, 거부된 읽기 횟수, 답변과 클라이언트 오류가 남는다. 스킬 본문은 developer instructions로 직접 전달하므로 SKILL.md의 별도 읽기 이벤트가 없어도 되며, 자동 발견 성공으로 집계하지 않는다. 실패·중단은 성공으로 처리하지 않는다. 완료 상태 이후에도 답변을 판정 기준으로 별도 검토해야 한다.

## 미사용 대비 반복 비교

고정 모델 ID를 명시하고 `--compare --repeat=3`을 추가한다. 기본은 8종 × 3회 × 2조건, 총 48회 평가 작업 턴이며 계정 사용량을 소비한다. 한 턴은 여러 provider 요청을 포함할 수 있다. 필요한 사례 ID로 범위를 줄일 수 있다. CI는 모델을 호출하지 않는다.

```bash
npm run benchmark -- /absolute/path/to/codex model --compare --repeat=3
```

각 쌍은 같은 입력·도구·medium 추론 설정을 사용한다. 사례/회차별 사용·미사용 순서를 교차하고 매 실행을 저장소 밖의 새 폴더·임시 스레드에서 시작한다. 미사용 조건에는 스킬 본문·참조 폴더를 제공하지 않는다. 사용 조건에는 선택한 스킬 하나와 해당 참조만 제공한다. 다른 지침 소스와 예상하지 않은 도구 실행은 오류로 기록한다. 모델/인증 등 실패가 두 번 연속 발생하면 추가 호출을 중단한다.

`output/behavior-comparison-*`의 계획에는 소스 커밋·순서와 사전 고정한 [채점 기준](rubric.json)의 해시를 기록한다. 기준은 작업 모델에 전달하지 않는다. 각 실행의 실제 답변을 기준 4개로 검토하고 모두 만족해야 사례 통과로 집계한다. 실패·누락을 분모에서 조용히 제외하지 않는다. 의미 판단은 구현 세션의 AI 검토이며 독립적인 사람 채점이 아니다. CSS 원문 보존은 파일과 직접 비교한다.

원문과 압축 후보를 비교할 때는 `--against`에 원본 저장소 형태의 폴더를 전달한다. 이 폴더에는 `skills/<스킬명>/` 전체가 있어야 하며, 두 조건 모두 스킬 본문과 각자의 참조를 명시적으로 제공한다. 미사용 비교와 혼합하지 않는다.

```bash
npm run benchmark -- /absolute/path/to/codex model --compare --repeat=1 --against=/original/source refund-overlap coupon-redelivery frontend-scope
```

평가기 시작 시 두 스킬 소스와 공통 입력·기준을 새 임시 폴더에 고정한다. 실행 도중 원본 파일이 바뀌어도 고정한 사본을 사용한다. 계획에는 기준/사례 해시와 작업 트리 변경 여부가 남고, 각 실행에는 실제 제공한 본문 해시가 남는다. 모델·추가 지침 소스·예상하지 않은 도구·실패 조건은 기존 비교와 동일하게 검사한다.

홀수 개 사례로 예비 실행한 뒤 나머지를 분리 실행한다면 `--order-offset=1`로 다음 단계의 첫 조건을 뒤집어 전체 선행 순서를 맞출 수 있다. 기본은 `0`이며 `--compare`에서만 사용한다. 최종 기록에는 실제 원문 먼저/후보 먼저 횟수를 함께 보고한다.

자동 측정은 모델 턴 시간(앱 서버 시작 제외), 실제 파일 조회, 입력·캐시 입력·출력 토큰을 구분한다. `measurements.json`은 완료된 실행의 측정 요약이며 정확성 채점은 별도다. 캐시·네트워크·서버 부하와 반복 간 변동을 함께 보고하고, 토큰 수를 금액 절감으로 환산하지 않는다. 계정의 실제 청구 금액은 측정하지 않는다. 작은 합성 표본의 차이를 운영 정확도·전체 개발 생산성으로 확대하지 않는다.

새 실행은 캐시·비캐시 입력 합계와 측정 건수를 따로 남긴다. 비캐시는 `inputTokens - cachedInputTokens`이며 청구 금액이 아니다. 완료 실행 중 값이 누락되거나 캐시 값이 입력을 초과하면 완전한 합계를 `null`로 표시한다. 마지막 값만 저장하던 기록에는 세부 사용량 변화가 없으므로 사후에 실제 provider 요청 수를 복원하지 않는다.

`skillEntryBytes`는 명시 제공 본문의 UTF-8 크기이며 토큰 수가 아니다. `tokenUsageUpdates`에는 앱 서버가 보고한 사용량의 시간별 스냅샷을 보존한다. [OpenAI Docs](https://learn.chatgpt.com/docs/app-server)는 `thread/tokenUsage/updated`를 활성 스레드의 사용량 업데이트로 설명한다. 업데이트 수를 실제 API 요청 수로 해석하지 않는다. 읽기 경로·크기·해시와 함께 확인하되 도구 왕복과 모델 내부 처리의 비용을 임의로 배분하지 않는다.

## 토큰을 줄이면서 검증하기

1. 적용 범위·정책·미확정 상태 같은 핵심 경계는 남기고 진입 본문의 반복 설명부터 줄인다. 필요한 색인/규칙을 선택하며, 관련 없는 작업에 본문을 강제 주입한 시험과 실제 자동 선택 비용은 분리한다.
2. 처음 필요한 색인과 규칙부터 읽고 추가 조회는 결론을 바꾸는 미확인 조건이 있을 때 확장한다. 임의의 파일 수 제한으로 근거를 잘라내지 않는다. 일반 지침·체크리스트·결론을 답변에서 반복하지 않는다.
3. 형식·링크·독립 설치·회귀 테스트를 먼저 실행한 뒤, 변경한 업무와 무결함/범위 밖 대조군으로 소수의 원문/후보 비교를 수행한다. 이 단계에서 중요한 오판이 나오면 추가 모델 호출을 멈추고 수정한다. 통과한 후보의 최종 비교에서만 반복 범위를 넓힌다.
4. 원문/후보·모델·입력·기준 해시와 요청 순서를 사전에 고정한다. 같은 사례의 총 입력·비캐시 입력·출력·도구 조회를 함께 비교하며, 새 실패를 기존 기준 밖이라는 이유로 무시하지 않는다. 미확정 상태 해제·Lua 롤백·미제공 권리 정책 단정과 같은 중대한 오류는 따로 검토한다.
5. 정상/결함 사례를 함께 두고 오탐·미탐을 구분한다. HTML 보존·업무 산식·상태 전이처럼 실행 가능한 판정은 실제 비교/테스트로 확인한다. 의미 판정은 독립 검토 여부를 밝히고, 가능하면 원문/후보의 표시와 순서를 가려 검토한다. 작은 표본으로 품질 동등성이나 절감률을 확정하지 않는다.

본문 크기 축소는 최적화 후보일 뿐이다. 실제 토큰 감소와 핵심 판단의 유지가 함께 확인되기 전에는 절감 성공으로 표시하지 않는다. 이 절차를 추가한 것 자체는 압축 후보의 모델 검증 결과가 아니다.

후속 `benefit-policy`·`lua-partial-write`·`refund-no-defect`·`coupon-multi-grant` 사례는 기본 8종에 자동 합산하지 않는다. 명시적으로 선택해 권리 정책, Lua 부분 반영, 정상 환불의 오탐과 사용자별 복수 발급을 확인한다. `rubric.json` v3는 네 기준 외에도 제공 사실/읽은 지침과 모순되는 중대한 오류를 별도로 거부한다. 앞선 비교는 당시 v1/v2의 해시와 기준을 보존하며 소급 채점하지 않는다.

```bash
npm run benchmark -- /absolute/path/to/codex model --compare --repeat=3 refund-overlap benefit-policy
```

## 확인할 결과

| 사례 | 핵심 판정 |
|---|---|
| `refund-overlap` | 주문 전체 한도 안의 중복 단위 환불·미확정 점유와 요청 지문을 구분한다. 실제 PG 피해나 DB 경합을 실행했다고 쓰지 않는다. |
| `webhook-async` | 계약상 202·제공된 상위 검증·영속 inbox를 결함으로 만들지 않는다. |
| `webhook-sync` | 안전한 짧은 동기 웹훅에 큐·워커를 일괄 요구하지 않는다. |
| `lock-watchdog` | 명시적 leaseTime 없이 watchdog을 쓰는 사실만으로 영구 락이라고 판단하지 않는다. |
| `frontend-scope` | padding·gap 두 값만 바꾼 HTML을 제시하고 커머스 상세 규칙을 읽지 않는다. |

## 공개 기록

2026-10-23, Codex CLI 0.153.2·gpt-6-astra·medium에서 각 사례를 1회 실행했다. [실행 기록](results/2026-10-23.json) 하나에 입력·모델·해시·실제 조회·답변·검토 사유를 보관한다. 답변을 별도 Markdown 파일로 중복 보관하지 않는다. 결과 검토는 구현을 진행한 같은 Codex 세션에서 수행했고, 독립 채점자·미사용 대조군·반복 실험은 없다. 한 번의 고정 입력 결과를 일반적인 품질 향상·비용 절감으로 확대하지 않는다. 동일 모델·설정에서도 답변은 달라질 수 있다.

이 기록은 당시 소스의 해시를 보존한 결과다. 2026-10-23 실행은 [후속 규칙 수정](../validation/followup-review.md) 전의 결과이며, 아래 5개 통과 수에 다른 날짜의 비교나 [추가 검토 사례](scenarios.md#후속-검토-사례--2026-10-24-기록)를 합산하지 않는다.

| 사례 | 확인 |
|---|---|
| `refund-overlap` | 단독 리뷰 스킬로 중복 단위·미확정 점유·요청 지문 구분. 추가 읽기 2건은 거부됐고 상세 규칙 조회 성공으로 집계하지 않음 |
| `webhook-async` | 202·상위 검증·inbox에 근거 없는 결함 지적 없음 |
| `webhook-sync` | 안전한 동기 처리에 큐·워커 강제 없음 |
| `lock-watchdog` | watchdog·version 조건 인정, 재고 색인과 관련 규칙 2개 실제 조회 |
| `frontend-scope` | HTML 두 값만 변경됨을 원본과 비교, 커머스 상세 규칙 미조회 |

설계 참고: [OpenAI App Server](https://learn.chatgpt.com/docs/app-server), [스킬 평가 안내](https://developers.openai.com/blog/eval-skills).

English: The runner explicitly supplies SKILL.md in fresh read-only threads. Use `--compare` for skill/no-skill pairs or add `--against=/original/source` for original/candidate pairs. Both arms receive the same complete task-file inventory; eight unavailable calls abort a task. The default eight cases and four optional follow-ups remain separate. Sources and criteria are frozen before inference, with actual reads, answers, failures, usage snapshots and order recorded. Task turns are not provider-request counts. Automatic discovery, full plugin hooks and production behavior remain separate. Usage consumes account allowance; CI is offline. Review the full answers and critical policy boundaries, not just checklist scores.
