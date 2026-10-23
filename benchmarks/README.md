# 행동 평가 / Behavior evaluation

이 평가는 **현재 SKILL.md 전체를 명시적으로 제공했을 때의 적용**을 확인한다. 스킬 선택·훅·미사용 대비 성능을 평가하지 않는다. 실제 DB·PG·Redis와 네트워크 업무는 실행하지 않는다.

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

`output/behavior-eval-*`에 실제 모델·설정, 제공한 스킬의 SHA-256, 추가로 읽은 문서의 경로·SHA-256, 거부된 읽기 횟수, 답변과 클라이언트 오류가 남는다. 스킬 본문은 developer instructions로 직접 전달하므로 SKILL.md의 별도 읽기 이벤트가 없어도 되며, 자동 발견 성공으로 집계하지 않는다. 실패·중단은 성공으로 처리하지 않는다. 완료 상태 이후에도 답변을 판정 기준으로 별도 검토해야 한다.

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

| 사례 | 확인 |
|---|---|
| `refund-overlap` | 단독 리뷰 스킬로 중복 단위·미확정 점유·요청 지문 구분. 추가 읽기 2건은 거부됐고 상세 규칙 조회 성공으로 집계하지 않음 |
| `webhook-async` | 202·상위 검증·inbox에 근거 없는 결함 지적 없음 |
| `webhook-sync` | 안전한 동기 처리에 큐·워커 강제 없음 |
| `lock-watchdog` | watchdog·version 조건 인정, 재고 색인과 관련 규칙 2개 실제 조회 |
| `frontend-scope` | HTML 두 값만 변경됨을 원본과 비교, 커머스 상세 규칙 미조회 |

설계 참고: [OpenAI App Server](https://learn.chatgpt.com/docs/app-server), [스킬 평가 안내](https://developers.openai.com/blog/eval-skills).

English: Run the command with an authenticated Codex CLI and a supported model. The runner explicitly supplies the exact selected SKILL.md as developer instructions in a temporary read-only thread. It records hashes, actual reads, answers, and failures. This is not automatic discovery, a no-skill comparison, or live DB/PG validation. Model usage is charged to the configured account; CI runs only offline tests. Review completed answers manually before recording a pass.
