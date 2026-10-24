# Tests

자동 테스트는 동작별 `*.test.js`로 관리합니다. Node.js 기본 테스트 도구와 assert를 사용하며, LLM·외부 서비스·사용자 프로필 없이 실행합니다.

```bash
npm ci --ignore-scripts
npm run check
npm test
```

| 파일 | 확인하는 동작 |
|---|---|
| [knowledge.test.js](knowledge.test.js) | 규칙 파싱, 필수 지침, 근거·검토 상태, 날짜, 이관 필드 보존 |
| [skills.test.js](skills.test.js) | YAML frontmatter, 독립 설치, 로컬 링크·앵커·경로 경계 |
| [plugins.test.js](plugins.test.js) | 클라이언트 manifest·marketplace, 문서, 호환성·제거된 런타임 경로 |
| [hooks.test.js](hooks.test.js) | 세션 상태·명령·입력 제한·실패 처리, 선택적 지식 편집 검사 |
| [evaluation.test.js](evaluation.test.js) | 모델 평가용 파일 읽기의 실제 경로·크기 제한 |

[helpers.js](helpers.js)는 임시 폴더·스킬 복사·저장소 복사본을 준비합니다. 검증할 분기와 기대 결과는 각 테스트에 둡니다. 새 동작은 해당 파일에 추가하고, 기존 항목의 정상·실패 조건을 함께 확인합니다.

한 파일만 실행할 수도 있습니다.

```bash
node --test tests/hooks.test.js
```

실제 모델 적용은 [benchmarks/](../benchmarks/README.md), 모델을 부르지 않는 플러그인 설치·갱신·제거 시험은 [기여 가이드](../CONTRIBUTING.ko.md#클라이언트-확인)를 참고하세요. 두 시험은 기본 `npm test`와 분리합니다.

[Claude 훅 검사](../scripts/smoke-claude-hooks.js)는 실제 Claude Code와 localhost 응답 대역으로 시작·명령·재개·압축·문맥 전달을 확인합니다. 클라이언트 실행 파일이 필요한 별도 검사이며 기본 테스트 수에 합산하지 않습니다.

[OpenClaw 발견 검사](../scripts/smoke-openclaw.js)는 실제 CLI에서 extraDirs 개별·동시 설치와 번들 링크 설치·제거를 확인합니다. 인증·모델·게이트웨이는 사용하지 않으며 기본 테스트 수와 모델 적용 평가에 합산하지 않습니다.

[격리 런타임 사례 15개](../validation/runtime/README.md)는 실제 PostgreSQL·Redis·Spring/JPA를 사용하는 별도 개발 검증입니다. 실제 PG·회사 정책을 검증한 결과는 아니며 기본 Node.js 검사에 Java·DB 의존성을 추가하지 않습니다. [Cursor probe](../scripts/probe-cursor.js)는 세 설치 조합의 인증 제한을 기록하며, 스킬 발견을 통과 처리하지 않습니다.

English: Tests are grouped by behavior, use Node's built-in runner, and run offline. Shared helpers create disposable fixtures; assertions stay in their test files. Model evaluations live in `benchmarks/` and are never part of the default test command.
