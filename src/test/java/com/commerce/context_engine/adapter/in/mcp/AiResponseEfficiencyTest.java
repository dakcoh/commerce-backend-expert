package com.commerce.context_engine.adapter.in.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class AiResponseEfficiencyTest {
    @Autowired CommerceKnowledgeTool tool;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void jsonRuleKeepsAllKnowledgeAndRemovesDuplicatedMarkdown() throws Exception {
        var both = tool.getRule("webhook-handling");
        var json = tool.getRule("webhook-handling", "json");
        assertThat(json.rule()).isEqualTo(both.rule());
        assertThat(json.notice()).isEqualTo(both.notice());
        assertThat(json.markdown()).isEmpty();
        assertThat(mapper.writeValueAsBytes(json).length).isLessThan((int) (mapper.writeValueAsBytes(both).length * .60));
    }

    @Test
    void jsonSearchFullPreservesFullRulesAndSummaryStaysSmall() {
        var summary = tool.searchKnowledge("결제 웹훅 서명", null, null, 3, "summary", "json");
        var full = tool.searchKnowledge("결제 웹훅 서명", null, null, 3, "full", "json");
        assertThat(summary.markdown()).isEmpty();
        assertThat(summary.fullRules()).isEmpty();
        assertThat(full.results()).isEqualTo(summary.results());
        assertThat(full.fullRules()).hasSameSizeAs(full.results()).allSatisfy(rule -> {
            assertThat(rule.applicability().appliesWhen()).isNotEmpty();
            assertThat(rule.evidence()).isNotEmpty();
            assertThat(rule.sections()).isNotEmpty();
        });
    }

    @Test
    void partialChecklistReportsDomainCoverageWithoutDroppingConditions() {
        var both = tool.getChecklist("commerce", null);
        var json = tool.getChecklist("commerce", null, "json");
        assertThat(json.domainRuleCount()).isEqualTo(20);
        assertThat(json.rules()).hasSize(10).isEqualTo(both.rules());
        assertThat(json.partial()).isTrue();
        assertThat(json.message()).contains("일부", "전체 검토 완료");
        assertThat(json.markdown()).isEmpty();
        assertThat(tool.getChecklist("payment", null).partial()).isFalse();
        var empty = tool.getChecklist("payment", "오늘 서울 날씨", "json");
        assertThat(empty.rules()).isEmpty();
        assertThat(empty.message()).contains("결함 없음이 아닙니다", "재조회");
    }

    @Test
    void badFormatIsRejectedWithoutChangingLegacyDefault() {
        assertThatThrownBy(() -> tool.getRule("webhook-handling", "bad"))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("responseFormat");
        assertThat(tool.getRule("webhook-handling").markdown()).isNotBlank();
    }
}
