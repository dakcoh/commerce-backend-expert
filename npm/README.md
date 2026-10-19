# commerce-context-mcp

AI 코딩 도구에서 한국 이커머스와 Java/Spring의 설계 규칙을 검색하는 로컬 MCP 서버입니다.

## 실행 환경

현재 작업본은 **Node.js 22 이상 + Java 17 이상 + 로컬 STDIO MCP 클라이언트**가 필요합니다. Java21도 현재 JAR를 실행할 수 있습니다.

**Java 자동 준비는 예정 기능입니다.** 현재는 Java를 직접 준비해야 하며, 이 작업본 안내와 이미 게시된 npm 버전의 동작은 다를 수 있습니다.

```bash
node -v
java -version
npx -y commerce-context-mcp doctor
```

`java: ok`이면 Java를 찾았습니다. `cached jar: missing`은 첫 실행 전에는 정상입니다.

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

첫 실행은 버전에 맞는 JAR·체크섬을 받아 SHA-256을 확인하고 사용자 홈의 `.commerce-context-mcp`에 저장합니다. 이후 검증된 캐시를 재사용합니다. 현재는 JAR만 자동으로 받고 Java는 직접 준비합니다.

서버에 별도 LLM API 키·DB는 필요하지 않습니다. AI 사용료와 데이터 전송 범위는 연결한 클라이언트의 조건·설정에 따릅니다. 검색 일치도는 사실성 점수가 아니며, 검토 후보·결과 없음으로 결함 유무를 확정하지 마세요. `partial`·`analysisTruncated`가 참이면 범위를 좁혀 추가 확인합니다.

[업무 예시·결과 해석·70개 규칙](https://github.com/dakcoh/commerce-context-mcp/blob/master/docs/USAGE_SCENARIOS.md)

## 문제 해결

| 증상 | 다음 행동 |
|---|---|
| `Java 17 or newer is required` | Java 설치 후 새 터미널에서 확인하고 AI 앱도 같은 Java를 찾도록 설정 |
| `npx`·`java`를 찾지 못함 | Node·Java 설치와 앱의 PATH·명령 실행 방식 확인 후 재시작 |
| 실행했는데 끝나지 않음 | MCP 입력 대기 상태일 수 있음. 클라이언트의 실행 명령으로 등록 |
| 다운로드·체크섬 오류 | GitHub Release 자산 접근 확인 후 재실행. 검증을 끄지 않음 |
| 잠금 시간 초과 | 같은 버전의 다른 다운로드 확인. 활성 잠금을 삭제하지 않음 |
| AI가 도구를 쓰지 않음 | 도구 허용·연결 상태 확인 후 서버를 참고하도록 명시적으로 요청 |

캐시 복구는 관련 MCP 클라이언트·다운로드 프로세스를 모두 종료한 뒤 해당 버전의 JAR·`.sha256`만 제거하고 `download`를 실행합니다. 잠금 시간 초과가 계속되면 활성 다운로드가 없는 것을 확인한 후 해당 버전 `.jar.lock`만 제거하세요. 다른 폴더·버전을 일괄 삭제하지 않습니다.

## 명령과 다음 개선

```bash
npx -y commerce-context-mcp --help
npx -y commerce-context-mcp --version
npx -y commerce-context-mcp download
```

`download`는 Java를 확인하고 JAR만 준비한 뒤 종료합니다. 인자 없이 실행하면 MCP 연결을 기다립니다. 전용 Java21 런타임 자동 준비와 플러그인 설치형 배포는 아직 미구현입니다.

[프로젝트 소개](https://github.com/dakcoh/commerce-context-mcp) · [업그레이드·개선 계획](https://github.com/dakcoh/commerce-context-mcp/blob/master/CONTRIBUTING.md) · [MIT](LICENSE)
