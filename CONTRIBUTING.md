# 기여·개발·릴리스 안내

사용법은 [README](README.md), 설치 문제는 [설치 가이드](npm/README.md)를 먼저 확인하세요. 이 문서는 코드·지식·문서를 고치거나 배포하는 사람을 위한 안내입니다.

[개발 환경](#현재-개발-환경) · [지식 수정](#지식-고치기) · [검증](#로컬에서-검증하기) · [연동 계약](#서버-구조와-연동-계약) · [AI 평가](#실제-ai-평가) · [다음 개선](#다음-개선) · [릴리스](#게시-전-확인)

## 사용자에게 유지할 약속

- 한국 이커머스의 범용 지침과 Java/Spring 구현 선택지를 제공합니다.
- 검색 후보와 결함 확정, 검색 일치도와 지식의 근거 수준을 구분합니다.
- 적용 조건·예외·검토 상태를 응답에서 보존합니다.
- 검토하지 않은 날짜·검토자·근거를 만들지 않습니다.
- 회사 고유 정책·계약·실제 고객 정보·키를 공개 지식과 예제에 넣지 않습니다.

## 현재 개발 환경

| 항목 | 현재 기준 |
|---|---|
| 빌드 JDK | 17 toolchain, application major61 |
| 실행 | Java17 이상. JDK17/21 대표 런타임 검증 |
| Node.js | 22 이상, 22/24 대표 검증 |
| 서버 | STDIO, JAR 내부 YAML, 외부 HTTP 서버·DB·LLM 없음 |

Java21 자동 준비와 21 기준 빌드 전환은 [다음 개선](#다음-개선)의 예정 작업입니다. 문서만 바꿔 현재 요구사항을 21로 표시하지 않습니다.

의존 방향 `adapter → application → core`를 유지하고 core에 Spring/MCP/Jackson·파일 I/O 의존성을 넣지 않습니다. 기존 4개 Tool로 해결할 수 있는지 먼저 확인하며, 정적 규칙마다 도구를 만들거나 Tomcat·Spring Web·Actuator를 추가하지 않습니다.

## 지식 고치기

단일 원본은 [`src/main/resources/knowledge`](src/main/resources/knowledge)의 YAML입니다. 규칙 ID를 유지하고 변경 이유·적용 조건·실패와 복구를 함께 적습니다.

```yaml
schema-version: 1
domain: example
governance:
  owner: example-maintainers
rules:
  - id: example-rule
    category: security
    title: "규칙 제목"
    summary: "적용 조건과 핵심 판단"
    severity: high
    applicability:
      applies-when: ["적용 조건"]
      does-not-apply-when: ["제외 조건"]
      assumptions: ["전제"]
      jurisdiction: KR
    guidance: ["실패·복구를 포함한 지침"]
    checklist: ["확인 질문"]
    tags: [example]
```

예시는 작성 형식이며 운영 규칙으로 추가하라는 뜻은 아닙니다. High·Critical은 적용 조건·명시적 근거·실제 검토자·검토일이 부족하면 `needs-review`가 됩니다. `status: active`로 우회할 수 없습니다.

실제 검토했을 때만 다음 기록을 추가합니다.

```yaml
review:
  last-reviewed-at: 2026-07-21
  verified-by: actual-reviewer
  change-note: "확인한 범위와 변경 이유"
```

공식 자료를 직접 확인했다면 아래 형식으로 기록합니다. 날짜·검토자는 실제 값으로 바꾸고 해당하지 않는 선택 필드는 생략합니다.

```yaml
evidence:
  - title: "확인한 문서"
    url: "https://official.example/document"
    type: official-documentation
    source-version: "확인한 버전"
    published-at: 2026-01-15
    reviewed-at: 2026-07-21
    accessed-at: 2026-07-21
    note: "적용 조건과 확인 범위"
```

중복 필드·중복 ID·잘못된 참조·빈 필수 값·검토 기록 한쪽 누락·잘못된 날짜·미래 날짜를 거부합니다. 외부 HTTP(S) 근거에는 확인일이 필요합니다. 블로그·AI 답변·프로젝트 YAML 경로를 공식 근거처럼 기록하지 말고, PG 상태 코드·timeout·세율·보존 기간을 범용 고정값으로 넣지 않습니다.

## 로컬에서 검증하기

PowerShell 예시입니다. `JAVA_HOME`은 자신의 JDK17 경로로 바꿉니다.

```powershell
$env:JAVA_HOME="C:\path\to\jdk-17"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat validateKnowledge bootJar --no-daemon

cd npm
npm.cmd test
node test\mcp-smoke.js ..\build\libs\context-engine-0.2.0-SNAPSHOT.jar
$env:npm_config_cache="..\.npm-cache"
npm.cmd pack --dry-run
```

| 바꾼 부분 | 확인할 내용 |
|---|---|
| YAML·신뢰 정보 | 70규칙과 schema·조건·근거·검토 상태, 중복 필드 거부 |
| 검색 | 기존 100질의, 새 표현·무관 질의, 순위와 결과 수. 기대 ID를 조용히 변경하지 않음 |
| 검토·체크리스트 | 기존 review20/checklist10/trust15 사례, 조건·문항·부분 결과 보존 |
| MCP | 4개 Tool·Resource3종·Prompt2종, 입력 오류 후 복구, 실제 JSON-RPC |
| 실행기 | Java 검사·전송·동시 캐시 복구·부분 파일·EOF·자식 종료·npm pack 내용 |
| 문서 | 명령·JSON·규칙 ID·로컬 링크, 현재와 예정 기능 구분 |

`validateKnowledge`는 전체 Java 테스트에 연결돼 있습니다. 실제 JAR의 MCP smoke와 npm 검증도 따로 실행합니다. 정책 테스트는 실제 PG·은행·DB 경쟁/장애 검증이 아닙니다. 모델의 도구 선택·최종 답변·토큰 비교는 [실제 AI 평가](#실제-ai-평가)로 별도 수행합니다.

## 업그레이드 안내

이전 도메인별 Tool을 프롬프트·자동화에서 직접 호출했다면 다음 통합 Tool로 바꿉니다. MCP 서버를 실행하는 `npx` 명령은 유지합니다.

| 이전 | 현재 |
|---|---|
| `search_*_knowledge`, `search_all_knowledge` | `search_knowledge` + 선택 domain |
| `get_*_guide`, `get_*_context` | 검색 후 `get_rule` |
| `get_*_checklist` | `get_checklist` |
| 응답 `confidence` | `matchConfidence`. 검색 일치도이며 사실성 점수가 아님 |

현재 작업본은 Node22 이상을 요구합니다. 다음 Java21 target 전환은 별도 호환성 변경이며, 구현·검증 후 새 버전의 요구사항에 명시합니다.

## 게시 전 확인

일반 `master` push/PR은 CI, GitHub Release 발행은 검증 후 게시의 조건입니다. [.github/workflows/validate.yml](.github/workflows/validate.yml)이 공통 검사이며 Ubuntu17/Node22 빌드와 Ubuntu21/Node24·Windows17/Node22·Windows21/Node24에서 같은 산출물을 확인합니다.

- Java·지식·npm 회귀와 실제 MCP가 통과했는지 확인합니다.
- npm/tag/manifest/serverInfo 버전과 application major61을 검사합니다.
- JAR의 YAML·금지된 웹 서버 의존성, tarball의 10개 파일·내용·integrity, bundle 해시를 확인합니다.
- 한글 캐시 경로와 EOF 후 Java 종료, Linux 신호 검증을 지원 환경에서 확인합니다.
- 공개 문서와 실제 코드·게시할 파일이 일치하는지 확인합니다.

미사용 npm 버전·tag commit·인증 확인 → JAR/checksum 업로드 → 재다운로드·검증본 비교 → **검증한 tarball 자체**의 provenance 게시 순서입니다. 게시 버전은 registry에서 확인하고 사용 중인 번호를 재사용하지 않습니다. 같은 버전 번호라는 이유만으로 현재 작업본과 기존 게시본이 같다고 가정하지 않습니다.

기존 자산은 덮어쓰지 않습니다. GitHub와 npm의 원자적 게시를 보장하지 않으므로 실패 후 재실행 전 남은 자산·npm 버전을 확인합니다. 자동 삭제·덮어쓰기·버전 증가를 하지 않습니다. `NPM_TOKEN` 권한·만료와 외부 Trusted Publisher 등록 상태도 별도로 확인합니다. 현재 workflow의 OIDC는 provenance용입니다.

`runtime-inventory.tsv`는 내장 라이브러리·해시 목록이며 표준 SBOM·취약점 판정이 아닙니다. 로컬 통과, 원격 CI 성공, 실제 게시·배포를 별도 결과로 보고합니다.

## 문제 제보·변경 설명

질문·규칙 ID, 적용 상황, 재현 가능한 입력, 기대 결과와 실제 결과를 적어 주세요. 지식 수정에는 확인한 공식 근거·기준일·조건을 함께 남깁니다. [실무 예시](docs/USAGE_SCENARIOS.md)의 호출 인자는 실제 MCP로 확인하며 회사 고유 자료를 복사하지 않습니다.

하나의 변경은 한 가지 목적에 집중하고, 실행한 검증과 남은 한계를 설명합니다. 커밋·push·게시·배포는 요청된 범위에서만 진행합니다.

## 서버 구조와 연동 계약

처리 흐름은 AI 클라이언트 → STDIO MCP → 검색·체크리스트·검토 → YAML입니다. 지식은 시작할 때 불변 객체로 읽고 외부 LLM·DB·HTTP 서버 없이 검색합니다. 최종 답변과 데이터 전송은 연결한 AI 클라이언트가 처리합니다.

| 위치 | 책임 |
|---|---|
| core/model·port | 지식 모델과 인터페이스 |
| application | 검색·검토 후보·체크리스트 조합 |
| adapter/in/mcp | Tool·Resource·Prompt와 입력 schema 검증 |
| adapter/out/yaml·render | YAML 로딩·검증과 Markdown 표현 |

공개 Tool은 `search_knowledge`, `get_rule`, `get_checklist`, `review_commerce_design`입니다. Resource는 `commerce://catalog`, `commerce://domains/{domain}`, `commerce://rules/{ruleId}`, Prompt는 `review-commerce-api`와 `review-payment-webhook`입니다.

- 검색·검토 결과는 기본 5개·최대 10개, 체크리스트는 최대 10개 규칙입니다.
- 일반 검색은 NFKC·일부 조사/활용형·별칭을 정규화한 단어 기반 검색입니다. 최대 32개 고유 검색어와 필드별 일치 비율을 사용하고 동점은 domain·category·ID로 정렬합니다.
- 코드 검토는 package/import를 제외하고 원문과 scenario를 독립 검색합니다. 긴 입력은 겹치는 16단어 구간을 최대 32개 추가 검색하며 더 큰 입력은 표본 검색을 표시합니다. 코드 실행·AST 분석은 아닙니다.
- 체크리스트는 조건·신뢰 맥락까지 같은 문항만 중복 제거합니다. JSON·Markdown의 문항과 순서를 보존합니다.
- 검색·규칙·체크리스트의 `responseFormat`은 `json` 또는 기본 `both`입니다. json은 `markdown`을 빈 문자열로 유지하고 search의 json+full은 `fullRules`에 전문을 제공합니다. 검토에는 이 옵션이 없습니다.
- 검색·검토의 domain은 CSV, 체크리스트는 단일 값입니다. 필수 값·타입·enum·범위·모르는 필터·빈 CSV 요소는 오류로 구분합니다. enum의 공백·대소문자는 정규화합니다.
- 빈 질문·유효한 무관 질문은 옵션 검증 후 정상적인 결과 없음입니다. Tool은 `isError`, Resource는 JSON-RPC 오류로 알리고 다음 유효 요청을 계속 처리합니다.
- 현재 ToolCallback은 text JSON을 반환하며 native `outputSchema`·`structuredContent`·annotations 전환은 미구현입니다.

### 전송·캐시·종료 경계

JAR는 npm 버전과 맞춰 HTTPS로 받고 SHA-256을 검증합니다. 체크섬은 손상 검증이며 배포자 서명을 대신하지 않습니다.

| 항목 | 현재 제한 |
|---|---|
| 체크섬 | 전체15초·64KiB |
| JAR | 시도당 전체120초·최대3회 |
| 요청 무응답 | 15초, redirect도 전체 제한 공유 |
| 잠금 대기·재획득 | 원래405초 예산 공유, 진행 중 전송 강제 취소 시각은 아님 |
| EOF·종료 | 생성한 Java의 stdin을 닫고 최대2초 유예, 신호는 해당 자식에 전달 |

- 잠금은 PID·호스트·토큰으로 확인하고 죽은 로컬 소유자만 회수합니다. 불명확·외부 호스트·활성 소유자는 자동 삭제하지 않습니다.
- 소유권을 잃으면 게시를 중단하고 남은 예산으로 재획득하거나 검증된 승자 캐시를 사용합니다. 중복 전송은 가능하며 공유 디스크의 엄격한 상호 배제를 보장하지 않습니다.
- 임시 파일을 정리하고 신호 종료는 130/143, 일반 종료는 자식 코드를 유지합니다. 전원 중단·실행기 강제 종료에는 정리를 보장하지 않습니다.

## 실제 AI 평가

서버 회귀와 실제 AI의 작업 성공을 구분합니다. JSON 바이트 감소는 모델 토큰·비용 감소율이 아닙니다. 일반 실행이나 CI에서 유료 LLM 평가를 자동 호출하지 않습니다.

개발용 작업12개는 [ai-workflows.json](npm/test/fixtures/ai-workflows.json)에 있습니다. 회사 코드·고객정보·실제 키를 쓰지 말고 제공된 합성 artifact를 사용합니다.

1. 클라이언트·모델·버전·설정을 기록하고 각 task와 artifact를 새 대화에 전달합니다. 호출 순서는 강제하지 않습니다.
2. 실제 도구 호출·인자·결과, 최종 답변, 관측 가능한 토큰·시간을 JSONL로 기록합니다. 미관측 토큰은 null이며 비공개 추론 과정은 수집하지 않습니다.
3. 사람이 각 humanChecks를 확인하고 실제 reviewedBy/reviewedAt을 기록합니다. 한 조합당12개를 모두 포함하고, 초기 비교는 각3회 반복을 권장하며 실제 횟수를 보고합니다.
4. 조건·근거 보존, 잘못된 확정 판단, 부분 결과 설명, 오류 복구와 효율을 비교합니다. 개발에 쓴 표현과 최종 검증용 질문을 구분합니다.

아래는 미완성 형식 예시입니다. 빈 결과·검토 정보로 실제 평가를 통과했다고 기록하지 않습니다. 실제 JSONL은 한 줄에 객체 하나씩 저장합니다.

```json
{
  "taskId": "AI-01",
  "model": "실제 모델과 버전",
  "client": "실제 클라이언트",
  "run": 1,
  "toolCalls": [
    {
      "name": "search_knowledge",
      "arguments": {"query": "결제 웹훅 서명", "responseFormat": "json"},
      "result": {}
    }
  ],
  "finalAnswer": "실제 최종 답변",
  "inputTokens": null,
  "outputTokens": null,
  "elapsedMs": null,
  "reviewedBy": null,
  "reviewedAt": null,
  "humanChecks": {}
}
```

result에는 실제 MCP 결과나 파싱한 응답을 넣습니다. 채점기는 관련 규칙과 사람이 기록한 결과를 확인하며 특정 호출 순서를 강제하지 않습니다.

저장소의 npm 폴더에서 실행합니다. 경로는 실제 기록으로 바꾸세요.

```powershell
cd npm
npm.cmd run test:ai-eval -- "C:\path\reviewed-transcripts.jsonl"
```

종료코드0은 제공 기록 통과·사례 완비, 1은 실패·잘못된 입력, 2는 검토·사례 누락으로 판정 대기입니다. 합성 기록으로 채점기를 시험한 결과를 모델 성능으로 보고하지 않습니다. 채점기는 사람 검토의 진실성까지 증명하지 않습니다.

## 다음 개선

목표는 사용자가 JDK를 직접 설치하지 않아도 쓰는 것입니다. **Java21 자동 준비·21 기준 빌드 전환·플러그인 배포는 아직 미구현**이며 현재는 Node22 이상과 Java17 이상을 직접 준비합니다.

| 순서 | 사용자에게 달라질 점 | 완료 기준 |
|---|---|---|
| 1. 전용 런타임 | 최초 실행에 Java21 다운로드·검증·캐시, 이후 재사용 | Java 없는 환경의 기동, OS·CPU별 손상·중단·동시 실행 복구, PATH·관리자 권한 변경 없음 |
| 2. 21 기준 통일 | 빌드·실행 요구사항을21로 명확히 안내 | 버전 검사·toolchain·artifact·CI·문서와 업그레이드 안내 일치, 기존 지식·MCP 계약 유지 |
| 3. 연결·평가 | 클라이언트 연결 안내·선택적 플러그인 포장, 실제 AI 답변 비교 | 클라이언트별 설치·활성화 확인, 실제 작업 기록·별도 검증용 표현 평가 |

런타임 준비는 npm 설치 스크립트에만 의존하지 않고 첫 실행에도 확인합니다. 배포판·라이선스·고정 패치 버전·공급처·시스템 Java 재사용·지원 OS/CPU와 보안 업데이트 정책을 구현 전에 확정합니다. 다운로드·체크섬·안전한 압축 해제·실패 원인 안내·캐시 재사용·자식 종료를 검사하고 로그는 stderr로 보내 STDIO를 보존합니다. 최초 시간·용량은 실측 후 안내합니다.

영향은 Java 검사·명령·자식 실행·다운로드/캐시·테스트·릴리스/CI입니다. 압축 경로 밖 쓰기를 차단하고 반복 복구가 대기 예산을 초기화하지 않도록 합니다.

Java21 target의 새 JAR는 Java17 직접 실행 호환성을 바꾸므로 새 버전에 명시합니다. MCP가 검토하는 사용자 프로젝트까지21로 바꿀 필요는 없습니다. 전환 자체를 성능·정확도 개선으로 발표하지 않습니다.

native MCP 메타데이터는 기존 도구 중복 없이 text 응답 호환성과 실제 이득을 확인한 뒤 검토합니다. 비공개 지식은 공개 저장소·배포 파일 밖으로 분리할 때 설계합니다. 영어 지원·국가별 필터·유료화·Private 전환은 이번 범위에 추가하지 않습니다.

원격 CI·Linux 실행, 실제 AI 평가와 GitHub 다운로드·npm 게시/provenance는 로컬 통과와 별도 확인 대상입니다. 커밋·push·게시·배포는 별도 요청 없이 진행하지 않습니다.
