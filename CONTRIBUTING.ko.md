# 기여하기

[English](CONTRIBUTING.md) · 한국어

사용법은 [README](README.ko.md)를 확인하세요. 지식 원본은 [스킬의 Markdown](skills/commerce-backend-expert/SKILL.md)입니다. Java 서버나 YAML 지식을 다시 병행 관리하지 않습니다.

## 구조

```text
skills/commerce-backend-expert/
  SKILL.md                    공통 판단·개발 절차
  references/<파트>/INDEX.md   필요한 규칙을 고르는 색인
  references/<파트>/<ID>.md    조건·예외·지침·근거
scripts/
  validate-skills.js           문서·지식·저장소 검사
  validate-skills.test.js      경계·회귀 테스트
tests/behavior-cases.md        합성 개발 업무의 입력·판정 기준
.github/workflows/ci.yml       문서와 테스트 CI
plugin.json                   공통 번들 메타데이터
package.json                  개발 도구의 CommonJS 범위 선언(비공개·의존성 없음)
.codex-plugin/                Codex 진입 설정
.claude-plugin/               Claude Code 진입 설정
.cursor-plugin/               Cursor 진입 설정
.cursor/rules/                선택 적용 라우팅
.openclaw/                    기존 설정에 병합하는 경로 예시
hooks/                        선택적 개발 검증 훅
```

대표 스킬·파트 색인 6개·규칙 70개로 시작합니다. 입력·절차·성공 기준이 다른 업무가 확인될 때 독립 스킬로 나눕니다. 파트마다 공통 지침을 복제하지 않습니다.

## 지식 수정

- 규칙 ID와 파일명을 유지하고 해당 파트 색인에 등록합니다. 추가·삭제 시 테스트의 카탈로그 수도 확인합니다.
- 제목, 적용 조건·제외 조건·전제, 순서 있는 지침, 실패와 복구, 체크리스트, 관련 규칙을 함께 검토합니다.
- `##` 제목은 검증기의 필드 구분입니다. 본문 안의 소제목은 `###` 이하를 사용합니다. 출처는 각 `###` 제목 아래의 필드를 유지합니다.
- `status`, `severity`, `evidenceLevel`, `owner`, 검토자·검토일·변경 이유를 사실에 맞게 기록합니다. 실제 검토 없이 `not-recorded`를 채우거나 `needs-review`를 해제하지 않습니다.
- 공식 근거는 실제 확인한 주소·범위·기준일을 기록합니다. 회사 고유 자료·고객 정보·실제 키를 넣지 않습니다. PG 계약·사업 정책을 공통 정답으로 가정하지 않습니다.

