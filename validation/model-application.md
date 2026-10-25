# 클라이언트 문서 적용과 남은 모델 오류

2026-10-25, #15 후속 검증이다. [입력·조회·답변·판정 기록](results/2026-10-25-model-application.json)은 원문 스트림·소스별 스킬 해시를 보존한다. 내부 추론 텍스트와 인증 정보는 공개하지 않는다. 판정자는 구현을 진행한 Codex AI이며 독립적인 사람 검토·운영 인증이 아니다.

## 지침 변경

- 미확정 환불의 금액·단위 점유, 원 시도 대사, 같은 키·다른 키·업무 단위의 구분을 명시했다. 실제 입력의 분기·조기 반환·상태 쓰기를 추적하고 산식부터 확인한다.
- 리뷰 단독에는 상세 규칙 파일이 없음을 명확히 했다. 제공되지 않은 형제 스킬을 가정하거나 조회 예고·실패를 검증 근거로 쓰지 않는다.
- Cursor 라우팅은 결제·환불 리뷰에서 리뷰 스킬을 우선한다. 대표 스킬의 관련 참조를 읽는 시점·경로·실패 시 한계도 명시했다.

규칙 70개의 내용·검토 상태는 바꾸지 않았다. `active` 51개 / `needs-review` 19개를 유지한다. 지침 보강을 모든 모델의 지침 준수 보장으로 설명하지 않는다.

## Cursor CLI

Windows x64·Node.js 24.22.1·Cursor CLI 2026.10.22-27dcf5f의 인증된 `auto`로 실행했다. 모델 표시는 `Auto`이며 실제 백엔드 ID는 노출되지 않는다. 특정 모델의 고정 품질·비용 비교가 아니다.

| 소스 | 실행 | 확인 |
|---|---|---|
| `4bd0a30` | 대표 쿠폰·리뷰 단독 환불·동시 환불·동시 CSS, 4개 | 실제 스킬/규칙 조회, 리뷰 단독의 형제 스킬 부재, CSS의 정확한 두 값 변경·커머스 비선택 |
| `062b740` | 참조·입력 추적 문구 추가 후 쿠폰·리뷰 단독·동시 환불, 3개 | 실제 반환 조건 추적, `20,008 ≤ 20,009`인 총액 안의 단위 중복·미확정 점유 구분, 요청 지문·추가 확인과 실제 결함 구분 |

각 1회이며 전체 행동 벤치마크나 미사용 대조군 평가가 아니다. 저장소 밖의 별도 작업/데이터 폴더와 전용 로그인 프로필을 사용했다. 인증 파일을 복사하지 않았고 입력·배포 스킬 내용이 유지되는지 검사했다. 성공한 읽기의 실제 경로·반환 내용·행 범위를 파일과 대조했다.

셸·파일 쓰기·웹·외부 MCP 실행은 없었다. 도구 스키마 조회와 최신 동시 리뷰의 세션 내부 TODO 갱신 2회는 파일 쓰기나 하위 에이전트 실행으로 집계하지 않는다. 초기 동시 리뷰의 잘못된 플레이스홀더 읽기 1회는 올바른 경로로 복구됐다. 실패한 읽기를 규칙 조회 성공으로 계산하지 않았다.

