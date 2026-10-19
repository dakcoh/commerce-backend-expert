# Commerce Context MCP

[English](README.md) · 한국어

[![npm version](https://img.shields.io/npm/v/commerce-context-mcp)](https://www.npmjs.com/package/commerce-context-mcp)
[![CI](https://github.com/dakcoh/commerce-context-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/dakcoh/commerce-context-mcp/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/commerce-context-mcp)](LICENSE)

**AI 코딩 도구가 한국 이커머스의 설계 기준을 찾아보고 코드 검토에 활용하도록 돕는 MCP 서버입니다.**

재고·결제·쿠폰·정산·주문·배송·회원·Java/Spring의 70개 규칙을 제공합니다. 자연어로 질문하면 연결한 AI가 관련 지침을 조회하고, 적용 조건과 예외를 확인하는 데 사용할 수 있습니다.

문서는 영어와 한국어로 제공하지만 지식 카탈로그는 현재 한국어입니다. 서버는 질의를 번역하지 않습니다. 영어로 질문할 때는 연결한 AI가 관련 한국어 검색어로 도구를 조회하고 원하는 언어로 설명하도록 요청하세요. 영어 질의의 검색 품질은 현재 회귀 검증으로 입증하지 않았습니다.

## 어떤 일을 도와주나요?

| 고민 | 요청 예시 |
|---|---|
| 재고 초과 판매 | “예약 없이 DB에서 재고를 차감하는 설계를 검토해줘.” |
| 결제 결과 미확정 | “PG 응답이 유실됐을 때 조회·재시도 흐름을 확인해줘.” |
| 중복 웹훅 | “서명 검증과 중복 이벤트 처리가 빠진 곳을 찾아줘.” |
| 부분 환불 | “쿠폰·포인트 배부와 반올림을 보존하는지 검토해줘.” |
| 정산 차이 | “확정 명세와 실제 지급액을 대사할 기준을 정리해줘.” |

이 서버는 설계 지침을 제공하며 주문·결제·환불을 실행하지 않습니다. 특정 회사의 업무 정책을 공통 정답으로 가정하지 않습니다.

## 시작하기

0.2.0의 요구사항은 **Node.js 22 이상 + 로컬 STDIO MCP를 지원하는 AI 클라이언트**입니다.

> **0.2.0부터 전용 Java 런타임을 자동 준비합니다.** 이전 버전 사용자는 실행 패키지를 갱신하세요. 소스에서 확인하려면 [로컬 패키지 검증](CONTRIBUTING.ko.md#로컬에서-검증하기) 절차를 사용합니다.

사용자는 JDK를 별도로 설치할 필요가 없습니다. npm 설치에는 Java가 필요하지 않으며, 첫 실행에 전용 Java 21 런타임을 다운로드·검증하고 캐시합니다. 시스템 Java·JAVA_HOME·PATH는 변경하지 않습니다.

다음 명령으로 런타임과 서버를 미리 준비하고 확인합니다.

```bash
node -v
npx -y commerce-context-mcp download
npx -y commerce-context-mcp doctor
```

사용 중인 클라이언트에 등록합니다.

**Codex CLI**

```bash
codex mcp add commerce-context -- npx -y commerce-context-mcp
```

**Claude Code**

```bash
claude mcp add --transport stdio commerce-context -- npx -y commerce-context-mcp
```

JSON 설정을 사용하는 클라이언트와 연결 오류는 [설치 가이드](docs/INSTALLATION.ko.md)를 확인하세요. 등록 후 연결 상태를 확인하고 새 대화에서 질문합니다.

> “commerce-context의 규칙을 참고해서 이 결제 웹훅 코드를 검토해줘. 적용 조건과 추가 확인할 사항도 알려줘.”

npm 설치 자체는 런타임을 내려받지 않습니다. 첫 실행이나 `download`에서 전용 Java 런타임과 서버 JAR를 내려받고 검증합니다. 첫 연결의 다운로드 대기를 줄이려면 위 `download` 명령으로 미리 준비하세요. 이후에는 검증된 캐시를 재사용합니다. 서버에 별도의 LLM API 키는 필요하지 않으며, 연결한 AI 클라이언트의 이용 조건은 해당 서비스에 따릅니다.

## 결과는 이렇게 읽으세요

| 표시 | 의미와 다음 행동 |
|---|---|
| `matchConfidence`, `queryCoverage` | 질문과 규칙의 검색 일치도. 사실성 점수는 아닙니다. |
| `project-guidance` | 프로젝트가 관리하는 지침. 독립적인 외부 검증 자료는 아닙니다. |
| `needs-review` | 적용 조건·근거·검토 기록을 더 확인하세요. |
| `verifiedBy`, `lastReviewedAt` | 실제 검토 기록. 없으면 JSON에서 `null`입니다. |
| `partial: true` | 체크리스트 일부만 반환했습니다. 시나리오를 나눠 추가 확인하세요. |
| `analysisTruncated: true` | 큰 입력의 일부 구간을 검색했습니다. 관심 코드로 좁혀 다시 요청하세요. |

`active`는 카탈로그에서 사용 중이라는 뜻입니다. 검색 후보 없음이나 검토 후보 반환만으로 결함 유무를 확정하지 마세요. PG 계약·법률·세무·보안 판단에는 현재 적용되는 공식 자료와 실제 코드·운영 환경 확인이 필요합니다.

## 사용할 수 있는 도구

| 도구 | 용도 |
|---|---|
| `search_knowledge` | 질문에 맞는 규칙 찾기 |
| `get_rule` | 규칙 전문·적용 조건·예외·근거 확인 |
| `get_checklist` | 업무별 확인 항목 받기 |
| `review_commerce_design` | 설계·API·DDL·코드 조각의 검토 후보 찾기 |

클라이언트가 도구를 호출하므로 사용자가 매번 Tool 이름을 입력할 필요는 없습니다. 검색·규칙·체크리스트는 `responseFormat: "json"`으로 Markdown 중복을 줄일 수 있습니다. 실제 호출 예시는 [실무 시나리오](docs/USAGE_SCENARIOS.ko.md)에 있습니다.

## 현재 제공 범위와 다음 개선

현재는 로컬 STDIO 방식으로 동작합니다. 지식 검색 자체는 외부 LLM·DB·HTTP 서버를 사용하지 않으며, 연결한 AI 클라이언트가 도구 결과를 활용합니다. 사용자 입력과 도구 결과가 AI 제공자에게 전달되는 범위는 클라이언트 설정에 따릅니다.

**사용자가 JDK를 직접 설치하지 않아도 실행**할 수 있습니다. Windows·macOS·Linux(glibc)의 x64/ARM64에서 전용 Temurin JRE 21을 준비합니다. 압축 해제에는 OS의 `tar`가 필요합니다(Windows 10/11·macOS 기본 제공). 빌드에는 JDK 21이 필요하며 플러그인 설치형 배포는 후속 과제입니다. [다음 개선](CONTRIBUTING.ko.md#다음-개선)

## 더 알아보기

- [설치·연결·문제 해결](docs/INSTALLATION.ko.md)
- [사용 가이드 — 업무 예시·결과 해석·70개 규칙](docs/USAGE_SCENARIOS.ko.md)
- [기여 가이드 — 개발·평가·개선 계획·릴리스](CONTRIBUTING.ko.md)

## 공개 범위와 라이선스

[MIT](LICENSE)로 제공합니다. 현재 기본 YAML은 소스와 배포 JAR에 포함되므로 공개 가능한 범용 지식만 담습니다. 회사별 정책·계약·내부 자료는 추가하지 마세요. 비공개 지식의 별도 저장·로딩은 추후 분리 대상입니다.
