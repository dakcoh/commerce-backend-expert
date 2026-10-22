package com.commerce.context_engine.adapter.in.mcp;

import com.commerce.context_engine.application.checklist.ChecklistService;
import com.commerce.context_engine.core.model.KnowledgeRule;
import com.commerce.context_engine.core.model.ResponseDetail;
import com.commerce.context_engine.core.model.ReviewReport;
import com.commerce.context_engine.core.model.ReviewRequest;
import com.commerce.context_engine.core.model.SearchQuery;
import com.commerce.context_engine.core.model.SearchResult;
import com.commerce.context_engine.core.port.KnowledgeRenderer;
import com.commerce.context_engine.core.port.KnowledgeReviewer;
import com.commerce.context_engine.core.port.KnowledgeSearch;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.time.LocalDate;

@Component
public class CommerceKnowledgeTool {

    private static final String TRUST_NOTICE = "프로젝트 관리 설계 지침입니다. evidenceLevel, owner, verifiedBy와 lastReviewedAt을 확인하고, 결제·세무·보안·법률 결정은 최신 공식 문서와 전문가 검토로 확정하세요.";

    private final KnowledgeSearch search;
    private final KnowledgeReviewer reviewer;
    private final ChecklistService checklistService;
    private final KnowledgeRenderer renderer;

    public CommerceKnowledgeTool(
            KnowledgeSearch search,
            KnowledgeReviewer reviewer,
            ChecklistService checklistService,
            KnowledgeRenderer renderer
    ) {
        this.search = search;
        this.reviewer = reviewer;
        this.checklistService = checklistService;
        this.renderer = renderer;
    }

    @Tool(name = "search_knowledge",
          description = """
                  한국 커머스와 Java/Spring 구현 규칙을 통합 검색하는 로컬 읽기 전용 도구입니다.
                  관련도, 질의 커버리지, 매칭 필드와 규칙 상태를 구조화해 반환합니다.
                  특정 규칙 ID를 모르는 일반적인 설계·구현 질문에서 우선 사용하세요.
                  업무·실패 상황을 짧게 질의하세요. AI는 responseFormat=json으로 중복 표현을 줄일 수 있습니다.
                  summary 후보의 적용 조건과 예외는 get_rule로 확인하세요. 여러 규칙의 전문이 필요하면 detail=full로 한 번에 받고 같은 규칙을 다시 조회하지 마세요.
                  점수는 사실성 확률이 아닙니다.
                  """)
    public KnowledgeSearchResponse searchKnowledge(
            @ToolParam(description = "검색 질의", required = true) String query,
            @ToolParam(description = "선택 domain: inventory, payment, settlement, coupon, commerce, spring-commerce. 여러 값은 CSV, 생략은 전체", required = false) String domain,
            @ToolParam(description = "선택 category CSV. 모르면 생략하고 먼저 검색하세요", required = false) String category,
            @ToolParam(description = "결과 수 1~10, 기본 5", required = false) Integer topK,
            @ToolParam(description = "summary 또는 full, 기본 summary", required = false) String detail,
            @ToolParam(description = "json은 Markdown 중복 제외, both는 기존 JSON+Markdown, 기본 both. json+full은 fullRules에 전문 제공", required = false) String responseFormat
    ) {
        if (query == null) throw new IllegalArgumentException("query is required; use a short commerce question");
        ResponseFormat format = ResponseFormat.from(responseFormat);
        int limit = topK == null ? SearchQuery.DEFAULT_TOP_K : topK;
        ResponseDetail responseDetail = ResponseDetail.from(detail);
        SearchQuery searchQuery = new SearchQuery(
                query, values(domain), values(category), Set.of(), limit, responseDetail, false);
        List<SearchResult> results = search.search(searchQuery);
        if (query == null || query.isBlank()) {
            return new KnowledgeSearchResponse(
                    query == null ? "" : query,
                    0,
                    List.of(),
                    false,
                    "검색 질의를 입력하세요. domain, 기능, 실패 상황을 함께 적으면 더 정확하게 찾을 수 있습니다.",
                    TRUST_NOTICE,
                    "",
                    List.of()
            );
        }
        List<RuleMatch> matches = results.stream().map(RuleMatch::from).toList();
        return new KnowledgeSearchResponse(
                query,
                results.size(),
                matches,
                !results.isEmpty(),
                results.isEmpty()
                        ? "관련성이 충분한 규칙을 찾지 못했습니다. domain, 기능, 실패 상황을 포함해 질문을 구체화하세요. 예: 부분 환불 쿠폰 복원 금액."
                        : responseDetail == ResponseDetail.FULL
                            ? "관련 규칙 전문입니다. 포함된 적용 조건·예외·근거를 확인하세요. 같은 규칙을 get_rule로 다시 조회할 필요는 없습니다. matchConfidence와 queryCoverage는 검색 일치도이며 사실성 확률이 아닙니다."
                            : "관련 규칙 후보입니다. matchConfidence와 queryCoverage는 검색 일치도입니다. get_rule로 적용 조건과 예외를 확인하세요.",
                TRUST_NOTICE,
                format == ResponseFormat.JSON ? "" : renderer.renderSearchResults(results, responseDetail),
                format == ResponseFormat.JSON && responseDetail == ResponseDetail.FULL
                        ? results.stream().map(result -> RuleView.from(result.rule())).toList() : List.of()
        );
    }