단독 리뷰는 상세 규칙을 읽었다고 주장하지 않았다. 동시 리뷰는 실제 읽은 규칙과 코드만 근거로 삼았고, 실제 PG·DB·환불 함수 실행으로 확대하지 않았다. IDE GUI·마켓플레이스 설치/갱신·모든 버전·세션 제어는 별도다. 변경 전 전체 번들 실행도 [이전 Cursor 기록](https://github.com/dakcoh/commerce-backend-expert/issues/15#issuecomment-6398314414)과 구별한다.

## OpenClaw와 Ollama

Windows x64·OpenClaw 2026.10.6·Ollama 0.40.10에서 실제 로컬 가중치로 추론했다. 고정 응답 대역이 아니다. `OLLAMA_NO_CLOUD=1`, context 32,768, seed 42, 생성 상한 4,096을 사용했고 `/api/chat`의 실제 설정을 기록했다. 무관한 bundled/custodian 스킬은 끄고 선택한 commerce 스킬과 읽기 도구만 제공했다.

| 구성 | 실행 수 | 결과 |
|---|---:|---|
| gpt-oss:20b 기본·영문 설명 비교·medium 추론·명시 리뷰 비교 | 6 | 자연어 요청은 스킬을 건너뛰었고 명시 조회 뒤에도 코드·미확정 판단이 틀렸다. 영문 설명만으로 자동 선택이 회복되지 않아 해당 변경은 제외했다. |
| qwen3-coder:30b 기본 구성 | 5 | 제어 표식은 읽었으나 불필요한 문장이 추가됐다. 자동 스킬 조회는 관찰됐지만 상세 규칙 미조회·코드 오독이 남았다. CSS는 도구 호출 JSON을 답변으로 반환했다. |
| qwen3-coder:30b 참조·입력 추적 문구 보강 | 3 | 스킬을 읽었지만 규칙 조회·미확정 판단은 충분히 개선되지 않았다. 환불을 실패/재처리로 취급하거나 결함을 정상으로 결론 내리는 오류가 남았다. |

14개 실행과 실행하지 않은 구성 3개를 구분한다. 모델·추론 수준·프롬프트 유형이 달라 일반적인 실패율·코드 변경의 통계적 효과로 해석하지 않는다. 모델 digest·실제 옵션은 JSON에 기록했다. 이전 Qwen 9B 등의 탐색은 [앞선 로컬 기록](https://github.com/dakcoh/commerce-backend-expert/issues/15#issuecomment-6398008671)과 구별한다.

CSS 실패에서는 native API의 `message.content`가 최종 답변과 동일한 도구 호출 JSON이고, `tool_calls`와 실제 호출 수는 0이었다. 모델 제안을 실행된 도구로 복구 해석하거나 JSON 본문만으로 도구 실행 성공을 꾸미지 않는다. 이 관찰만으로 원인을 플러그인·Ollama·모델 중 하나로 단정하지 않는다.

**시험한 OpenClaw 로컬 구성은 커머스 문서 적용에 합격하지 못했다.** 설치·발견·문서 전송과 지침 준수는 다르다. Markdown을 명확히 했다는 이유로 #15를 닫거나 지원 범위를 확대하지 않는다. #18의 실제 PG·사업 정책·권한 있는 개인정보/세무 검토도 미완료다.

## 재현과 검증

Cursor는 새 폴더에 선택한 스킬과 `.cursor-plugin/plugin.json`·라우팅 규칙, 합성 `refund.js` 또는 `index.html`을 복사했다. 로그인 프로필은 CLI가 직접 사용하며 키를 프롬프트에 넣지 않는다.

```text
<cursor-node> <cursor-index.js> --print --mode ask --output-format stream-json --model auto --trust --workspace <work> --plugin-dir <plugin> <prompt>
```

OpenClaw는 별도 state/config/workspace, native `api: ollama`와 loopback baseUrl(no `/v1`)을 사용했다. 프록시는 요청·응답을 변경하지 않고 기록하며 실제 도구 수를 native 요약과 대조했다. 자연어 사례에는 스킬 이름·채점 기준을 넣지 않았고 명시 진단은 따로 표시했다.

```text
node openclaw.mjs agent exec --config <config> --state-dir <state> --cwd <work> --model ollama/<model> --code-mode direct --thinking <low|medium|off> --timeout 360 --json --message-file <prompt-file>
```

문서 검사와 오프라인 테스트 37개, 두 스킬의 Skill Creator frontmatter 검사가 통과했다. CI의 OS 3종 × Node 2종 결과는 PR에서 같은 HEAD 기준으로 확인한다. 모델 호출은 CI에 포함하지 않는다. 시험 서버·프로세스를 종료하고 포트 닫힘을 확인했으며 가중치·원문은 무시되는 `output/`에 보관한다. 평소 설정·PATH·기존 태그는 유지한다.

English: Review instructions clarify uncertain refund reservations, concrete branch tracing, and standalone resource availability. Authenticated Cursor CLI checks cover actual reads and exact CSS preservation. Fourteen bounded OpenClaw/Ollama trials retain application failures despite discovery/skill delivery. No production or general model-quality certification is implied; #15 and #18 remain open.
