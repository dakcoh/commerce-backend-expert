package com.commerce.context_engine.adapter.in.mcp;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
class ResponseContractTest {
    @Autowired CommerceKnowledgeTool tool;
    @Autowired KnowledgeResourceProvider resources;

    @Test
    void checklistJsonAndMarkdownContainExactlyTheSameOrderedItems() {
        for (String domain : List.of("inventory", "payment", "settlement", "coupon", "commerce", "spring-commerce")) {
            var result = tool.getChecklist(domain, null);
            var items = result.rules().stream().flatMap(rule -> rule.items().stream()).toList();
            assertThat(result.rules()).allSatisfy(rule -> {
                assertThat(rule.applicability().appliesWhen()).isNotEmpty();
                rule.applicability().appliesWhen().forEach(condition ->
                        assertThat(result.markdown()).contains(condition));
            });
            var markdownItems = result.markdown().lines().filter(line -> line.startsWith("- [ ] "))
                    .map(line -> line.substring(6)).toList();
            assertThat(markdownItems).as(domain).containsExactlyElementsOf(items);
            assertThat(result.rules()).hasSizeLessThanOrEqualTo(10);
        }
        assertThat(tool.getChecklist("commerce", null).rules().stream()
                .mapToInt(rule -> rule.items().size()).sum()).isGreaterThan(10);
    }

    @Test
    void validFiltersAreNormalizedAndEmptyMatchesRemainNoAnswer() {
        assertThat(tool.getChecklist(" PAYMENT ", null).domain()).isEqualTo("payment");
        var result = tool.searchKnowledge("결제 웹훅", " PAYMENT, INVENTORY ", null, 10, " SUMMARY ");
        assertThat(result.results()).isNotEmpty().allSatisfy(rule ->
                assertThat(rule.domain()).isIn("payment", "inventory"));
        assertThat(tool.searchKnowledge(" ", "payment", null, 1, "summary").answerable()).isFalse();
        assertThat(tool.searchKnowledge("오늘 날씨", "payment", null, 1, "summary").answerable()).isFalse();
        var before = tool.getRule("webhook-handling");
        tool.getChecklist("payment", null);
        assertThat(tool.getRule("webhook-handling")).isEqualTo(before);
    }

    @Test
    void invalidFiltersAreErrorsEvenWhenQueryIsBlank() {
        for (String query : List.of("재고", " ")) {
            assertThatThrownBy(() -> tool.searchKnowledge(query, "inventory,typo", null, 5, null))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("domain");
            assertThatThrownBy(() -> tool.searchKnowledge(query, null, "typo", 5, null))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("category");
            assertThatThrownBy(() -> tool.searchKnowledge(query, ",,", null, 5, null))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> tool.searchKnowledge(query, null, null, 11, null))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> tool.searchKnowledge(query, null, null, 5, "typo"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void checklistAndResourcesRejectMissingOrUnknownDomain() {
        for (String domain : new String[]{null, " ", "typo"}) {
            assertThatThrownBy(() -> tool.getChecklist(domain, null))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("domain");
            assertThatThrownBy(() -> resources.domain(domain))
                    .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("domain");
        }
    }

    @Test
    void reviewTypeIsValidatedAndNormalized() {
        assertThatThrownBy(() -> tool.reviewCommerceDesign("결제 웹훅", "typo", null, null, 5))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("artifactType");
        for (String type : List.of("design", "api", "ddl", "code")) {
            assertThat(tool.reviewCommerceDesign("결제 웹훅", " " + type.toUpperCase() + " ", null, null, 5)
                    .artifactType()).isEqualTo(type);
        }
    }

    @Test
    void reviewExplainsMatchEvidenceAndDirectsConditionalRuleLookup() {
        var result = tool.reviewCommerceDesign("결제 웹훅 서명 멱등성", "code", "payment", null, 3);
        assertThat(result.notice()).contains("matchedEvidence", "검색", "get_rule", "적용 조건");
        assertThat(result.findings()).allSatisfy(finding -> assertThat(finding.status()).isEqualTo("review-required"));
    }
}
