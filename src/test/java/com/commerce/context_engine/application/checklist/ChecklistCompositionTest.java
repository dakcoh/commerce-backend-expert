package com.commerce.context_engine.application.checklist;

import com.commerce.context_engine.adapter.out.render.MarkdownKnowledgeRenderer;
import com.commerce.context_engine.core.model.*;
import com.commerce.context_engine.core.port.KnowledgeSearch;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ChecklistCompositionTest {
    @Test
    void deduplicatesOnlyWithinTheSameScopeAndTrustContextWithoutMutatingRules() {
        var original = rule("a", "동일 조건", RuleStatus.ACTIVE);
        var duplicate = rule("b", "동일 조건", RuleStatus.ACTIVE);
        var otherScope = rule("c", "다른 조건", RuleStatus.ACTIVE);
        var unreviewed = rule("d", "동일 조건", RuleStatus.NEEDS_REVIEW);
        var values = List.of(original, duplicate, otherScope, unreviewed);
        KnowledgeSearch search = new KnowledgeSearch() {
            public List<SearchResult> search(SearchQuery query) {
                return values.stream().map(rule -> new SearchResult(rule, 10, 1,
                        List.of("결제"), List.of("title"))).toList();
            }
            public java.util.Optional<KnowledgeRule> findById(String id) { return java.util.Optional.empty(); }
            public List<KnowledgeRule> findByDomain(String domain) { return values; }
            public List<KnowledgeRule> findByCategory(String domain, String category) { return values; }
        };
        var service = new ChecklistService(search);
        for (String scenario : new String[]{null, "결제"}) {
            var result = service.find("payment", scenario);
            assertThat(result).extracting(KnowledgeRule::id).containsExactly("a", "c", "d");
            assertThat(new MarkdownKnowledgeRenderer().renderChecklist(result).lines()
                    .filter(line -> line.equals("- [ ] 같은 질문"))).hasSize(3);
        }
        assertThat(original.checklist()).containsExactly("같은 질문");
        assertThat(duplicate.checklist()).containsExactly("같은 질문");
    }

    private static KnowledgeRule rule(String id, String scope, RuleStatus status) {
        return new KnowledgeRule(id, "payment", "webhook", id, "요약", RuleSeverity.MEDIUM,
                new Applicability(List.of(scope), List.of(), List.of(), "KR"), "근거", "", Map.of(),
                List.of("같은 질문"), List.of(), List.of(), List.of(), List.of(),
                new KnowledgeGovernance("test", "", ""), null, status);
    }
}
