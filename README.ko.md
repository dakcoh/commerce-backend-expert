# Commerce Backend Expert

[English](README.md) · 한국어

[![CI](https://github.com/dakcoh/commerce-backend-expert/actions/workflows/ci.yml/badge.svg)](https://github.com/dakcoh/commerce-backend-expert/actions/workflows/ci.yml) · [MIT](LICENSE)

**한국 이커머스 백엔드의 설계·구현·리팩터링·코드 리뷰·장애 분석을 돕는 Markdown 스킬·훅 플러그인입니다.**

AI가 실제 코드와 업무 조건을 먼저 확인하고, 필요한 파트의 지침만 읽어 요청한 개발 작업에 적용하도록 안내합니다. 주문·재고·결제·쿠폰·정산·Java/Spring의 규칙 70개를 제공합니다.

문서 스킬만 사용하면 Java·Node.js 설치, MCP 서버 실행이나 별도 API 키가 필요하지 않습니다. 플러그인의 세션 훅에는 Node.js 24.22.1 LTS를 사용하세요. Node.js 22.23.4에서도 호환성을 검사합니다. AI 클라이언트의 이용 조건과 사용자 프로젝트의 빌드·테스트 요구사항은 각각 해당 환경을 따릅니다.

## 어떤 검토를 돕나요?

주문 실결제액이 20,009원이고, X 상품 첫째 단위의 환불 6,669원이 미확정인 상황을 예로 들 수 있습니다. 새 업무키로 X 전체 13,339원을 환불하면 합계 20,008원은 주문 한도 안에 있지만, 같은 상품 수량을 다시 환불하게 됩니다.

이 스킬은 주문 총액뿐 아니라 라인·개별 수량의 점유, 미확정 거래, 요청 지문, 복원 시점을 함께 추적하도록 안내합니다. [합성 입력](benchmarks/fixtures/refund.js)과 [평가 방법·기록](benchmarks/README.md)을 공개합니다. 실제 DB·PG 검증이나 미사용 대비 품질 향상을 입증한 예시는 아닙니다.

## 사용하기

### 스킬만 설치

[대표 스킬](skills/commerce-backend-expert/SKILL.md)은 상세 규칙 70개를 포함합니다. [결제·환불 리뷰 스킬](skills/commerce-review/SKILL.md)은 독립적인 리뷰 절차를 제공하며 단독 설치할 수 있습니다. 함께 제공되면 리뷰에서 필요한 상세 규칙도 선택할 수 있습니다.

```bash
npx skills add dakcoh/commerce-backend-expert --skill commerce-backend-expert
```

리뷰 절차만 필요하면 `--skill commerce-review`를 선택합니다. 설치 도구가 적용할 AI 클라이언트를 묻습니다. 검증한 `skills@1.7.4` 설치 도구에는 Node.js 22.20 이상이 필요하며, 이 방식에는 세션 훅과 `commerce on/off/status` 제어가 포함되지 않습니다.

수동으로 옮길 때는 선택한 `skills/<스킬명>/` 폴더 전체를 라이선스·참고 문서와 함께 복사합니다. Markdown을 직접 읽는 데 Java·Node.js·별도 API 키는 필요하지 않습니다.

### 세션 훅을 포함한 플러그인 설치

Codex CLI:

```bash
codex plugin marketplace add https://github.com/dakcoh/commerce-backend-expert.git
codex plugin add commerce-backend-expert@commerce-context-mcp
```

Claude Code:

```bash
claude plugin marketplace add dakcoh/commerce-backend-expert
claude plugin install commerce-backend-expert@commerce-context-mcp
```

세션 훅에는 Node.js 24.22.1 LTS를 사용하세요. 새 대화에서 사용하며, Codex는 `/hooks`에서 정의를 검토·신뢰해야 실행합니다. Codex CLI 0.153.2와 Claude Code 2.1.114의 실제 훅 호출·재개·수동 압축은 로컬 모델 응답 대역으로 확인했습니다. 다른 클라이언트의 제한은 [검증 현황](CONTRIBUTING.ko.md#클라이언트-확인)에 기록합니다. [클라이언트별 구성](#클라이언트별-구성)도 참고하세요.

`@commerce-context-mcp`는 기존 설치와 업데이트를 위한 마켓플레이스 식별자입니다. 현재 플러그인은 MCP 서버를 실행하지 않으며, 과거 npm MCP 패키지와 설치 경로가 다릅니다.

### 요청하기

관련 프로젝트·업무 조건과 요청한 작업을 제공합니다. 문서를 직접 제공한 경우에는 SKILL.md 경로를 명시합니다.

> commerce-review로 이 환불 코드를 검토해줘. 호출자·상위 검증·저장소까지 확인하고, 실제 결함과 추가 확인을 구분해줘. 코드는 수정하지 마.

| 작업 | 요청 예시 |
|---|---|
| 설계 | “예약 없이 DB에서 즉시 차감하는 재고와 결제 응답 유실 후 복구 경계를 설계해줘.” |
| 구현 | “날짜·순번 업무키로 중복 요청을 막고, 자정 이후 재시도와 요청 내용 충돌을 검증해줘.” |
| 리팩터링 | “재고 차감 코드를 정리하되 반환·예외·트랜잭션·부수 효과 순서를 유지해줘.” |
| 장애 분석 | “승인 응답이 유실됐어. 원 거래와 상태 이력을 기준으로 확인할 순서를 정리해줘.” |

결과에서 읽은 규칙·코드 위치·변경 내용·실행한 테스트와 미확인 조건을 확인하세요.


## 필요한 파트만 읽습니다

대표 스킬 → 관련 파트 색인 → 필요한 규칙 순서로 읽습니다. 정확한 규칙 경로를 이미 알면 색인을 생략하고, 현재 맥락에 있는 문서는 중복 조회하지 않습니다. 전체 규칙을 매 요청에 넣지 않습니다.

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

공통 [plugin.json](plugin.json)과 아래 진입 설정은 모두 같은 `skills/`를 사용하며 지식을 복제하지 않습니다. 현재 버전은 `0.3.1`입니다. **형식·경로 검증과 실제 클라이언트 설치·활성화는 별도입니다.**

| 클라이언트 | 구성 |
|---|---|
| Codex | 공통 manifest의 OpenAI 설정과 [.codex-plugin/plugin.json](.codex-plugin/plugin.json)의 호환 설정: 스킬·세션 훅 등록 |
| Claude Code | [.claude-plugin/plugin.json](.claude-plugin/plugin.json)의 스킬·세션 훅 등록 |
| Cursor | [.cursor-plugin/plugin.json](.cursor-plugin/plugin.json)과 [선택 적용 규칙](.cursor/rules/commerce-backend.mdc) |
| OpenClaw | 공통 번들 또는 [외부 스킬 경로 설정 예시](.openclaw/skills.example.json). 예시의 절대경로를 바꿔 기존 설정에 병합하며, 이 파일 자체가 자동 적용되지는 않습니다. |

## 세션 훅

[세션 훅](hooks/session.json)은 시작·재개·대화 압축 후 짧은 작업 범위와 스킬 경로를 제공합니다. 70개 규칙을 한꺼번에 주입하지 않습니다. 훅이 실행되는 클라이언트에서는 다음을 일반 메시지로 입력합니다.

| 메시지 | 동작 |
|---|---|
| `commerce off` | 이 세션의 자동 커머스 지침 적용 중단 |
| `commerce on` | 자동 적용 재개 |
| `commerce status` | 현재 상태 확인 |

상태는 프로젝트·세션별로 분리하며 같은 세션의 재개·압축 후 유지합니다. off는 호스트의 스킬 목록을 제거하지 않으며 명시적으로 요청한 스킬 사용도 금지하지 않습니다. 훅은 프롬프트·코드·대화 이력을 저장하거나 외부로 전송하지 않습니다. 켜기·끄기 상태만 클라이언트의 플러그인 데이터 폴더에 기록하며, 해당 경로가 없으면 OS 임시 폴더를 사용합니다.

Codex CLI 0.153.2(`/hooks` 검토·신뢰 후)와 Claude Code 2.1.114의 격리 프로필에서 두 훅의 실제 호출을 확인했습니다. 프로세스 재시작·재개와 실제 수동 압축 뒤 off가 유지됐고, 훅 문맥이 로컬 모델 응답 대역으로 보내는 다음 요청에 포함됐습니다. 클라이언트 연결 검증이며 AI의 실제 행동이나 모든 클라이언트의 훅을 검증한 결과는 아닙니다. [실행 범위와 호환성 설정](CONTRIBUTING.ko.md#클라이언트-확인)을 확인하세요.

[Claude](hooks/claude.json)·[Cursor](hooks/cursor.json) 편집 훅은 **스킬 지식을 수정하는 개발자의 선택적 검사**이며 기본 등록하지 않습니다. 세션 훅과 별개이고 일반 사용자 프로젝트의 코드는 검사하지 않습니다. [개발 훅 설정](CONTRIBUTING.ko.md#선택적-개발-훅)

## 결과를 판단할 때

규칙의 적용 조건·예외·근거 범위와 검토 상태를 함께 확인하세요. `active`는 사용 중이라는 뜻이며 정확성 인증이 아닙니다. `needs-review` 19개는 AI 문서 검토를 기록했지만 실제 연동·사업 정책 검증이 남아 있습니다. [규칙별 후속 검토·인증 없는 클라이언트 확인](validation/followup-review.md)을 참고하세요. `verifiedBy`·`lastReviewedAt`이 `not-recorded`이면 검토 기록이 없습니다.

[공개 행동 평가](benchmarks/README.md)는 고정 합성 입력과 실제 스킬 내용을 사용합니다. 실제 DB·PG 운영 동작, 설치 후 자동 선택, 모든 업무의 정확성을 입증하는 절차는 아닙니다. 토큰·응답 속도 개선도 주장하지 않습니다. [검증 방법과 범위](CONTRIBUTING.ko.md#검증)

## 기존 MCP 사용자

이 브랜치는 **Markdown을 유일한 지식 원본으로 사용하는 구조**로 전환했습니다. 기존 YAML·Java MCP·Gradle·npm 런처와 JRE 다운로드 경로는 제거했습니다. 예전 MCP 설정으로 이 브랜치를 실행할 수 없습니다.

기존 공개 v0.2.2의 소스와 사용법은 [v0.2.2 태그](https://github.com/dakcoh/commerce-backend-expert/tree/v0.2.2)에 보존합니다. 이미 게시한 npm/JAR와 태그는 유지합니다. 전환하려면 기존 MCP 등록을 해제하고 위 플러그인을 설치하세요. [v0.3.0 릴리스](https://github.com/dakcoh/commerce-backend-expert/releases/tag/v0.3.0)에서 소스 압축 파일과 변경·검증 범위를 확인할 수 있습니다.

문서·지식을 고치거나 검사하려면 [기여 가이드](CONTRIBUTING.ko.md)를 확인하세요.