일부 출처에 남은 `src/main/resources/knowledge/*.yml`은 **v0.2.2 당시의 출처 기록**입니다. 현재 파일이나 실행 의존성이 아닙니다. 과거 내용을 확인하려면 [v0.2.2 소스](https://github.com/dakcoh/commerce-context-mcp/tree/v0.2.2/src/main/resources/knowledge)를 사용합니다. 새 지식은 Markdown에서만 수정합니다.

## 검증

기여자의 검사에는 Node.js 22 이상을 사용합니다. 의존성 설치와 JDK는 필요하지 않습니다. 저장소 루트에서 실행합니다.

```bash
node scripts/validate-skills.js
node --test scripts/validate-skills.test.js
```

첫 명령은 규칙·파트 색인·링크와 앵커·검토 기록·날짜·근거를 검사하고, 제거한 MCP 런타임 경로가 다시 생기지 않았는지 확인합니다. 두 번째 명령은 누락·잘못된 메타데이터·외부 경로·손상된 색인 등 실패 사례를 확인합니다. LLM API나 외부 서비스를 호출하지 않습니다.

이관 비교가 필요하면 별도로 보관한 전체 규칙 JSON을 선택 인자로 전달합니다. 그 파일은 이관 증거이며 두 번째 지식 원본으로 관리하지 않습니다.

```bash
node scripts/validate-skills.js /path/to/baseline.json
```

형식 검사와 모델 판단은 별도 검증입니다. [합성 개발 사례](tests/behavior-cases.md)를 실행할 때 실제 읽은 문서와 해시, 최종 답변·diff, 수행한 테스트·결과, 미확인 조건을 기록합니다. 규칙 ID를 답변에 적었다는 이유만으로 문서 적용을 합격 처리하지 않습니다.

이관본은 구현·리팩터링·리뷰·장애 분석·일부 코드·일반 화면·복합 설계의 합성 업무 7개를 평가했습니다. 구현 결과의 시나리오 7개, 리팩터링 차등 사례 14개와 별도 확인 11개를 통과했습니다. 실제 DB·PG·브라우저·설치 후 자동 선택은 이 기록의 검증 범위가 아닙니다. 이번 런타임 제거는 이관본 평가와 구분해 지식 보존·구조·문서·테스트로 검증합니다.

CI는 Ubuntu·Windows·macOS에서 Node 22·24로 검사하도록 구성합니다. 로컬 통과와 원격 CI 완료를 구분해 기록합니다.

## 선택적 개발 훅

기본 manifest는 훅을 등록하지 않습니다. 지식 편집 시 검사를 원하면 [Claude 템플릿](hooks/claude.json) 또는 [Cursor 템플릿](hooks/cursor.json)을 사용합니다. 템플릿 명령의 `${CLAUDE_PLUGIN_ROOT}`·`${CURSOR_PLUGIN_ROOT}` 자리표시자를 이 저장소의 절대경로로 바꾸고, 해당 클라이언트의 프로젝트/사용자 훅 설정에 이벤트를 병합합니다. 기존 설정 전체를 덮어쓰지 않습니다.

검사기는 `skills/commerce-backend-expert/` 안의 Markdown 수정에만 반응합니다. 외부 프로젝트 파일은 건너뛰고 파일·설정 변경이나 네트워크 호출을 하지 않습니다. 입력은 64KiB로 제한하며 정상 실행은 아무것도 출력하지 않습니다. 자동 프롬프트 주입·모든 코드 편집 검사·강제 기술 도입을 하지 않습니다. OpenClaw에는 이 두 클라이언트의 훅을 연결하지 않습니다.

형식 기준은 [Codex](https://developers.openai.com/plugins/build/plugins), [Claude](https://code.claude.com/docs/en/plugins-reference), [Cursor](https://prod.cursor.com/docs/reference/plugins), [OpenClaw 번들](https://docs.openclaw.ai/plugins/bundles)·[스킬 경로](https://docs.openclaw.ai/tools/skills), [Cursor 훅](https://prod.cursor.com/docs/hooks) 공식 문서입니다. 각 클라이언트 새 프로필에서 발견·활성화·업데이트·제거와 훅 실행을 확인하기 전에는 설치 검증 완료로 기록하지 않습니다.

## 전환과 다음 작업

현재 브랜치에서 YAML 6개, Java MCP와 테스트, Gradle, npm 런처·JRE 준비, JAR/npm 게시 워크플로를 제거했습니다. README와 이 기여 가이드는 한영 4개 문서로 정리했습니다. 기존 v0.2.2는 로컬 `legacy/v0.2.2` 브랜치와 태그로 보존하고 임시 소스 백업·빌드 산출물은 삭제했습니다. 기존 MCP의 실행·빌드는 해당 버전에서 확인하며 현재 브랜치와 호환되지 않습니다.

다음은 지원 클라이언트 한 곳의 플러그인 설치·활성화·업데이트·제거 검증과 검토 필요 규칙 19개의 개별 검토입니다. 스킬 패키지에 MCP 등록이나 Java 런타임 다운로드를 다시 추가하지 않습니다. 사용자의 프로젝트를 Java 21로 바꿀 필요도 없습니다. 배포 형식은 [OpenAI 공식 안내](https://developers.openai.com/plugins/build/plugins)를 기준으로 확인합니다.

회사 고유 프로세스·다국가 지식·유료화·비공개 저장소 전환은 이번 범위에 추가하지 않습니다. 커밋·푸시·게시·설치는 해당 요청 없이 진행하지 않습니다.
