package com.commerce.context_engine.adapter.in.mcp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.ai.tool.ToolCallbackProvider;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class CommerceKnowledgeToolTest {

    @Autowired
    CommerceKnowledgeTool tool;

    @Autowired
    KnowledgeResourceProvider resources;

    @Autowired
    KnowledgePromptProvider prompts;

    @Autowired
    ToolCallbackProvider toolCallbackProvider;

    @Test
    void exposesOnlyFourFocusedTools() {
        assertThat(Arrays.stream(toolCallbackProvider.getToolCallbacks())
                .map(callback -> callback.getToolDefinition().name()))
                .containsExactlyInAnyOrder(
                        "search_knowledge", "get_rule", "get_checklist", "review_commerce_design");
    }

    @Test
    void search_returnsBoundedStructuredResults() {
        var response = tool.searchKnowledge("웹훅 중복 결제", "payment", null, 3, "summary");
        assertThat(response.count()).isBetween(1, 3);
        assertThat(response.results()).allSatisfy(result -> {
            assertThat(result.ruleId()).isNotBlank();
            assertThat(result.score()).isPositive();
            assertThat(result.matchedFields()).isNotEmpty();
            assertThat(result.evidenceLevel()).isEqualTo(tool.getRule(result.ruleId(), "json").rule().evidenceLevel());
            assertThat(result.matchConfidence()).isIn("high", "medium", "low");
            assertThat(result.owner()).isEqualTo("commerce-context-maintainers");
            assertThat(result.verifiedBy()).isNull();
        });
        assertThat(response.answerable()).isTrue();
        assertThat(response.notice()).contains("공식 문서");
    }

    @Test
    void unrelatedQuery_returnsNoAnswerInsteadOfWeakGuidance() {
        var response = tool.searchKnowledge("오늘 서울 날씨", null, null, 5, "summary");

        assertThat(response.answerable()).isFalse();
        assertThat(response.results()).isEmpty();
        assertThat(response.message()).contains("구체화");
    }

    @Test
    void multipleAliasSignals_beatBroadCommerceTerms() {
        var response = tool.searchKnowledge(
                "결제 callback 위조 요청 확인 방법", null, null, 3, "summary");

        assertThat(response.results()).isNotEmpty();
        assertThat(response.results().get(0).ruleId()).isEqualTo("webhook-handling");
    }

    @Test
    void blankQuery_returnsActionableNoAnswer() {
        var response = tool.searchKnowledge("  ", null, null, 5, "summary");

        assertThat(response.answerable()).isFalse();
        assertThat(response.results()).isEmpty();
        assertThat(response.message()).contains("검색 질의");
    }

    @Test
    void getRule_returnsApplicabilityEvidenceAndMarkdown() {
        var response = tool.getRule("available-stock-query");
        assertThat(response.rule().applicability().appliesWhen()).isNotEmpty();
        assertThat(response.rule().evidence()).isNotEmpty();
        assertThat(response.rule().lastReviewedAt()).isNull();
        assertThat(response.rule().owner()).isEqualTo("commerce-context-maintainers");
        assertThat(response.rule().verifiedBy()).isNull();
        assertThat(response.rule().status()).isEqualTo("active");
        assertThat(response.rule().evidenceLevel()).isEqualTo("project-guidance");
        assertThat(response.markdown()).contains(
                "evidence-level", "last-reviewed: `not-recorded`", "적용 조건", "전제와 범위", "출처와 검토 상태");
        assertThat(response.notice()).contains("전문가 검토");
    }

    @Test
    void checklist_deduplicatesAndRendersCheckboxes() {
        var response = tool.getChecklist("inventory", "재고 예약 동시성");
        assertThat(response.rules()).isNotEmpty();
        assertThat(response.rules()).allSatisfy(rule -> {
            assertThat(rule.evidenceLevel()).isNotNull();
            assertThat(rule.evidenceLevel()).isEqualTo("project-guidance");
            assertThat(rule.status()).isIn("active", "needs-review", "deprecated");
            assertThat(rule.owner()).isEqualTo("commerce-context-maintainers");
        });
        assertThat(response.markdown()).contains("[ ]");
    }

    @Test
    void checklist_isBoundedAndDomainFilterIsCaseInsensitive() {
        var response = tool.getChecklist("COMMERCE", null);

        assertThat(response.rules()).isNotEmpty().hasSizeLessThanOrEqualTo(10);
    }

    @Test
    void review_returnsReviewRequiredFindings() {
        var response = tool.reviewCommerceDesign(
                "결제 웹훅을 받은 뒤 주문을 PAID로 변경한다. 중복 이벤트 처리는 아직 없다.",
                "design", "payment", "웹훅 멱등성", 3);
        assertThat(response.findings()).isNotEmpty();
        assertThat(response.findings()).allSatisfy(finding -> {
            assertThat(finding.ruleStatus()).isNotNull();
            assertThat(finding.evidenceLevel()).isNotNull();
            assertThat(finding.status()).isEqualTo("review-required");
            assertThat(finding.ruleStatus()).isIn("active", "needs-review", "deprecated");
            assertThat(finding.evidenceLevel()).isEqualTo(tool.getRule(finding.ruleId(), "json").rule().evidenceLevel());
            assertThat(finding.owner()).isEqualTo("commerce-context-maintainers");
        });
        assertThat(response.notice()).contains("확정");
    }

    @Test
    void resourcesAndPrompts_exposeHumanReadableContext() {
        assertThat(resources.catalog()).contains("rules", "domains", "project-guidance", "needs-review");
        assertThat(resources.rule("available-stock-query")).contains("가용 재고", "knowledgeId");
        assertThat(prompts.reviewPaymentWebhook()).contains("review_commerce_design");
    }

    @Test
    void reviewPromptExplainsFieldsThatExistInReviewFindings() {
        var fields = Arrays.stream(CommerceKnowledgeTool.ReviewFindingView.class.getRecordComponents())
                .map(component -> component.getName()).toList();
        String prompt = prompts.reviewCommerceApi("payment");
        for (String field : List.of("ruleStatus", "evidenceLevel", "verifiedBy", "lastReviewedAt", "matchedEvidence")) {
            assertThat(fields).contains(field);
            assertThat(prompt).contains(field);
        }
        assertThat(prompt).doesNotContain("matchConfidence")
                .contains("검색 일치 단어", "입증 자료가 아닙니다");
    }

    @Test
    void reviewPromptsAskForCodeAndUserProvidedScenarioWithoutInventingContext() {
        for (String prompt : List.of(prompts.reviewCommerceApi(null),
                prompts.reviewCommerceApi("payment"), prompts.reviewPaymentWebhook())) {
            assertThat(prompt).contains("review_commerce_design", "artifact", "scenario", "사용자가 제공한", "추측하지");
        }
    }
}
