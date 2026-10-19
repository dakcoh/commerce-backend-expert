package com.commerce.context_engine.application.checklist;

import com.commerce.context_engine.core.model.Applicability;
import com.commerce.context_engine.core.model.Evidence;
import com.commerce.context_engine.core.model.KnowledgeGovernance;
import com.commerce.context_engine.core.model.KnowledgeRule;
import com.commerce.context_engine.core.model.ResponseDetail;
import com.commerce.context_engine.core.model.RuleSeverity;
import com.commerce.context_engine.core.model.RuleStatus;
import com.commerce.context_engine.core.model.SearchQuery;
import com.commerce.context_engine.core.model.SearchResult;
import com.commerce.context_engine.core.port.KnowledgeSearch;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;

@Service
public class ChecklistService {

    private final KnowledgeSearch search;

    public ChecklistService(KnowledgeSearch search) {
        this.search = search;
    }

    public List<KnowledgeRule> find(String domain, String scenario) {
        return select(domain, scenario).rules();
    }

    public Selection select(String domain, String scenario) {
        List<KnowledgeRule> domainRules = search.findByDomain(domain);
        int domainRuleCount = (int) domainRules.stream().filter(rule -> !rule.checklist().isEmpty()).count();
        List<KnowledgeRule> selected;
        if (scenario == null || scenario.isBlank()) {
            selected = domainRules.stream()
                    .filter(rule -> !rule.checklist().isEmpty())
                    .sorted(Comparator.comparing(KnowledgeRule::severity)
                            .thenComparing(KnowledgeRule::category)
                            .thenComparing(KnowledgeRule::id))
                    .limit(SearchQuery.MAX_TOP_K)
                    .toList();
        } else {
            selected = search.search(SearchQuery.of(scenario, domain, SearchQuery.MAX_TOP_K,
                            ResponseDetail.SUMMARY))
                    .stream().map(SearchResult::rule)
                    .filter(rule -> !rule.checklist().isEmpty())
                    .toList();
        }
        var seen = new HashSet<ChecklistItem>();
        var rules = selected.stream().map(rule -> withItems(rule, rule.checklist().stream()
                        .filter(item -> seen.add(new ChecklistItem(item, rule.domain(), rule.category(),
                                rule.applicability(), rule.severity(), rule.status(), rule.governance(),
                                rule.lastReviewedAt(), rule.evidence())))
                        .toList()))
                .filter(rule -> !rule.checklist().isEmpty()).toList();
        return new Selection(rules, domainRuleCount);
    }

    public record Selection(List<KnowledgeRule> rules, int domainRuleCount) {}

    private static KnowledgeRule withItems(KnowledgeRule rule, List<String> items) {
        return new KnowledgeRule(rule.id(), rule.domain(), rule.category(), rule.title(), rule.summary(),
                rule.severity(), rule.applicability(), rule.rationale(), rule.content(), rule.sections(), items,
                rule.evidence(), rule.tags(), rule.aliases(), rule.relatedRuleIds(), rule.governance(),
                rule.lastReviewedAt(), rule.status());
    }

    // Identical wording can represent different obligations or levels of trust.
    private record ChecklistItem(String text, String domain, String category, Applicability applicability,
                                 RuleSeverity severity, RuleStatus status, KnowledgeGovernance governance,
                                 java.time.LocalDate lastReviewedAt, List<Evidence> evidence) {}
}
