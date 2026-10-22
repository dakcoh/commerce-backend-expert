# 기여·개발·릴리스 안내

[English](CONTRIBUTING.md) · 한국어

사용법은 [README](README.ko.md), 설치 문제는 [설치 가이드](docs/INSTALLATION.ko.md)를 먼저 확인하세요. 이 문서는 코드·지식·문서를 고치거나 배포하는 사람을 위한 안내입니다.

[개발 환경](#현재-개발-환경) · [지식 수정](#지식-고치기) · [검증](#로컬에서-검증하기) · [런타임 정책](#전용-java-런타임-정책) · [연동 계약](#서버-구조와-연동-계약) · [답변 검증](#ai-답변-검증) · [다음 개선](#다음-개선) · [릴리스](#게시-전-확인)

## 사용자에게 유지할 약속

- 한국 이커머스의 범용 지침과 Java/Spring 구현 선택지를 제공합니다.
- 검색 후보와 결함 확정, 검색 일치도와 지식의 근거 수준을 구분합니다.
- 적용 조건·예외·검토 상태를 응답에서 보존합니다.
- 검토하지 않은 날짜·검토자·근거를 만들지 않습니다.
- 회사 고유 정책·계약·실제 고객 정보·키를 공개 지식과 예제에 넣지 않습니다.

영문 문서를 제공해도 지식 카탈로그와 검증한 주요 검색어는 현재 한국어입니다. 실제 호출 예시의 한국어 검색어는 유지하며 영어 지식·검색 품질은 별도로 평가합니다.

## 현재 개발 환경

| 항목 | 현재 기준 |
|---|---|
| 빌드 JDK | 21 toolchain, application major65 |
| npm 실행 | 전용 Temurin JRE21 자동 준비, 시스템 Java 불필요 |
| JAR 직접 실행 | Java21 이상 |
| Node.js | 22 이상, 22/24 대표 검증 |
| 서버 | STDIO, JAR 내부 YAML, 외부 HTTP 서버·DB·LLM 없음 |

Java21 기준 빌드와 전용 런타임 자동 준비를 적용했습니다. 시스템 Java를 사용하는 직접 JAR 실행과 npm 사용자의 자동 준비를 구분합니다.

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

중복 필드·중복 ID·잘못된 참조·빈 필수 값·검토 기록 한쪽 누락·잘못된 날짜·미래 날짜를 거부합니다. 날짜 검증은 실행 컴퓨터의 시간대와 관계없이 한국 시간(`Asia/Seoul`)을 기준으로 합니다. 외부 HTTP(S) 근거에는 확인일이 필요합니다. 블로그·AI 답변·프로젝트 YAML 경로를 공식 근거처럼 기록하지 말고, PG 상태 코드·timeout·세율·보존 기간을 범용 고정값으로 넣지 않습니다.

## 로컬에서 검증하기

`npm test`는 Node 표준 테스트 실행기로 기본 기능·캐시 잠금·다운로드·프로세스 종료·배포 파일·JRE 복구를 검사합니다. 테스트별 준비 데이터는 해당 파일에 두고, 임시 폴더 정리와 시스템 Java 격리는 `npm/test/support/fixtures.js`에서 공유합니다. `temporaryDirectory(prefix, t)`로 정리를 먼저 등록하면 준비 단계 실패에도 정리됩니다. 이 도우미는 npm 배포물에 포함되지 않습니다. 특정 영역만 확인하려면 저장소 루트에서 `node --test npm/test/runtime.test.js`처럼 실행합니다.

아래 명령은 저장소 루트에서 PowerShell로 실행합니다. `JAVA_HOME`만 자신의 JDK21 경로로 바꾸세요. 이 JDK는 소스 빌드용이며 npm 사용자의 런타임 설치와는 별개입니다.

```powershell
$env:JAVA_HOME="C:\path\to\jdk-21"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat clean validateKnowledge bootJar "-Pversion=0.2.2" --no-daemon
npm.cmd --prefix npm test
$env:MCP_EXPECTED_VERSION="0.2.2"
node npm/test/mcp-smoke.js build/libs/context-engine-0.2.2.jar
```

전용 JRE의 실제 다운로드·동시 실행·오프라인 재사용·손상 복구는 다음 명령으로 확인합니다. 이 테스트는 자체 임시 캐시를 사용하고 자식 프로세스의 PATH에서 Java를 제거합니다. 공식 JRE를 한 번 다운로드하므로 네트워크와 디스크 공간이 필요합니다.

```powershell
node npm/test/runtime-smoke.js
```

게시 전에는 **로컬 패키지**로 검증합니다. 아직 게시하지 않은 작업본을 `npx commerce-context-mcp`로 검사하면 registry의 기존 패키지를 실행하게 됩니다.

```powershell
Push-Location npm
npm.cmd pack --ignore-scripts --json --pack-destination ../build > ../build/npm-pack.json
Pop-Location
New-Item -ItemType Directory -Force build/packed | Out-Null
tar -xzf build/commerce-context-mcp-0.2.2.tgz -C build/packed
$env:MCP_LAUNCHER_ROOT=(Resolve-Path build/packed/package).Path
node npm/test/mcp-smoke.js build/libs/context-engine-0.2.2.jar
Remove-Item Env:\MCP_LAUNCHER_ROOT
Remove-Item Env:\MCP_EXPECTED_VERSION
```

패키지 smoke는 빌드한 로컬 JAR를 임시 캐시에 넣고, 시스템 Java 없이 전용 JRE 준비·MCP 호출·한글 캐시 경로·EOF 후 종료를 확인합니다. 게시된 서버 JAR의 콜드 다운로드는 릴리스 workflow의 별도 검사입니다. `--ignore-scripts` 설치는 `npm.cmd install --ignore-scripts --no-audit --no-fund --prefix build/local-install ./build/commerce-context-mcp-0.2.2.tgz`로 확인할 수 있습니다.

Linux/macOS에서는 JDK21을 설정한 뒤 `./gradlew`·`npm`을 사용합니다. 실제 OS 신호 테스트는 Linux/macOS에서 실행되며 Windows에서 생략한 결과와 구분합니다.

| 바꾼 부분 | 확인할 내용 |
|---|---|
| YAML·신뢰 정보 | 70규칙과 schema·조건·근거·검토 상태, 중복 필드 거부 |
| 검색 | 기존 100질의, 새 표현·무관 질의, 순위와 결과 수. 기대 ID를 조용히 변경하지 않음 |
| 검토·체크리스트 | 기존 review20/checklist10/trust15 사례, 조건·문항·부분 결과 보존 |
| MCP | 4개 Tool·Resource3종·Prompt2종, 입력 오류 후 복구, 실제 JSON-RPC |
| 실행기 | Java 없는 PATH·두 프로세스·Windows 잠금 읽기 오류와 교체된 소유자 보호·오프라인 손상 복구·체크섬 보조 파일 유실·doctor 종료코드·EOF·자식 종료·npm pack 내용 |
| 문서 | JSON 예시는 MCP smoke에서 실행. 규칙 70개 ID·로컬 링크·앵커와 작업본/게시본 구분 |

`validateKnowledge`는 전체 Java 테스트에 연결돼 있습니다. 실제 JAR의 MCP smoke와 npm 검증도 따로 실행합니다. 정책 테스트는 실제 PG·은행·DB 경쟁/장애 검증이 아닙니다. 모델의 도구 선택과 최종 답변은 [AI 답변 검증](#ai-답변-검증)으로 별도 확인합니다.

## 업그레이드 안내

이전 도메인별 Tool을 프롬프트·자동화에서 직접 호출했다면 다음 통합 Tool로 바꿉니다. MCP 서버를 실행하는 `npx` 명령은 유지합니다.

| 이전 | 현재 |
|---|---|
| `search_*_knowledge`, `search_all_knowledge` | `search_knowledge` + 선택 domain |
| `get_*_guide`, `get_*_context` | 검색 후 `get_rule` |
| `get_*_checklist` | `get_checklist` |
| 응답 `confidence` | `matchConfidence`. 검색 일치도이며 사실성 점수가 아님 |

0.2.0부터 npm 실행은 Node22 이상만 준비하면 전용 JRE21을 자동으로 받습니다. npm 사용자는 `download`와 `doctor`로 준비 상태를 확인하며 JAVA_HOME·PATH의 Java 설정은 필요 없습니다. 소스를 빌드하는 개발자는 JAVA_HOME과 PATH를 JDK21로 설정합니다. Java17에서는 새 JAR를 직접 실행할 수 없습니다.

## 게시 전 확인

일반 `master` push/PR은 CI를 실행하고, GitHub Release를 발행하면 검증 후 npm 승인 대기에 등록합니다. [.github/workflows/validate.yml](.github/workflows/validate.yml)이 공통 검사이며 Ubuntu의 JDK21/Node22 빌드와 Ubuntu의 JDK21/Node24·Windows의 JDK21/Node22·Windows의 JDK21/Node24에서 같은 산출물을 확인합니다. 추가로 Windows ARM64·Ubuntu ARM64·macOS Intel/ARM64에서 전용 런타임을 검사합니다. 패키지 MCP smoke는 추출 도구만 PATH에 남기고 JAVA_HOME을 없는 경로로 바꿔 시스템 Java 없이 기동·종료를 확인합니다.

- Java·지식·npm 회귀와 실제 MCP가 통과했는지 확인합니다.
- npm/tag/manifest/serverInfo 버전과 application major65을 검사합니다.
- JAR의 YAML·금지된 웹 서버 의존성, tarball의 14개 파일·내용·integrity, bundle 해시를 확인합니다.
- 한글 캐시 경로와 EOF 후 Java 종료, Linux 신호 검증을 지원 환경에서 확인합니다.
- 공개 문서와 실제 코드·게시할 파일이 일치하는지 확인합니다.

미사용 npm 버전·tag commit·인증 확인 → JAR/checksum 업로드 → 재다운로드·검증본 비교 → **검증한 tarball 자체**를 provenance와 함께 승인 대기에 등록 → npm에서 관리자가 2FA로 승인하는 순서입니다. 게시 버전은 registry에서 확인하고 사용 중인 번호를 재사용하지 않습니다. 같은 버전 번호라는 이유만으로 현재 작업본과 기존 게시본이 같다고 가정하지 않습니다.

기존 자산은 덮어쓰지 않습니다. GitHub와 npm의 원자적 게시를 보장하지 않으므로 실패 후 재실행 전 남은 자산·npm 버전을 확인합니다. 자동 삭제·덮어쓰기·버전 증가를 하지 않습니다. `NPM_TOKEN` 권한·만료와 외부 Trusted Publisher 등록 상태도 별도로 확인합니다. 현재 workflow의 OIDC는 provenance용입니다.

### npm 승인 게시

릴리스 workflow는 npm CLI 11.21.1의 `npm stage publish`를 사용해 검증한 동일 bundle을 provenance와 함께 승인 대기에 등록합니다. workflow 성공은 등록 완료를 뜻하며, npm 공개 완료는 관리자 승인 후 확인합니다.

npm CLI 11.15 이상·Node22.14 이상이 필요합니다. CI의 검증 결과로 VERSION과 NPM_TAG를 설정하고 인증·provenance 환경을 유지한 상태에서 실행합니다.

```bash
node scripts/release-checks.js verify
cd npm
npm stage publish "../build/release/commerce-context-mcp-$VERSION.tgz" --ignore-scripts --provenance --access public --tag "$NPM_TAG"
```

Stage ID·버전·tag·산출물을 확인한 관리자가 npm의 **Staged Packages → Approve**에서 2FA를 완료합니다. 등록만으로 공개되지 않습니다. 승인 후 registry 버전·tag·integrity와 시스템 Java 없는 새 설치·실행을 확인합니다. [npm 공식 안내](https://docs.npmjs.com/cli/v11/commands/npm-stage/)

`runtime-inventory.tsv`는 내장 라이브러리·해시 목록이며 표준 SBOM·취약점 판정이 아닙니다. 로컬 통과, 원격 CI 성공, 실제 게시·배포를 별도 결과로 보고합니다.

## 문제 제보·변경 설명

질문·규칙 ID, 적용 상황, 재현 가능한 입력, 기대 결과와 실제 결과를 적어 주세요. 지식 수정에는 확인한 공식 근거·기준일·조건을 함께 남깁니다. [실무 예시](docs/USAGE_SCENARIOS.ko.md)의 호출 인자는 실제 MCP로 확인하며 회사 고유 자료를 복사하지 않습니다.

하나의 변경은 한 가지 목적에 집중하고, 실행한 검증과 남은 한계를 설명합니다. 커밋·push·게시·배포는 요청된 범위에서만 진행합니다.

## 서버 구조와 연동 계약

처리 흐름은 AI 클라이언트 → STDIO MCP → 검색·체크리스트·검토 → YAML입니다. 지식은 시작할 때 불변 객체로 읽고 외부 LLM·DB·HTTP 서버 없이 검색합니다. 최종 답변과 데이터 전송은 연결한 AI 클라이언트가 처리합니다.

메모리 안의 지식만 다루는 현재 핸들러는 `McpSyncServerCustomizer.immediateExecution(true)`로 STDIO 입력 스레드에서 순서대로 실행합니다. SDK 0.18의 [동시 응답 누락 문제](https://github.com/modelcontextprotocol/java-sdk/pull/935)를 피하면서 한꺼번에 들어온 요청도 모두 응답합니다. MCP smoke는 64개 요청을 동시에 보내는 검사를 4회 반복합니다. 핸들러에 외부 I/O를 추가하거나 전송 방식을 바꿀 때는 이 실행 모델을 다시 검토하세요.

| 위치 | 책임 |
|---|---|
| core/model·port | 지식 모델과 인터페이스 |
| application | 검색·검토 후보·체크리스트 조합 |
| adapter/in/mcp | Tool·Resource·Prompt와 입력 schema 검증 |
| adapter/out/yaml·render | YAML 로딩·검증과 Markdown 표현 |

공개 Tool은 `search_knowledge`, `get_rule`, `get_checklist`, `review_commerce_design`입니다. Resource는 `commerce://catalog`, `commerce://domains/{domain}`, `commerce://rules/{ruleId}`, Prompt는 `review-commerce-api`와 `review-payment-webhook`입니다.

두 검토 Prompt와 Tool 설명은 코드와 함께 사용자가 제공한 업무·실패 상황을 `scenario`에 전달하도록 안내합니다. 없는 계약·정책·결함을 추측하지 않으며, 검토 Prompt의 필드 안내는 실제 검토 응답과 일치해야 합니다. `matchedEvidence`는 검색 일치 단어이며 결함의 입증 자료가 아닙니다.

- 검색·검토 결과는 기본 5개·최대 10개, 체크리스트는 최대 10개 규칙입니다.
- 일반 검색은 NFKC·일부 조사/활용형·별칭을 정규화한 단어 기반 검색입니다. 최대 32개 고유 검색어와 필드별 일치 비율을 사용하고 동점은 domain·category·ID로 정렬합니다.
- 코드 검토는 package/import를 제외하고 원문과 scenario를 독립 검색합니다. 긴 입력은 겹치는 16단어 구간을 최대 32개 추가 검색하며 더 큰 입력은 표본 검색을 표시합니다. 코드 실행·AST 분석은 아닙니다.
- 체크리스트는 조건·신뢰 맥락까지 같은 문항만 중복 제거합니다. JSON·Markdown의 문항과 순서를 보존합니다.
- 검색·규칙·체크리스트의 `responseFormat`은 `json` 또는 기본 `both`입니다. json은 `markdown`을 빈 문자열로 유지하고 search의 json+full은 `fullRules`에 전문을 제공합니다. summary 후보는 `get_rule`로 조건을 확인하고, full에 이미 포함된 같은 규칙은 다시 조회할 필요가 없습니다. 검토에는 이 옵션이 없습니다.
- 검색·검토의 domain은 CSV, 체크리스트는 단일 값입니다. 필수 값·타입·enum·범위·모르는 필터·빈 CSV 요소는 오류로 구분합니다. enum의 공백·대소문자는 정규화합니다.
- 빈 질문·유효한 무관 질문은 옵션 검증 후 정상적인 결과 없음입니다. Tool은 `isError`, Resource는 JSON-RPC 오류로 알리고 다음 유효 요청을 계속 처리합니다.
- 현재 ToolCallback은 text JSON을 반환하며 native `outputSchema`·`structuredContent`·annotations 전환은 미구현입니다.

### 전송·캐시·종료 경계

JAR는 npm 버전과 맞춰 HTTPS로 받고 SHA-256을 검증합니다. 체크섬은 손상 검증이며 배포자 서명을 대신하지 않습니다.

Java stdout은 별도 파이프로 받아 Node 스트림으로 전달합니다. 상속한 stdout의 비차단 상태 때문에 클라이언트가 느릴 때 Java 출력이 잘리지 않도록 하고, 스트림의 backpressure로 전송량을 조절합니다. MCP smoke는 동시 요청의 응답을 잠시 읽지 않는 상황에서도 JSON·UTF-8이 보존되는지 검사합니다.

| 항목 | 현재 제한 |
|---|---|
| 체크섬 | 전체15초·64KiB |
| JAR | 시도당 전체120초·최대3회 |
| 요청 무응답 | 15초, redirect도 전체 제한 공유 |
| JAR 잠금 대기·재획득 | 원래405초 예산 공유, 진행 중 전송 강제 취소 시각은 아님 |
| 전용 JRE 준비 | 최초600초 예산 공유, 전송 시도당120초·최대3회·해제90초 |
| doctor | 다운로드 없음, 런타임·JAR 캐시 둘 다 정상일 때 종료코드0, 나머지1 |
| EOF·종료 | 생성한 Java의 stdin을 닫고 최대2초 유예, 신호는 해당 자식에 전달 |

- 잠금은 PID·호스트·토큰으로 확인하고 죽은 로컬 소유자만 회수합니다. 불명확·외부 호스트·활성 소유자는 자동 삭제하지 않습니다.
- 소유권을 얻기 전 Windows 잠금 생성·확인 중 발생한 `EPERM`은 원래 대기 예산 안에서 최대 3회 재시도를 공유합니다. 읽기 실패를 잠금 부재로 간주하지 않고 소유자를 다시 확인합니다. 계속되는 권한 오류와 다른 오류 코드는 호출자에게 반환합니다.
- 소유권을 잃으면 게시를 중단하고 남은 예산으로 재획득하거나 검증된 승자 캐시를 사용합니다. 중복 전송은 가능하며 공유 디스크의 엄격한 상호 배제를 보장하지 않습니다.
- 임시 파일을 정리하고 신호 종료는 130/143, 일반 종료는 자식 코드를 유지합니다. 전원 중단·실행기 강제 종료에는 정리를 보장하지 않습니다.

## 전용 Java 런타임 정책

런타임 준비는 npm 설치 스크립트 없이 첫 실행과 `download`에서 수행합니다. 정책은 다음과 같습니다.

- 배포판: Eclipse Temurin JRE **21.0.12.1+1**, [공식 릴리스](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1). `npm/lib/runtime-manifest.json`에 OS/CPU별 URL·공식 SHA-256·크기를 고정합니다. 실행 중 latest 조회나 시스템 Java 재사용은 하지 않습니다.
- 라이선스: [OpenJDK GPLv2 + Classpath/Assembly Exception](https://adoptium.net/about/) 및 런타임의 `legal/` 고지를 보존합니다. npm에는 런타임 바이너리를 넣지 않고 공식 공급처에서 받습니다.
- 환경: Windows·macOS·Linux(glibc), x64/ARM64. musl/32비트는 명시적으로 거부합니다. OS `tar`를 사용하며 Windows에서는 System32의 tar를 직접 실행합니다. 해제 대상은 cwd로 전달하고 archive 인자는 상대 경로로 유지합니다. Windows 런타임 경로는 사용자 임시 폴더의 영문 junction을 사용합니다. 유니코드 캐시의 JAR는 소유자 전용 영문 임시 작업 경로로 복사해 실행하고 자식 종료 후 해당 복사본만 제거합니다. 원본 캐시는 유지하며 JAR 한 개 크기의 임시 디스크 여유가 필요합니다. junction은 검증된 설치를 가리키는지 확인하며 관리자 권한·PowerShell·8.3 이름에 의존하지 않습니다. 별칭 폴더도 영문으로 만들 수 없으면 개인용 영문 절대 경로의 `COMMERCE_CONTEXT_CACHE_DIR` 설정을 안내합니다. JVM 진단 로그는 stderr로 보내 JSON-RPC stdout을 보존합니다. PATH·관리자 권한·시스템 JDK 설치를 변경하지 않습니다.
- 캐시: 사용자 홈 `.commerce-context-mcp/runtimes/` 아래 버전·플랫폼별 저장. 고정 해시 확인 후 전체 archive 경로·링크를 사전 검사하고 임시 폴더에 해제합니다. 일반 파일로 향하는 내부 symlink만 허용합니다. 파일별 해시·실행 권한을 저장하고 매번 재검증합니다. 원본 압축 파일도 보관해 오프라인 손상 복구에 사용합니다.
- 복구: 기존 PID/호스트/토큰 잠금을 재사용합니다. 최초 대기 예산600초를 소유권 변경 시에도 유지하며 전송은 시도당120초·최대3회, 해제는90초 이내입니다. 중단된 임시 파일·추출 폴더는 소유권 확인 후 정리합니다. 로그는 stderr이며 자식 Java는 절대 경로로 실행합니다.
- 보안 업데이트: Temurin 보안/패치 릴리스를 확인하여 고정 버전과 6개 자산 해시·크기를 함께 변경하고, 단위 테스트·각 플랫폼의 실제 패키지 smoke 후 새 npm 버전으로 배포합니다. 구버전 캐시는 자동으로 사용하지 않으며 사용 중일 수 있으므로 자동 일괄 삭제하지 않습니다.

`doctor`의 성공은 캐시 무결성 검사 결과입니다. `download`는 선택한 JRE 실행까지 확인하며, 전체 MCP smoke는 서버 연결·도구 호출·종료까지 확인합니다. 압축 원본의 고정 SHA-256을 기준으로 하므로 런타임 보조 `.sha256` 파일만 유실돼도 오프라인 재설치할 수 있습니다. 서버 JAR는 릴리스의 별도 `.sha256`이 필요합니다.

## AI 답변 검증

서버 회귀 테스트와 클라이언트의 도구 선택·최종 답변 확인을 구분합니다. [ai-workflows.json](npm/test/fixtures/ai-workflows.json)의 합성 사례를 사용하고, 회사 코드·고객 정보·실제 키는 넣지 않습니다. 일반 실행이나 CI에서 유료 LLM을 자동 호출하지 않습니다.

1. 각 사례를 새 대화에서 실행하고 실제 도구 호출·인자·결과와 최종 답변을 JSONL로 기록합니다.
2. 모델·클라이언트·실행 번호와 실제 검토자·검토일을 기록하고, 모든 사례를 포함합니다.
3. 사람이 검토하면 `humanChecks`, AI가 검토하면 `reviewType: "agent"`와 `agentChecks`를 사용합니다. AI 판정에는 최종 답변의 실제 인용과 근거를 남깁니다.
4. 적용 조건·근거 보존, 잘못된 확정 판단, 부분 결과 설명과 오류 복구를 확인합니다. 미완료 실행이나 검토 누락을 통과로 기록하지 않습니다.

기록에는 `taskId`, `model`, `client`, `run`, `toolCalls`, `finalAnswer`, `reviewedBy`, `reviewedAt`을 포함합니다. `agentChecks`의 각 항목에는 `passed`, `quote`, `rationale`을 기록합니다.

저장소 루트에서 실제 검토 기록의 경로로 실행합니다.

```powershell
npm.cmd --prefix npm run test:ai-eval -- "C:\path\reviewed-transcripts.jsonl"
```

종료코드 0은 제공 기록과 사례 검증 통과, 1은 실패·잘못된 입력, 2는 검토·사례 누락입니다. 채점기는 검토자의 신원이나 판정의 정확성을 증명하지 않습니다.

## 다음 개선

**JDK를 직접 설치하지 않는 npm 실행과 Java 21 기준 빌드는 구현했습니다.** 다음 배포 과제는 아래의 클라이언트 플러그인 설치 지원입니다.

### 플러그인 설치형 배포

현재 제공하는 배포는 **npm 실행형**입니다. 후속 설치형 배포의 목표는 AI 클라이언트의 플러그인 추가 과정에서 MCP 실행 설정을 등록하고 활성화할 수 있게 하는 것입니다. **아직 플러그인 설치 패키지를 제공하지 않습니다.**

| 항목 | 계획과 완료 기준 |
|---|---|
| 설치 경험 | 플러그인 추가 → 권한 확인 → 활성화 → MCP 도구 4개 연결 확인. 사용자가 MCP 설정 파일을 직접 편집하는 단계 줄이기 |
| 패키지 구성 | 지원 클라이언트의 공식 플러그인 manifest·MCP 등록 설정·설치/업데이트/제거 안내. 검증한 npm 버전을 기존 런처로 실행 |
| 실행 환경 | Node.js 22 이상은 사용자가 준비. JDK/JRE 직접 설치 없이 기존 전용 JRE 21 다운로드·검증·캐시 재사용 |
| 호환성 | 공식 배포·등록 방식을 먼저 확인하고 지원 클라이언트 한 곳부터 구현. 다른 클라이언트의 지원 여부와 설정 차이는 별도 기록 |
| 검증 | 새 클라이언트 프로필에서 설치·활성화·재시작·업데이트·제거 확인. 기존 MCP 설정 보존, stdout JSON-RPC·오류 복구·종료 확인 |

Windows `.exe`/`.msi`나 macOS `.dmg` 같은 독립 OS 설치 프로그램, Node.js 내장 배포는 현재 계획에 포함하지 않습니다. 해당 형태가 필요하면 지원 OS·런타임 포함 범위·업데이트 방식을 별도로 정합니다.

MCP가 검토하는 사용자 프로젝트까지 Java 21로 바꿀 필요는 없습니다.

native MCP 메타데이터는 기존 도구 중복 없이 text 응답 호환성과 실제 이득을 확인한 뒤 검토합니다. 비공개 지식은 공개 저장소·배포 파일 밖으로 분리할 때 설계합니다. 영어 지원·국가별 필터·유료화·Private 전환은 이번 범위에 추가하지 않습니다.

로컬 검증, 원격 CI·플랫폼별 실행, AI 답변 검증, 공개 GitHub JAR 다운로드·npm 게시/provenance는 버전과 산출물별로 구분해 기록합니다. 커밋·push·게시·배포는 별도 요청 없이 진행하지 않습니다.
