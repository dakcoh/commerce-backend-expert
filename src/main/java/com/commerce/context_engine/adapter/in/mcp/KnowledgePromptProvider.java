package com.commerce.context_engine.adapter.in.mcp;

import org.springaicommunity.mcp.annotation.McpArg;
import org.springaicommunity.mcp.annotation.McpPrompt;
import org.springframework.stereotype.Component;

@Component
public class KnowledgePromptProvider {

    private static final String SCENARIO_GUIDANCE = "사용자가 제공한 업무·실패 상황을 요약해 scenario에 함께 전달하세요. "
            + "제시되지 않은 계약·정책·결함은 추측하지 마세요. ";

    @McpPrompt(
            name = "review-commerce-api",
            title = "Review a commerce API",
            description = "커머스 API를 상태 전이, 멱등성, 권한, 정합성 관점에서 검토합니다."
    )
    public String reviewCommerceApi(
            @McpArg(name = "domain", description = "검토할 domain", required = false) String domain
    ) {
        String target = domain == null || domain.isBlank() ? "관련 커머스" : domain;
        return "다음 " + target + " API를 검토하세요. 먼저 review_commerce_design에 API 설명이나 코드를 artifact로 전달하세요. "
                + SCENARIO_GUIDANCE
                + "각 finding의 ruleId를 get_rule(responseFormat=json)로 확인하세요. analysisTruncated이면 관심 코드로 좁혀 재조회하세요. 확정된 사실과 추가 확인 항목을 구분하세요. "
                + "ruleStatus는 규칙 상태, evidenceLevel은 근거 수준이며 verifiedBy·lastReviewedAt은 실제 검토 기록입니다. "
                + "matchedEvidence는 검색 일치 단어이며 결함의 입증 자료가 아닙니다. "
                + "상태 전이·멱등성·소유권 검증·트랜잭션 경계·실패 복구를 빠짐없이 점검하세요.";
    }

    @McpPrompt(
            name = "review-payment-webhook",
            title = "Review a payment webhook",
            description = "PG 웹훅의 서명, 내구성 있는 인수, 중복 처리와 상태 전이를 검토합니다."
    )
    public String reviewPaymentWebhook() {
        return "결제 웹훅 구현을 검토하세요. review_commerce_design에 payment domain과 코드를 artifact로 전달하세요. "
                + SCENARIO_GUIDANCE
                + "고위험 후보는 get_rule(responseFormat=json)로 적용 조건과 예외를 확인하세요. "
                + "서명 검증, 성공 응답 전 내구성 있는 저장, inbox 멱등성, 허용 상태 전이, "
                + "UNCERTAIN 처리와 재처리 전략을 확인하세요.";
    }
}
