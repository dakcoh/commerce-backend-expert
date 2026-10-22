# Commerce Backend Expert

[English](README.md) · 한국어

[![CI](https://github.com/dakcoh/commerce-context-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/dakcoh/commerce-context-mcp/actions/workflows/ci.yml) · [MIT](LICENSE)

**한국 이커머스 백엔드의 설계·구현·리팩터링·코드 리뷰·장애 분석을 돕는 Markdown 스킬입니다.**

AI가 실제 코드와 업무 조건을 먼저 확인하고, 필요한 파트의 지침만 읽어 요청한 개발 작업에 적용하도록 안내합니다. 주문·재고·결제·쿠폰·정산·Java/Spring의 규칙 70개를 제공합니다.

스킬 자체에는 Java·Node.js 설치, MCP 서버 실행이나 별도 API 키가 필요하지 않습니다. 문서를 읽고 개발 도구를 사용할 수 있는 AI 클라이언트가 필요하며, 사용자 프로젝트의 빌드·테스트 요구사항은 해당 프로젝트를 따릅니다.

## 사용하기

현재는 **저장소의 스킬 문서를 직접 읽는 방식**으로 사용합니다. 설치형 플러그인과 자동 활성화는 아직 검증하지 않았습니다.

1. [대표 SKILL.md](skills/commerce-backend-expert/SKILL.md)를 AI가 읽을 수 있게 제공합니다. 폴더를 옮긴다면 `commerce-backend-expert/` 전체를 함께 옮깁니다.
2. 관련 프로젝트와 업무 조건을 제공하고 요청한 작업을 명확히 적습니다.
3. AI가 읽은 규칙·코드 위치·변경 내용·실행한 테스트와 미확인 조건을 확인합니다.

예를 들어 대표 SKILL.md 경로를 명시하고 다음처럼 요청합니다.

> 이 스킬을 읽고 내 프로젝트의 결제 웹훅을 검토해줘. 호출자·상위 검증·저장소까지 확인하고, 적용되는 규칙과 실제 결함·추가 확인 사항을 구분해줘.

| 작업 | 요청 예시 |
|---|---|
| 설계 | “예약 없이 DB에서 즉시 차감하는 재고와 결제 응답 유실 후 복구 경계를 설계해줘.” |
| 구현 | “날짜·순번 업무키로 중복 요청을 막고, 자정 이후 재시도와 요청 내용 충돌을 검증해줘.” |
| 리팩터링 | “재고 차감 코드를 정리하되 반환·예외·트랜잭션·부수 효과 순서를 유지해줘.” |
| 장애 분석 | “승인 응답이 유실됐어. 원 거래와 상태 이력을 기준으로 확인할 순서를 정리해줘.” |

## 필요한 파트만 읽습니다

대표 스킬 → 관련 파트 색인 → 필요한 규칙 순서로 읽습니다. 전체 규칙을 매 요청에 넣지 않습니다.

| 파트 | 다루는 내용 | 규칙 |
|---|---|---:|
| [상품·주문·회원·배송](skills/commerce-backend-expert/references/commerce/INDEX.md) | 가격·상태·혜택·권한·운영 정합성 | 20 |
| [재고·동시성](skills/commerce-backend-expert/references/inventory/INDEX.md) | 즉시 차감·예약·멱등성·보상 | 8 |
| [결제·환불](skills/commerce-backend-expert/references/payment/INDEX.md) | 승인·웹훅·미확정 결과·부분 환불 | 7 |
| [쿠폰·프로모션](skills/commerce-backend-expert/references/coupon/INDEX.md) | 유효성·발급 한도·할인 배부·복원 | 6 |
| [정산·지급](skills/commerce-backend-expert/references/settlement/INDEX.md) | 기준일·명세·공제·보류·대사 | 9 |
| [Java/Spring 구현](skills/commerce-backend-expert/references/spring-commerce/INDEX.md) | 트랜잭션·JPA·이벤트·배치·재시도 | 20 |

가이드는 한영으로 제공하지만 지식 문서는 한국어입니다. 일반 화면 스타일 수정이나 마케팅·판매 전략에는 이 스킬을 적용하지 않습니다.

## 클라이언트별 구성

공통 [plugin.json](plugin.json)과 아래 진입 설정을 준비했습니다. 모두 같은 `skills/`를 사용하며 지식을 복제하지 않습니다. 개발용 버전은 `0.3.0-dev.0`이고 아직 게시하지 않았습니다. **형식·경로 검증과 실제 클라이언트 설치·활성화는 별도입니다.**

| 클라이언트 | 구성 |
|---|---|
| Codex | [.codex-plugin/plugin.json](.codex-plugin/plugin.json)의 스킬 등록 |
| Claude Code | [.claude-plugin/plugin.json](.claude-plugin/plugin.json)의 스킬 등록 |
| Cursor | [.cursor-plugin/plugin.json](.cursor-plugin/plugin.json)과 [선택 적용 규칙](.cursor/rules/commerce-backend.mdc) |
| OpenClaw | 공통 번들 또는 [외부 스킬 경로 설정 예시](.openclaw/skills.example.json). 예시의 절대경로를 바꿔 기존 설정에 병합하며, 이 파일 자체가 자동 적용되지는 않습니다. |

[Claude](hooks/claude.json)·[Cursor](hooks/cursor.json)용 훅은 **스킬 지식을 편집하는 개발자의 선택적 검사**입니다. 기본 등록하지 않으며 일반 사용자 프로젝트의 코드는 검사하지 않습니다. 사용할 때는 Node.js 22 이상과 [훅 설정 절차](CONTRIBUTING.ko.md#선택적-개발-훅)가 필요합니다. 스킬 사용에는 이 훅이 필요하지 않습니다.

## 결과를 판단할 때

규칙의 적용 조건·예외·근거 범위와 검토 상태를 함께 확인하세요. `active`는 사용 중이라는 뜻이며 정확성 인증이 아닙니다. `needs-review` 19개는 추가 검토 대상입니다. `verifiedBy`·`lastReviewedAt`이 `not-recorded`이면 검토 기록이 없습니다.

이관본은 합성 개발 업무 7개로 판단과 작업 범위를 평가했습니다. 실제 DB·PG 운영 동작, 설치 후 자동 선택, 모든 업무의 정확성을 입증한 결과는 아닙니다. 토큰·응답 속도 개선도 주장하지 않습니다. [검증 방법과 범위](CONTRIBUTING.ko.md#검증)

## 기존 MCP 사용자

이 브랜치는 **Markdown을 유일한 지식 원본으로 사용하는 구조**로 전환했습니다. 기존 YAML·Java MCP·Gradle·npm 런처와 JRE 다운로드 경로는 제거했습니다. 예전 MCP 설정으로 이 브랜치를 실행할 수 없습니다.

기존 공개 v0.2.2의 소스와 사용법은 [v0.2.2 태그](https://github.com/dakcoh/commerce-context-mcp/tree/v0.2.2)에 있으며 로컬 `legacy/v0.2.2` 브랜치로도 보존합니다. 이번 소스 변경은 이미 게시한 npm/JAR나 태그를 수정하지 않습니다. 새 플러그인 게시·설치·업데이트 안내는 배포를 검증한 뒤 제공합니다.

문서·지식을 고치거나 검사하려면 [기여 가이드](CONTRIBUTING.ko.md)를 확인하세요.
