package com.commerce.context_engine.adapter.in.mcp;

import org.springaicommunity.mcp.annotation.McpArg;
import org.springaicommunity.mcp.annotation.McpPrompt;
import org.springframework.stereotype.Component;

@Component
public class KnowledgePromptProvider {

    @McpPrompt(
            name = "review-commerce-api",
            title = "Review a commerce API",
            description = "커머스 API를 상태 전이, 멱등성, 권한, 정합성 관점에서 검토합니다."
    )
    public String reviewCommerceApi(
            @McpArg(name = "domain", description = "검토할 domain", required = false) String domain
    ) {
        String target = domain == null || domain.isBlank() ? "관련 커머스" : domain;
        return "다음 " + target + " API를 검토하세요. 먼저 review_commerce_design을 호출하고, "
                + "각 finding의 ruleId를 get_rule(responseFormat=json)로 확인하세요. analysisTruncated이면 관심 코드로 좁혀 재조회하세요. 확정된 사실과 추가 확인 항목을 구분하고, "
                + "matchConfidence와 evidenceLevel, verifiedBy를 서로 다른 신뢰 신호로 해석하며, "
                + "상태 전이·멱등성·소유권 검증·트랜잭션 경계·실패 복구를 빠짐없이 점검하세요.";
    }

    @McpPrompt(
            name = "review-payment-webhook",
            title = "Review a payment webhook",
            description = "PG 웹훅의 서명, 내구성 있는 인수, 중복 처리와 상태 전이를 검토합니다."
    )
    public String reviewPaymentWebhook() {
        return "결제 웹훅 구현을 검토하세요. review_commerce_design에 payment domain과 코드를 전달하고, "
                + "고위험 후보는 get_rule(responseFormat=json)로 적용 조건과 예외를 확인하세요. "
                + "서명 검증, 성공 응답 전 내구성 있는 저장, inbox 멱등성, 허용 상태 전이, "
                + "UNCERTAIN 처리와 재처리 전략을 확인하세요.";
    }
}