    public KnowledgeSearchResponse searchKnowledge(String query, String domain, String category, Integer topK, String detail) {
        return searchKnowledge(query, domain, category, topK, detail, null);
    }

    @Tool(name = "get_rule",
          description = "로컬 읽기 전용 조회입니다. search/review의 ruleId로 적용 조건, 예외와 출처를 확인합니다. AI는 responseFormat=json으로 전문을 중복 없이 받으세요.")
    public RuleResponse getRule(
            @ToolParam(description = "정확한 knowledge rule ID", required = true) String ruleId,
            @ToolParam(description = "json 또는 both, 기본 both. json도 조건·예외·근거 전문 유지", required = false) String responseFormat
    ) {
        ResponseFormat format = ResponseFormat.from(responseFormat);
        KnowledgeRule rule = search.findById(ruleId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown knowledge rule: " + ruleId));
        return new RuleResponse(
                RuleView.from(rule),
                TRUST_NOTICE,
                format == ResponseFormat.JSON ? "" : renderer.renderRules(List.of(rule), ResponseDetail.FULL));
    }

    public RuleResponse getRule(String ruleId) { return getRule(ruleId, null); }

    @Tool(name = "get_checklist",
          description = "로컬 읽기 전용 조회입니다. domain과 시나리오에 맞는 체크리스트를 최대 10개 규칙에서 구성합니다. partial과 domainRuleCount로 범위를 확인하세요. 같은 조건·신뢰 맥락의 중복 문항만 제거합니다.")
    public ChecklistResponse getChecklist(
            @ToolParam(description = "단일 domain: inventory, payment, settlement, coupon, commerce, spring-commerce", required = true) String domain,
            @ToolParam(description = "선택 시나리오 또는 기능 설명. partial이면 전체 domain 검토 완료가 아닙니다", required = false) String scenario,
            @ToolParam(description = "json은 동일 문항·조건을 중복 표현 없이 제공, both는 Markdown 포함. 기본 both", required = false) String responseFormat
    ) {
        ResponseFormat format = ResponseFormat.from(responseFormat);
        var selection = checklistService.select(domain, scenario);
        List<KnowledgeRule> rules = selection.rules();
        boolean partial = rules.size() < selection.domainRuleCount();
        return new ChecklistResponse(
                domain.trim().toLowerCase(Locale.ROOT),
                rules.stream().map(rule -> new ChecklistRule(
                        rule.id(), rule.title(), value(rule.severity()), value(rule.status()),
                        value(rule.evidenceLevel()), rule.governance().owner(),
                        emptyToNull(rule.governance().verifiedBy()), rule.lastReviewedAt(), rule.checklist(),
                        rule.applicability())).toList(),
                TRUST_NOTICE,
                format == ResponseFormat.JSON ? "" : renderer.renderChecklist(rules),
                selection.domainRuleCount(), partial,
                rules.isEmpty() ? "관련 문항을 찾지 못했습니다. 결함 없음이 아닙니다. 업무·실패 상황을 구체화하거나 scenario를 생략해 재조회하세요."
                        : partial ? "전체 domain 규칙 중 일부입니다. 최대 10개 규칙을 선택하며 전체 검토 완료를 뜻하지 않습니다. 구체적인 scenario로 재조회하세요."
                        : "domain의 체크리스트 규칙을 모두 포함합니다. 각 문항의 적용 조건과 예외를 확인하세요."
        );
    }

    public ChecklistResponse getChecklist(String domain, String scenario) { return getChecklist(domain, scenario, null); }

    @Tool(name = "review_commerce_design",
          description = """
                  설계안, API 설명, DDL 또는 코드 조각에서 적용 가능성이 높은 커머스 규칙을 찾는 로컬 읽기 전용 도구입니다.
                  결과는 확정 버그가 아니라 검토가 필요한 규칙 기반 후보입니다.
                  사용자가 제공한 업무·실패 상황을 요약해 scenario에 함께 전달하세요. 제시되지 않은 계약·정책·결함은 추측하지 마세요.
                  analysisTruncated이면 관심 코드로 좁혀 재조회하세요.
                  고위험 후보는 get_rule로 조건과 예외를 확인하세요. 후보 없음은 결함 없음이 아닙니다.
                  """)
    public ReviewResponse reviewCommerceDesign(
            @ToolParam(description = "검토할 설계안, API, DDL 또는 코드", required = true) String artifact,
            @ToolParam(description = "design, api, ddl, code 중 하나", required = false) String artifactType,
            @ToolParam(description = "선택 domain: inventory, payment, settlement, coupon, commerce, spring-commerce. 여러 값 CSV, 생략은 전체", required = false) String domain,
            @ToolParam(description = "사용자가 제공한 업무·실패 상황 요약. 코드의 업무 맥락을 함께 전달하고, 제시되지 않은 계약·정책·결함은 추측하지 마세요", required = false) String scenario,
            @ToolParam(description = "후보 수 1~10, 기본 5", required = false) Integer maxFindings
    ) {
        ReviewReport report = reviewer.review(new ReviewRequest(
                artifact,
                artifactType,
                values(domain),
                scenario,
                maxFindings == null ? SearchQuery.DEFAULT_TOP_K : maxFindings
        ));
        return ReviewResponse.from(report);
    }

    private static Set<String> values(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        String[] parts = value.split(",", -1);
        if (java.util.Arrays.stream(parts).anyMatch(String::isBlank)) {
            throw new IllegalArgumentException("domain/category filters must contain nonblank comma-separated values");
        }
        return java.util.Arrays.stream(parts)
                .map(String::trim)
                .filter(item -> !item.isBlank())
                .map(item -> item.toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static String value(Enum<?> value) {
        return value.name().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    public record KnowledgeSearchResponse(
            String query,
            int count,
            List<RuleMatch> results,
            boolean answerable,
            String message,
            String notice,
            String markdown,
            List<RuleView> fullRules
    ) {
    }

    public record RuleMatch(
            String ruleId,
            String domain,
            String category,
            String title,
            String summary,
            String severity,
            String status,
            String evidenceLevel,
            String owner,
            String verifiedBy,
            LocalDate lastReviewedAt,
            String matchConfidence,
            double score,
            double queryCoverage,
            List<String> matchedFields,
            List<String> matchedTerms
    ) {
        static RuleMatch from(SearchResult result) {
            KnowledgeRule rule = result.rule();
            return new RuleMatch(rule.id(), rule.domain(), rule.category(), rule.title(), rule.summary(),
                    rule.severity().name().toLowerCase(), rule.status().name().toLowerCase().replace('_', '-'),
                    rule.evidenceLevel().name().toLowerCase().replace('_', '-'),
                    rule.governance().owner(), emptyToNull(rule.governance().verifiedBy()), rule.lastReviewedAt(),
                    result.confidence().name().toLowerCase(),
                    result.score(), result.queryCoverage(), result.matchedFields(), result.matchedTerms());
        }
    }

    public record RuleResponse(
            RuleView rule,
            String notice,
            String markdown
    ) {
    }

    public record RuleView(
            String id,
            String domain,
            String category,
            String title,
            String summary,
            String severity,
            String status,
            String evidenceLevel,
            String owner,
            String verifiedBy,
            LocalDate lastReviewedAt,
            String changeNote,
            com.commerce.context_engine.core.model.Applicability applicability,
            String rationale,
            String content,
            Map<String, List<String>> sections,
            List<String> checklist,
            List<com.commerce.context_engine.core.model.Evidence> evidence,
            List<String> tags,
            List<String> aliases,
            List<String> relatedRuleIds
    ) {
        static RuleView from(KnowledgeRule rule) {
            return new RuleView(
                    rule.id(), rule.domain(), rule.category(), rule.title(), rule.summary(),
                    value(rule.severity()), value(rule.status()), value(rule.evidenceLevel()),
                    rule.governance().owner(), emptyToNull(rule.governance().verifiedBy()),
                    rule.lastReviewedAt(), emptyToNull(rule.governance().changeNote()),
                    rule.applicability(), rule.rationale(), rule.content(), rule.sections(),
                    rule.checklist(), rule.evidence(), rule.tags(), rule.aliases(), rule.relatedRuleIds()
            );
        }
    }

    public record ChecklistResponse(String domain, List<ChecklistRule> rules, String notice, String markdown,
                                    int domainRuleCount, boolean partial, String message) {
    }

    public record ChecklistRule(
            String ruleId,
            String title,
            String severity,
            String status,
            String evidenceLevel,
            String owner,
            String verifiedBy,
            LocalDate lastReviewedAt,
            List<String> items,
            com.commerce.context_engine.core.model.Applicability applicability
    ) {
    }

    public record ReviewResponse(
            String artifactType,
            Set<String> detectedDomains,
            List<ReviewFindingView> findings,
            String notice,
            int analyzedChunks,
            boolean analysisTruncated
    ) {
        static ReviewResponse from(ReviewReport report) {
            return new ReviewResponse(
                    report.artifactType(),
                    report.detectedDomains(),
                    report.findings().stream().map(ReviewFindingView::from).toList(),
                    report.notice(), report.analyzedChunks(), report.analysisTruncated()
            );
        }
    }

    public record ReviewFindingView(
            String findingId,
            String ruleId,
            String severity,
            String status,
            String ruleStatus,
            String evidenceLevel,
            String owner,
            String verifiedBy,
            LocalDate lastReviewedAt,
            String title,
            String reason,
            List<String> matchedEvidence,
            List<String> recommendations
    ) {
        static ReviewFindingView from(com.commerce.context_engine.core.model.ReviewFinding finding) {
            return new ReviewFindingView(
                    finding.findingId(), finding.ruleId(), value(finding.severity()), value(finding.status()),
                    value(finding.ruleStatus()), value(finding.evidenceLevel()), finding.owner(),
                    finding.verifiedBy(), finding.lastReviewedAt(), finding.title(), finding.reason(),
                    finding.matchedEvidence(), finding.recommendations()
            );
        }
    }
}
