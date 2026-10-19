package com.commerce.context_engine;

import com.commerce.context_engine.adapter.in.mcp.CommerceKnowledgeTool;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class RemainingKnowledgePolicyTest {
    @Autowired CommerceKnowledgeTool tool;

    @Test void reviewEligibility_followsTheChosenPurchaseEvent() {
        assertThat(tool.getRule("commerce-review-ugc-moderation").markdown())
                .contains("배송 완료", "구매 확정", "정책", "소유권")
                .doesNotContain("리뷰 작성 권한은 구매 확정 주문 라인 기준으로 검증한다.");
    }

    @Test void recurringBilling_handlesUncertaintyAndTerminationRaces() {
        assertThat(tool.getRule("commerce-subscription-recurring-order").markdown())
                .contains("미확정", "해지", "경합", "동의", "토큰", "동일 시도");
    }

    @Test void integrationTests_followTheActualStorageModel() {
        assertThat(tool.getRule("spring-commerce-testing-observability").markdown())
                .contains("실제 운영", "사용하는 경우", "격리 수준")
                .doesNotContain("PostgreSQL과 Redis 통합 테스트가 있는가?");
        assertThat(tool.getRule("spring-api-pagination-idempotent-post").markdown())
                .contains("요청 지문", "처리 중", "다른 payload");
    }

    @Test void irreversibleQuantityAndMoneyOperations_remainUnverifiedHighRiskGuidance() {
        for (String id : java.util.List.of("coupon-issuance-compensation", "settlement-cycle",
                "settlement-integrity", "commerce-loyalty-point-ledger")) {
            var rule = tool.getRule(id).rule();
            assertThat(rule.severity()).as(id).isEqualTo("high");
            assertThat(rule.status()).as(id).isEqualTo("needs-review");
            assertThat(rule.verifiedBy()).isNull();
        }
    }
}
