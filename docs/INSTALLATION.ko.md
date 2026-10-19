# commerce-context-mcp

[English](../npm/README.md) · 한국어

AI 코딩 도구에서 한국 이커머스와 Java/Spring의 설계 규칙을 검색하는 로컬 MCP 서버입니다.

문서는 영어와 한국어로 제공하며 지식 카탈로그는 현재 한국어입니다. 서버는 질의를 번역하지 않습니다. 영어로 질문한다면 연결한 AI가 관련 한국어 검색어로 조회하고 원하는 언어로 설명하도록 요청하세요. 영어 질의의 검색 품질은 현재 회귀 검증으로 입증하지 않았습니다.

## 실행 환경

0.2.0은 **Node.js 22 이상 + 로컬 STDIO MCP 클라이언트**가 필요합니다. 사용자가 JDK/JRE를 설치하거나 JAVA_HOME을 설정할 필요가 없습니다. 시스템 Java가 있어도 사용하지 않습니다.

**첫 실행에서 전용 Temurin JRE 21.0.12.1+1을 자동 준비합니다.** npm 설치 스크립트에 의존하지 않으므로 `--ignore-scripts` 설치도 지원합니다. 이 기능은 **0.2.0부터 제공**합니다. 이전 버전 사용자는 패키지를 갱신하세요. 소스에서 검증할 때는 [기여 가이드의 로컬 패키지 절차](https://github.com/dakcoh/commerce-context-mcp/blob/master/CONTRIBUTING.ko.md#로컬에서-검증하기)를 따릅니다.

구현 대상은 Windows·macOS·Linux(glibc)의 x64/ARM64입니다. 각 플랫폼의 실제 실행·복구·종료는 릴리스 CI에서 검사합니다. Node 프로세스의 CPU 아키텍처에 맞춥니다. Linux musl(Alpine)과 32비트는 지원하지 않습니다. 압축 해제용 `tar`가 필요하며 Windows 10/11·macOS에서는 기본 제공됩니다. Windows의 유니코드 런타임 경로는 개인 임시 폴더의 영문 junction으로 연결합니다. 한글·보충 문자가 있는 캐시의 서버 JAR는 영문 임시 작업 경로에 복사해 실행하고 종료 후 정리합니다. 관리자 권한·PowerShell·8.3 이름 생성은 필요하지 않습니다.

```bash
node -v
npx -y commerce-context-mcp download
npx -y commerce-context-mcp doctor
```

`doctor`는 다운로드 없이 전용 런타임과 서버 JAR의 캐시를 검사합니다. **두 캐시가 모두 검증되면 종료코드 0**, 미준비·손상 상태면 1입니다. 첫 실행 전 `not prepared`·`cached jar: missing`은 준비가 필요하다는 뜻이며, `download` 실행 후 다시 확인하세요. OS 라이브러리·실제 실행 가능 여부는 `download` 또는 서버 기동에서 확인합니다.

## 연결

사용하는 클라이언트의 방법 하나를 선택합니다.

**Codex CLI** — [공식 안내](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

```bash
codex mcp add commerce-context -- npx -y commerce-context-mcp
```

**Claude Code** — [공식 안내](https://code.claude.com/docs/en/mcp)

```bash
claude mcp add --transport stdio commerce-context -- npx -y commerce-context-mcp
```

**Cursor·Claude Desktop 등 JSON 설정을 사용하는 앱**

기존 `mcpServers`에 다음 항목을 병합합니다. 설정 위치·실행 방식은 클라이언트 안내를 따르세요.

```json
{
  "mcpServers": {
    "commerce-context": {
      "command": "npx",
      "args": ["-y", "commerce-context-mcp"]
    }
  }
}
```

연결을 새로고침하거나 앱을 재시작하고 도구 활성화 상태를 확인합니다. CLI와 실제 사용하는 앱의 설정이 같은지도 확인하세요.

## 사용

> “commerce-context를 참고해 이 결제 웹훅의 서명 검증·중복 처리·장애 복구를 검토해줘. 적용 조건과 추가 확인할 사항도 알려줘.”

첫 실행은 버전에 맞는 JAR·체크섬을 받아 SHA-256을 확인하고 사용자 홈의 `.commerce-context-mcp`에 저장합니다. 이후 검증된 캐시를 재사용합니다. 전용 JRE는 같은 캐시의 `runtimes/`에 보관하며 고정 SHA-256으로 다운로드를 확인합니다. 압축을 풀 때 경로 탈출을 차단하고, 이후에는 파일별 해시를 검사해 손상된 설치를 복구합니다. 준비 완료 후에는 런타임·JAR 다운로드 없이 재실행할 수 있습니다.

서버에 별도 LLM API 키·DB는 필요하지 않습니다. AI 사용료와 데이터 전송 범위는 연결한 클라이언트의 조건·설정에 따릅니다. 검색 일치도는 사실성 점수가 아니며, 검토 후보·결과 없음으로 결함 유무를 확정하지 마세요. `partial`·`analysisTruncated`가 참이면 범위를 좁혀 추가 확인합니다.

[업무 예시·결과 해석·70개 규칙](https://github.com/dakcoh/commerce-context-mcp/blob/master/docs/USAGE_SCENARIOS.ko.md)

## 문제 해결

| 증상 | 다음 행동 |
|---|---|
| `Managed Java ... cannot run` | 지원 OS/CPU·OS 라이브러리를 확인하고 `download` 재실행. 잠긴 파일이 있으면 기존 MCP 종료 |
| `Cannot launch managed Java from this Unicode path` | 임시 경로까지 영문 별칭을 만들 수 없는 환경입니다. 쓰기 가능한 개인용 영문 경로를 `COMMERCE_CONTEXT_CACHE_DIR`로 지정하고 재실행 |
| `Cannot extract Java runtime` | OS의 `tar` 설치·실행 가능 여부와 디스크 여유 공간 확인 |
| `Unsupported Java runtime platform` | 지원되는 OS·CPU와 Node 아키텍처 확인 |
| `npx`를 찾지 못함 | Node 설치와 앱의 PATH·명령 실행 방식 확인 후 재시작 |
| 실행했는데 끝나지 않음 | MCP 입력 대기 상태일 수 있음. 클라이언트의 실행 명령으로 등록 |
| 다운로드·체크섬 오류 | GitHub Release 자산 접근 확인 후 재실행. 검증을 끄지 않음 |
| 잠금 시간 초과 | 같은 버전의 다른 다운로드 확인. 활성 잠금을 삭제하지 않음 |
| AI가 도구를 쓰지 않음 | 도구 허용·연결 상태 확인 후 서버를 참고하도록 명시적으로 요청 |

우선 `download`를 다시 실행하세요. 손상된 런타임 파일은 캐시의 고정 해시 압축에서 복구하며, 압축까지 손상되면 다시 받습니다. 정상 압축이 남아 있으면 체크섬 보조 파일이 없어도 오프라인 런타임 복구가 가능합니다. 오프라인 실행에는 서버 JAR와 그 `.sha256`도 준비되어 있어야 합니다.

자동 복구가 실패하면 관련 MCP 클라이언트·다운로드 프로세스를 모두 종료한 뒤 `doctor`가 출력한 경로만 확인하세요. `runtime executable`은 실행 파일 경로이므로 그 파일이 속한 `runtimes/temurin-<버전>-<OS>-<CPU>` 폴더가 해당 설치입니다. 해당 버전 설치 폴더 또는 JAR·`.sha256`만 제거하고 `download`를 재실행합니다. 잠금 오류가 계속되면 활성 다운로드가 없는 것을 확인한 후 해당 버전의 `.lock`만 제거하세요. 다른 폴더·버전을 일괄 삭제하지 않습니다.

Windows의 사용자 임시 폴더에도 영문 별칭을 만들 수 없어 자동 준비가 실패한 경우에만 캐시 위치를 바꿉니다. 경로는 자신에게 쓰기 권한이 있는 개인용 영문 절대 경로로 바꾸고, MCP 클라이언트의 실행 환경에도 같은 변수를 설정하세요. 공유·공용 쓰기 폴더는 사용하지 않습니다.

```powershell
$env:COMMERCE_CONTEXT_CACHE_DIR="C:\path\to\private-cache"
npx -y commerce-context-mcp download
```

## 명령과 다운로드 시점

```bash
npx -y commerce-context-mcp --help
npx -y commerce-context-mcp --version
npx -y commerce-context-mcp download
```

npm 설치는 실행기 파일만 설치하고, `download`는 전용 Java 런타임과 JAR를 준비한 뒤 종료합니다. 인자 없이 실행해도 같은 준비 과정을 거친 후 MCP 연결을 기다립니다. 플러그인 설치형 배포는 후속 과제입니다.

Windows x64 로컬 측정(2026-10-19): JRE 다운로드 49.0 MB, 압축 파일을 포함한 런타임 캐시 약 200.6 MB, 최초 준비 약 2.6초, 재검증 약 0.4초였습니다. 서버 JAR 용량·시작 시간은 별도이며 네트워크·디스크에 따라 달라집니다.

런타임은 [Eclipse Temurin 공식 배포](https://github.com/adoptium/temurin21-binaries/releases/tag/jdk-21.0.12.1%2B1)에서 받습니다. 프로젝트 코드는 MIT이며 런타임에는 [OpenJDK 라이선스](https://adoptium.net/about/)와 압축에 포함된 `legal/` 고지가 별도로 적용됩니다. 런타임 보안 업데이트는 고정 버전·체크섬을 갱신한 npm 릴리스로 제공합니다.

[프로젝트 소개](../README.ko.md) · [업그레이드·개선 계획](../CONTRIBUTING.ko.md) · [MIT](../LICENSE)
