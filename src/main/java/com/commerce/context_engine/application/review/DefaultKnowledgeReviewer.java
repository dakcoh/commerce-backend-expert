package com.commerce.context_engine.application.review;

import com.commerce.context_engine.core.model.FindingStatus;
import com.commerce.context_engine.core.model.ResponseDetail;
import com.commerce.context_engine.core.model.ReviewFinding;
import com.commerce.context_engine.core.model.ReviewReport;
import com.commerce.context_engine.core.model.ReviewRequest;
import com.commerce.context_engine.core.model.SearchQuery;
import com.commerce.context_engine.core.model.SearchResult;
import com.commerce.context_engine.core.port.KnowledgeReviewer;
import com.commerce.context_engine.core.port.KnowledgeSearch;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Comparator;
import com.commerce.context_engine.application.search.QueryNormalizer;

@Service
public class DefaultKnowledgeReviewer implements KnowledgeReviewer {

    private static final int WINDOW_TERMS = 16;
    private static final int MAX_WINDOWS = 32;

    private final KnowledgeSearch search;

    public DefaultKnowledgeReviewer(KnowledgeSearch search) {
        this.search = search;
    }

    @Override
    public ReviewReport review(ReviewRequest request) {
        String artifact = request.artifact().replaceAll(
                "(?m)^[\\t ]*(?:package|import)[\\t ]+[^;\\r\\n]+;[\\t ]*", "");
        var terms = new QueryNormalizer().distinctTerms(artifact);
        var queries = new ArrayList<String>();
        if (!request.scenario().isBlank()) queries.add(request.scenario());
        queries.add(artifact);
        int windows = 0;
        boolean truncated = false;
        if (terms.size() > 32) {
            int maxStart = terms.size() - WINDOW_TERMS;
            int required = (maxStart + WINDOW_TERMS / 2 - 1) / (WINDOW_TERMS / 2) + 1;
            windows = Math.min(required, MAX_WINDOWS);
            truncated = required > MAX_WINDOWS;
            // shortcut: bounded lexical windows sample very large inputs; use a focused scenario for omitted regions.
            for (int i = 0; i < windows; i++) {
                int start = (int) ((long) i * maxStart / (windows - 1));
                queries.add(String.join(" ", terms.subList(start, Math.min(start + WINDOW_TERMS, terms.size()))));
            }
        }
        var candidates = new LinkedHashMap<String, SearchResult>();
        for (String query : queries) {
            if (query.isBlank()) {
                request.domains().forEach(search::findByDomain);
                continue;
            }
            for (SearchResult candidate : search.search(new SearchQuery(query, request.domains(),
                    java.util.Set.of(), java.util.Set.of(), request.maxFindings(), ResponseDetail.SUMMARY, false))) {
                candidates.merge(candidate.rule().id(), candidate,
                        (a, b) -> a.score() >= b.score() ? a : b);
            }
        }
        List<SearchResult> results = candidates.values().stream()
                .sorted(Comparator.comparingDouble(SearchResult::score).reversed()
                        .thenComparing(Comparator.comparingDouble(SearchResult::queryCoverage).reversed())
                        .thenComparing(result -> result.rule().domain())
                        .thenComparing(result -> result.rule().category())
                        .thenComparing(result -> result.rule().id()))
                .limit(request.maxFindings()).toList();

        LinkedHashSet<String> domains = new LinkedHashSet<>();
        List<ReviewFinding> findings = java.util.stream.IntStream.range(0, results.size())
                .mapToObj(index -> finding(index, results.get(index), domains))
                .toList();
        return new ReviewReport(
                request.artifactType(),
                domains,
                findings,
                "프로젝트 규칙 기반 후보입니다. matchedEvidence는 검색에 일치한 단어이며 결함의 입증 자료가 아닙니다. "
                        + "finding의 ruleStatus, evidenceLevel, owner, verifiedBy와 lastReviewedAt을 확인하세요. "
                        + "특히 고위험 후보는 get_rule로 적용 조건과 예외를 읽고, 실제 결함 확정 전에 코드 흐름, 공식 문서와 외부 사업자 계약을 확인하세요."
                        + (truncated ? " 입력의 일부 구간만 분할 검색했습니다. 관심 코드와 구체적인 scenario로 다시 조회하세요." : "")
                        + (results.isEmpty() ? " 후보 없음은 결함 없음이 아닙니다. 업무·실패 상황을 짧은 scenario로 지정하거나 search_knowledge로 재조회하세요." : ""),
                windows,
                truncated
        );
    }

    private static ReviewFinding finding(int index, SearchResult result, LinkedHashSet<String> domains) {
        var rule = result.rule();
        domains.add(rule.domain());
        List<String> recommendations = rule.sections().entrySet().stream()
                .filter(entry -> !entry.getKey().equals("avoid-patterns")
                        && !entry.getKey().equals("failure-scenarios"))
                .flatMap(entry -> entry.getValue().stream())
                .limit(5)
                .toList();
        return new ReviewFinding(
                "review-" + (index + 1) + "-" + rule.id(),
                rule.id(),
                rule.severity(),
                FindingStatus.REVIEW_REQUIRED,
                rule.status(),
                rule.evidenceLevel(),
                rule.governance().owner(),
                rule.governance().verifiedBy().isBlank() ? null : rule.governance().verifiedBy(),
                rule.lastReviewedAt(),
                rule.title(),
                rule.summary(),
                result.matchedTerms(),
                recommendations.isEmpty() ? rule.checklist().stream().limit(5).toList() : recommendations
        );
    }
}
