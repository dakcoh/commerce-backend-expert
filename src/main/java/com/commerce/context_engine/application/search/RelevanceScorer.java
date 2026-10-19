package com.commerce.context_engine.application.search;

import com.commerce.context_engine.core.model.KnowledgeRule;
import com.commerce.context_engine.core.model.SearchResult;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public class RelevanceScorer {

    private static final Set<String> CHECKLIST_TERMS = Set.of(
            "체크리스트", "점검표", "누락", "pitfalls", "checklist", "review"
    );

    public SearchResult score(KnowledgeRule rule, QueryNormalizer.NormalizedQuery query) {
        Set<String> fields = new LinkedHashSet<>();
        Set<String> matchedTerms = new LinkedHashSet<>();
        double score = 0;

        score += scoreField("id", rule.id(), query, 8, fields, matchedTerms);
        score += scoreField("title", rule.title(), query, 6, fields, matchedTerms);
        if (containsPhrase(rule.title(), query)) {
            score += 6;
        }
        score += scoreList("aliases", rule.aliases(), query, 7, fields, matchedTerms);
        score += aliasSignalBonus(rule.aliases(), query);
        score += scoreList("tags", rule.tags(), query, 5, fields, matchedTerms);
        score += scoreField("domain", rule.domain(), query, 3, fields, matchedTerms);
        score += scoreField("category", rule.category(), query, 3, fields, matchedTerms);
        score += scoreField("summary", rule.summary(), query, 4, fields, matchedTerms);

        String body = body(rule);
        if (matchTerms(body, query, matchedTerms)) {
            fields.add("body");
            score += 2;
        }

        double coverage = query.terms().isEmpty()
                ? 0
                : (double) matchedTerms.size() / query.terms().size();
        score += coverage * 10;

        if ("checklist".equals(rule.category())) {
            boolean checklistIntent = query.terms().stream().anyMatch(CHECKLIST_TERMS::contains);
            score += checklistIntent ? 6 : -10;
        }

        return new SearchResult(rule, round(score), round(coverage),
                List.copyOf(fields), List.copyOf(matchedTerms));
    }

    private static double scoreField(
            String name,
            String value,
            QueryNormalizer.NormalizedQuery query,
            double weight,
            Set<String> fields,
            Set<String> matchedTerms
    ) {
        Set<String> fieldTerms = new LinkedHashSet<>();
        if (!matchTerms(value, query, fieldTerms)) {
            return 0;
        }
        fields.add(name);
        matchedTerms.addAll(fieldTerms);
        return fieldWeight(weight, fieldTerms, query);
    }

    private static double scoreList(
            String name,
            List<String> values,
            QueryNormalizer.NormalizedQuery query,
            double weight,
            Set<String> fields,
            Set<String> matchedTerms
    ) {
        Set<String> fieldTerms = new LinkedHashSet<>();
        boolean matched = false;
        for (String value : values) {
            if (matchTerms(value, query, fieldTerms)) {
                matched = true;
            }
        }
        if (!matched) {
            return 0;
        }
        fields.add(name);
        matchedTerms.addAll(fieldTerms);
        return fieldWeight(weight, fieldTerms, query);
    }

    private static double fieldWeight(double weight, Set<String> terms, QueryNormalizer.NormalizedQuery query) {
        // A single broad alias must not receive the same weight as several topic terms.
        return query.terms().isEmpty() ? weight : weight * terms.size() / query.terms().size();
    }

    private static boolean containsPhrase(String value, QueryNormalizer.NormalizedQuery query) {
        if (query.phrase().isBlank()) {
            return false;
        }
        String normalized = QueryNormalizer.normalizeText(value);
        return normalized.contains(query.phrase())
                || QueryNormalizer.stripSpaces(normalized).contains(query.compactPhrase());
    }

    private static double aliasSignalBonus(
            List<String> aliases,
            QueryNormalizer.NormalizedQuery query
    ) {
        long distinctMatches = query.terms().stream()
                .filter(term -> aliases.stream().anyMatch(alias -> containsTerm(alias, term)))
                .count();
        return distinctMatches >= 2 ? distinctMatches * 2 : 0;
    }

    private static boolean containsTerm(String value, String term) {
        String normalized = QueryNormalizer.normalizeText(value);
        return normalized.contains(term)
                || QueryNormalizer.stripSpaces(normalized).contains(QueryNormalizer.stripSpaces(term));
    }

    private static boolean matchTerms(
            String value,
            QueryNormalizer.NormalizedQuery query,
            Set<String> matchedTerms
    ) {
        if (value == null || value.isBlank()) {
            return false;
        }
        String normalized = QueryNormalizer.normalizeText(value);
        String compact = QueryNormalizer.stripSpaces(normalized);
        boolean matched = false;
        for (String term : query.terms()) {
            String compactTerm = QueryNormalizer.stripSpaces(term);
            if (normalized.contains(term) || compact.contains(compactTerm)) {
                matchedTerms.add(term);
                matched = true;
            }
        }
        if (query.terms().isEmpty() && containsPhrase(value, query)) {
            matched = true;
        }
        return matched;
    }

    private static String body(KnowledgeRule rule) {
        List<String> values = new ArrayList<>();
        values.add(rule.rationale());
        values.add(rule.content());
        rule.sections().values().forEach(values::addAll);
        values.addAll(rule.checklist());
        values.addAll(rule.applicability().appliesWhen());
        values.addAll(rule.applicability().doesNotApplyWhen());
        return values.stream().filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" "));
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
