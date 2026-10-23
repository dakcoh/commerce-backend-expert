# 기여 가이드

[English](CONTRIBUTING.md) · 한국어

규칙·검증 도구·클라이언트 설정을 수정하는 기여자를 위한 문서입니다. 스킬 사용법은 [README](README.ko.md)를 참고하세요.

[검사 실행](#검증) · [수정할 파일](#수정-위치) · [지식 작성](#지식-작성-규칙) · [세션 훅](#세션-훅) · [편집 훅](#선택적-개발-훅) · [클라이언트 검증 현황](#클라이언트-확인)

## 검증

**준비:** Node.js 22 이상. 의존성 설치와 JDK는 필요하지 않습니다.

수정 후 저장소 루트에서 두 명령을 실행합니다.

```bash
node scripts/validate-skills.js
node --test scripts/*.test.js
```

| 명령 | 확인하는 내용 |
|---|---|
| `validate-skills.js` | 필수 본문·메타데이터·검토 기록·근거·날짜, 색인·링크·앵커, 클라이언트 설정, 제거한 MCP 경로의 재등장 |
| `node --test …` | 가이드 삭제·잘못된 메타데이터·경로 이탈·색인 손상·훅 동작 등의 경계·회귀 사례 |

두 명령은 LLM API나 외부 서비스를 호출하지 않습니다. 형식 검사 통과가 지침의 정확성이나 실제 DB·PG 동작을 보장하지는 않습니다.

[CI](.github/workflows/ci.yml)는 Ubuntu·Windows·macOS에서 Node 22·24로 같은 검사를 실행하도록 구성되어 있습니다. 로컬 통과와 원격 CI 완료를 구분해 기록합니다.

<details>
<summary>추가 검증: AI 행동과 이관 동등성</summary>

**AI 행동 평가:** [합성 개발 사례](tests/behavior-cases.md)의 입력과 판정 기준을 사용합니다. 실제 읽은 문서와 해시, 최종 답변·diff, 실행한 테스트·결과, 미확인 조건을 기록합니다. 답변에 규칙 ID가 있다는 이유만으로 문서 적용을 합격 처리하지 않습니다.

**이관 동등성:** 별도로 보관한 전체 규칙 JSON이 있을 때만 선택 인자로 전달합니다.

```bash
node scripts/validate-skills.js /path/to/baseline.json
```

이 비교는 전체 필드의 차이를 확인합니다. 일반 형식 검사는 구조적 누락을 잡지만 모든 의미 변경을 감지하지는 않습니다. 기준 JSON은 비교 증거로 보관하며 두 번째 지식 원본으로 관리하지 않습니다.

</details>

## 수정 위치

지식 원본은 `skills/commerce-backend-expert/`의 Markdown입니다. 대표 스킬·파트 색인 6개·규칙 70개를 관리하고, 리뷰 스킬은 같은 규칙을 참조합니다.

| 바꾸려는 내용 | 수정 위치 |
|---|---|
| 공통 판단·개발 절차 | [SKILL.md](skills/commerce-backend-expert/SKILL.md) |
| 결제·환불 리뷰 절차 | [commerce-review](skills/commerce-review/SKILL.md) |
| 개별 규칙과 파트별 탐색 | `skills/commerce-backend-expert/references/<파트>/<ID>.md`와 같은 폴더의 `INDEX.md` |
| 문서 검사와 회귀 테스트 | [검사기](scripts/validate-skills.js), [테스트](scripts/validate-skills.test.js) |
| AI 행동 평가의 입력·판정 기준 | [tests/behavior-cases.md](tests/behavior-cases.md) |
| 플러그인 메타데이터·클라이언트 진입 설정 | [plugin.json](plugin.json), `.<client>-plugin/plugin.json` |
| 선택적 라우팅·외부 스킬 경로 | [.cursor/rules/](.cursor/rules/), [.openclaw/](.openclaw/) |
| 지식 편집 후 자동 검사 | [hooks/](hooks/) — 아래의 [설정 절차](#선택적-개발-훅) 참고 |
| 사용자 세션의 지침·켜기·끄기 | [hooks/session.js](hooks/session.js), [등록 설정](hooks/session.json) |
| 로컬 설치·갱신·제거 시험 | [scripts/smoke-plugin.js](scripts/smoke-plugin.js) |
| CI 실행 환경 | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| 개발 스크립트의 CommonJS 범위 | [package.json](package.json) — 비공개·의존성 없음 |

공통 지침을 파트마다 복제하지 않습니다. 입력·절차·성공 기준이 다른 독립 업무가 확인될 때 스킬을 나눕니다. Java 서버나 YAML 지식을 다시 병행 관리하지 않습니다.

## 지식 작성 규칙

### 수정 순서

1. 해당 규칙의 적용 조건·제외 조건·전제부터 확인하고 지침·실패와 복구·체크리스트를 함께 수정합니다.
2. 규칙 ID와 파일명을 유지하고 파트 색인·관련 규칙 링크를 맞춥니다. 규칙을 추가·삭제하면 테스트의 카탈로그 수도 확인합니다.
3. 근거와 검토 상태를 사실에 맞게 기록하고 [검사 명령](#검증)을 실행합니다.

### 본문 형식

아래는 문서 형식별 필수 본문입니다. 제목·적용 조건·체크리스트·근거 등 공통 필드도 유지해야 합니다.

| 문서 형식 | 필수 본문 제목 |
|---|---|
| `commerce` 규칙 | `업무 맥락`, `반드시 지켜야 할 원칙`, `권장 흐름`, `기술 구현 참고`, `실패 시나리오` |
| `spring-commerce` 규칙 | `업무 맥락`, `Java Spring 구현 가이드`, `피해야 할 패턴` |
| 나머지 일반 규칙 | `구현 가이드`, `피해야 할 패턴` |
| `category: checklist` 전용 문서 | `검토 체크리스트`로 구성하며 위의 일반 가이드는 요구하지 않음 |

- 필수 본문이 없거나 비어 있으면 검사에 실패합니다. 환불 가이드 전체 삭제도 저장소 검사와 편집 훅에서 차단합니다.
- `##` 제목은 검증기가 필드를 구분하는 기준입니다. 본문 소제목에는 `###` 이하를 사용합니다.
- `출처` 안에서는 각 `###` 제목 아래의 근거 필드 구조를 유지합니다.
- `적용 조건`·`전제`·`적용하지 않는 조건` 절을 모두 유지합니다. 전제는 비워두지 않습니다. 예외가 없으면 `적용하지 않는 조건`의 본문만 비워 두어, 의도적인 빈 값과 절 삭제를 구분합니다.

### 근거와 검토 상태

- `status`, `severity`, `evidenceLevel`, `owner`를 실제 상태에 맞게 기록합니다.
- `verifiedBy`, `lastReviewedAt`, `changeNote`는 실제 검토에 근거해 기록합니다. 임의로 `not-recorded`를 채우거나 `needs-review`를 해제하지 않습니다. `active`도 정확성 인증은 아닙니다.
- 공식 근거는 실제 확인한 주소·적용 범위·기준일을 남깁니다. 특정 PG 계약이나 회사 정책을 공통 정답으로 가정하지 않습니다.
- 회사 고유 자료·고객 정보·실제 키를 넣지 않습니다.

## 세션 훅

Codex·Claude manifest는 [session.json](hooks/session.json)의 `SessionStart`·`UserPromptSubmit`을 등록합니다. Node.js 22 이상이 필요하며 문서 스킬만 사용하는 경로는 별도로 유지합니다. Codex는 훅 정의를 사용자가 검토·신뢰해야 실행합니다. 설치만으로 신뢰를 설정하지 않습니다.

Codex CLI 0.153.2에서는 루트 manifest에 Agent Plugins `$schema`가 있으면 번들 훅 목록이 비어 있는 현상을 재현했습니다. 같은 패키지에서 이 필드만 제외하면 두 세션 훅이 발견됩니다. 호환성을 위해 현재 루트 manifest에서 `$schema`를 생략하며, OpenAI 설정과 클라이언트별 진입 설정은 유지합니다. 버전별 실측 없이 이 필드를 다시 추가하지 않습니다.

상태 제어는 일반 메시지 `commerce on`·`commerce off`·`commerce status`와 정확히 일치할 때만 처리합니다. 상태 키는 프로젝트 경로와 세션 ID의 해시이며 파일에는 불리언만 저장합니다. 시작 때는 스킬 경로와 짧은 범위만 제공하고, 보통 요청에는 같은 지침을 반복 출력하지 않습니다.

직접 실행·프로토콜 테스트는 정상 입력, 격리된 상태, 재개·압축 후 유지, 손상된 상태, 64KiB 입력 제한과 끝나지 않는 입력의 종료를 확인합니다. 입력 대기는 2초, 클라이언트 등록 제한시간은 5초이며 오류는 경고만 남깁니다. 이 테스트를 실제 클라이언트의 훅 호출 확인으로 대신하지 않습니다.

## 선택적 개발 훅

스킬 지식을 편집할 때 자동 검사를 원하는 경우에만 설정합니다. 위 세션 훅과 별개이며, 기본 manifest에는 편집 검사를 등록하지 않습니다.

1. [Claude 템플릿](hooks/claude.json) 또는 [Cursor 템플릿](hooks/cursor.json)을 선택합니다.
2. 명령의 `${CLAUDE_PLUGIN_ROOT}` 또는 `${CURSOR_PLUGIN_ROOT}`를 이 저장소의 절대경로로 바꿉니다. Node.js 22 이상이 필요합니다.
3. 해당 클라이언트의 프로젝트·사용자 훅 설정에 이벤트를 병합합니다. 기존 설정 전체를 덮어쓰지 않습니다.

검사 범위는 `skills/` 안의 Markdown 편집입니다. 두 스킬과 공유 규칙을 함께 검사합니다. 외부 프로젝트 파일은 건너뛰며 파일·설정 변경, 네트워크 호출, 자동 프롬프트 주입을 하지 않습니다. 입력은 64KiB로 제한하고 정상 실행은 아무것도 출력하지 않습니다. OpenClaw에는 이 두 클라이언트의 훅을 연결하지 않습니다.

## 클라이언트 확인

**기록 기준일: 2026-10-23.** 설정 형식 검사, 클라이언트의 활성 상태 표시, 모델의 실제 문서 적용을 구분합니다.

| 환경 | 확인한 범위 | 미확인·제한 |
|---|---|---|
| Codex CLI 0.153.2 | 로컬 설치·활성 상태, 패키지 87개 파일의 캐시 일치, 같은 버전 재설치·시험용 버전 간 갱신, 제거·캐시 삭제. 루트 `$schema` 제외 후 `SessionStart`·`UserPromptSubmit` 발견 | 두 훅은 예상대로 `untrusted`. 사용자 검토·신뢰 후 실제 실행과 재개·압축 동작은 미확인 |
| Codex app-server + 읽기 전용 파일 도구 | 스킬을 명시하지 않은 환불·웹훅 리뷰에서 실제 스킬·규칙 조회, CSS 요청에서 커머스 문서 미조회 | 합성 사례 3개·각 1회. 기본 CLI 도구 환경·실제 DB/PG 검증이나 미사용 대비 품질 향상 증거는 아님 |
| Claude Code 2.1.114 | manifest 검사, 스킬 2개 발견. 현 소스에서 프롬프트 없이 실제 `SessionStart` 성공 응답 확인. 별도 시험에서 `commerce off` 상태 기록 | off 시험 복사본에는 진단용 기본 훅 파일도 존재. 추론은 크레딧 부족으로 중단. 모델의 문서 적용과 실제 재개·압축 동작 미검증 |
| Cursor·OpenClaw | 저장소의 설정 형식·경로 검사 | 실제 클라이언트 실행 미검증 |
| 선택적 훅 | 로컬 검사기·회귀 테스트 | 클라이언트에 등록한 훅 실행 미검증 |

Codex 시험은 별도의 `CODEX_HOME`과 작업 폴더에서 수행했으며 평소 사용자 설정은 변경하지 않았습니다. 런타임 시험용 패키지는 manifest·라이선스·모듈 범위 설정·라우팅 규칙·스킬·세션 훅만 포함했습니다. 버전 갱신 검사는 시험용 복사본에서 수행했습니다. 배포 소스에는 한영 문서·마켓플레이스·개발 검사 도구도 포함합니다. 위 결과를 모든 클라이언트의 훅 실행 검증으로 확대하지 않습니다.

로컬 설치 시험은 모델·인증 정보 없이 재현할 수 있습니다. 결과는 무시되는 `output/plugin-smoke-*`에 남습니다.

```bash
node scripts/smoke-plugin.js /absolute/path/to/codex
```

Windows에서는 마지막 인자에 `codex.exe`의 실제 경로를 전달합니다. 이 명령은 설치·파일 일치·갱신·제거를 확인하며 모델이나 훅을 실행하지 않습니다.

<details>
<summary>클라이언트 수동 검증 절차와 형식 기준</summary>

1. [공식 구조](https://developers.openai.com/plugins/build/plugins)에 맞춘 시험용 로컬 마켓플레이스를 만들고 새 프로필을 준비합니다.
2. 격리한 Codex CLI에서 `plugin marketplace add` → `plugin list --available` → `plugin add` → `plugin list` 순서로 설치·활성 상태를 확인합니다.
3. 캐시와 소스를 비교하고 시험용 파일을 수정해 재설치합니다. 같은 버전 소스 갱신과 다른 버전 업데이트는 별도 항목으로 확인합니다.
4. 스킬을 명시하지 않은 커머스 요청과 무관한 화면 작업으로 자동 선택·비선택을 확인합니다. 실제 문서 조회와 결과를 기록합니다.
5. `plugin remove` 후 설치 목록·캐시를 확인하고 `plugin marketplace remove`를 실행합니다. 사용하는 클라이언트 훅도 별도로 확인합니다.

Codex 설치 명령은 모델의 자동 선택을 검증하지 않습니다. Claude·Cursor·OpenClaw도 각 클라이언트의 새 프로필·설정에서 확인해야 합니다.

형식 기준으로 사용한 공식 문서:

- [Codex 플러그인](https://developers.openai.com/plugins/build/plugins)
- [Claude 플러그인](https://code.claude.com/docs/en/plugins-reference)
- [Cursor 플러그인](https://prod.cursor.com/docs/reference/plugins)·[훅](https://prod.cursor.com/docs/hooks)
- [OpenClaw 번들](https://docs.openclaw.ai/plugins/bundles)·[스킬 경로](https://docs.openclaw.ai/tools/skills)

</details>

## 남은 작업과 이전 기록

- 번들 훅이 실제 발견·신뢰·호출되는 클라이언트 환경과 재개·압축 동작을 확인합니다.
- 자연어 평가를 반복하고 미사용 대조군과 비교합니다. 단일 시험을 일반적인 품질·토큰 개선으로 확대하지 않습니다.
- `needs-review` 규칙 19개의 근거·조건을 개별 검토합니다.

<details>
<summary>기존 합성 평가와 v0.2.2 전환 배경</summary>

**기존 합성 평가:** 구현·리팩터링·리뷰·장애 분석·일부 코드·일반 화면·복합 설계의 업무 7개를 평가했습니다. 구현 시나리오 7개, 리팩터링 차등 사례 14개, 별도 확인 11개를 통과했습니다. 실제 DB·PG·브라우저·설치 후 자동 선택을 검증한 기록은 아닙니다.

**MCP 전환:** 이 브랜치에서는 YAML 6개, Java MCP와 테스트, Gradle, npm 런처·JRE 준비, JAR/npm 게시 워크플로를 제거했습니다. 기존 v0.2.2는 [태그](https://github.com/dakcoh/commerce-backend-expert/tree/v0.2.2)에 보존했습니다. 임시 소스 백업·빌드 산출물은 정리했으며, 기존 MCP 실행·빌드는 해당 버전에서 확인합니다. 현재 브랜치는 예전 MCP 설정과 호환되지 않습니다.

**과거 출처 경로:** 일부 규칙의 `src/main/resources/knowledge/*.yml`은 v0.2.2 당시의 출처 기록입니다. 현재 파일이나 런타임 의존성이 아닙니다. 필요한 경우 [당시 지식 소스](https://github.com/dakcoh/commerce-backend-expert/tree/v0.2.2/src/main/resources/knowledge)를 확인합니다.

</details>

MCP 등록·Java 런타임 다운로드를 다시 추가하거나 스킬 때문에 사용자 프로젝트를 Java 21로 바꾸지 않습니다. 회사 고유 프로세스·다국가 지식·유료화·비공개 저장소 전환은 현재 범위에 포함하지 않습니다. 커밋·푸시·게시·사용자 환경 설치는 해당 요청 범위에서 진행합니다.
