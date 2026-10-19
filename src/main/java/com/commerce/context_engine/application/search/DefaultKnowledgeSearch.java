package com.commerce.context_engine.application.search;

import com.commerce.context_engine.core.model.KnowledgeRule;
import com.commerce.context_engine.core.model.RuleStatus;
import com.commerce.context_engine.core.model.SearchQuery;
import com.commerce.context_engine.core.model.SearchResult;
import com.commerce.context_engine.core.port.KnowledgeCatalog;
import com.commerce.context_engine.core.port.KnowledgeSearch;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class DefaultKnowledgeSearch implements KnowledgeSearch {

    private static final double MIN_RELEVANCE_SCORE = 10.0;
    private static final double MIN_QUERY_COVERAGE = 0.30;

    private final KnowledgeCatalog catalog;
    private final QueryNormalizer normalizer;
    private final RelevanceScorer scorer;

    @Autowired
    public DefaultKnowledgeSearch(KnowledgeCatalog catalog) {
        this(catalog, new QueryNormalizer(), new RelevanceScorer());
    }

    DefaultKnowledgeSearch(KnowledgeCatalog catalog, QueryNormalizer normalizer, RelevanceScorer scorer) {
        this.catalog = catalog;
        this.normalizer = normalizer;
        this.scorer = scorer;
    }

    @Override
    public List<SearchResult> search(SearchQuery query) {
        validateDomains(query.domains());
        Set<String> categories = catalog.findAll().stream().map(KnowledgeRule::category)
                .collect(java.util.stream.Collectors.toSet());
        if (!categories.containsAll(query.categories())) {
            throw new IllegalArgumentException("Unknown category; available categories: "
                    + categories.stream().sorted().toList());
        }
        QueryNormalizer.NormalizedQuery normalized = normalizer.normalize(query.query());
        var candidates = catalog.findByDomains(query.domains()).stream()
                .filter(rule -> query.categories().isEmpty() || query.categories().contains(rule.category()))
                .filter(rule -> query.severities().isEmpty() || query.severities().contains(rule.severity()))
                .filter(rule -> query.includeDeprecated() || rule.status() != RuleStatus.DEPRECATED)
                .toList();

        if (normalized.isBlank()) {
            return candidates.stream()
                    .sorted(ruleOrder())
                    .limit(query.topK())
                    .map(rule -> new SearchResult(rule, 0, 0, List.of(), List.of()))
                    .toList();
        }

        return candidates.stream()
                .map(rule -> scorer.score(rule, normalized))
                .filter(DefaultKnowledgeSearch::isRelevant)
                .sorted(resultOrder())
                .limit(query.topK())
                .toList();
    }

    @Override
    public Optional<KnowledgeRule> findById(String id) {
        return catalog.findById(id);
    }

    @Override
    public List<KnowledgeRule> findByDomain(String domain) {
        if (domain == null || domain.isBlank()) {
            throw new IllegalArgumentException("domain must not be blank");
        }
        Set<String> domains = Set.of(domain.trim().toLowerCase(Locale.ROOT));
        validateDomains(domains);
        return catalog.findByDomains(domains).stream()
                .sorted(ruleOrder()).toList();
    }

    private void validateDomains(Set<String> domains) {
        if (!catalog.domains().containsAll(domains)) {
            throw new IllegalArgumentException("Unknown domain; available domains: "
                    + catalog.domains().stream().sorted().toList());
        }
    }

    @Override
    public List<KnowledgeRule> findByCategory(String domain, String category) {
        if (category == null || category.isBlank()) {
            return List.of();
        }
        return findByDomain(domain).stream()
                .filter(rule -> category.trim().equalsIgnoreCase(rule.category()))
                .toList();
    }

    private static Comparator<KnowledgeRule> ruleOrder() {
        return Comparator.comparing(KnowledgeRule::domain)
                .thenComparing(KnowledgeRule::category)
                .thenComparing(KnowledgeRule::id);
    }

    private static boolean isRelevant(SearchResult result) {
        if (result.matchedTerms().equals(List.of("예약")) && result.queryCoverage() < 1) {
            return false; // Reservation alone does not establish commerce intent.
        }
        boolean highSignalMatch = result.matchedFields().stream()
                .anyMatch(field -> Set.of("id", "title", "aliases", "tags").contains(field));
        return result.queryCoverage() >= MIN_QUERY_COVERAGE
                && (result.score() >= MIN_RELEVANCE_SCORE || highSignalMatch && result.score() >= 8.0);
    }

    private static Comparator<SearchResult> resultOrder() {
        return Comparator.comparingDouble(SearchResult::score).reversed()
                .thenComparing(Comparator.comparingDouble(SearchResult::queryCoverage).reversed())
                .thenComparing(result -> result.rule().domain())
                .thenComparing(result -> result.rule().category())
                .thenComparing(result -> result.rule().id());
    }
}
