package com.commerce.context_engine.adapter.out.render;

import com.commerce.context_engine.core.model.KnowledgeRule;
import com.commerce.context_engine.core.model.ResponseDetail;
import com.commerce.context_engine.core.model.SearchResult;
import com.commerce.context_engine.core.port.KnowledgeRenderer;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Component("v2KnowledgeRenderer")
public class MarkdownKnowledgeRenderer implements KnowledgeRenderer {

    private static final Map<String, String> HEADERS = Map.of(
            "guidance", "### 구현 가이드",
            "invariants", "### 반드시 지켜야 할 원칙",
            "workflow", "### 권장 흐름",
            "technical-guidance", "### 기술 구현 참고",
            "spring-guidance", "### Java Spring 구현 가이드",
            "avoid-patterns", "### 피해야 할 패턴",
            "failure-scenarios", "### 실패 시나리오"
    );

    @Override
    public String renderRules(List<KnowledgeRule> rules, ResponseDetail detail) {
        return rules.stream().map(rule -> renderRule(rule, detail))
                .collect(Collectors.joining("\n\n---\n\n"));
    }

    @Override
    public String renderSearchResults(List<SearchResult> results, ResponseDetail detail) {
        return results.stream().map(result -> {
            String metadata = "- relevance: `" + result.score() + "`"
                    + " / coverage: `" + result.queryCoverage() + "`"
                    + " / match-confidence: `" + result.confidence().name().toLowerCase() + "`"
                    + " / matched: `" + String.join(", ", result.matchedFields()) + "`\n";
            return renderRule(result.rule(), detail).replaceFirst("\n", "\n" + metadata);
        }).collect(Collectors.joining("\n\n---\n\n"));
    }

    @Override
    public String renderChecklist(List<KnowledgeRule> rules) {
        return rules.stream().filter(rule -> !rule.checklist().isEmpty()).map(rule -> {
            return "## " + rule.title() + "\n"
                    + "- knowledgeId: `" + rule.id() + "`\n"
                    + "- status: `" + rule.status().name().toLowerCase().replace('_', '-') + "`\n"
                    + "- evidence-level: `" + rule.evidenceLevel().name().toLowerCase().replace('_', '-') + "`\n"
                    + "- owner: `" + rule.governance().owner() + "`\n"
                    + "- verified-by: `" + optional(rule.governance().verifiedBy()) + "`\n"
                    + "- last-reviewed: `" + (rule.lastReviewedAt() == null ? "not-recorded" : rule.lastReviewedAt()) + "`\n"
                    + "### 적용 조건\n" + bullets(rule.applicability().appliesWhen()) + "\n"
                    + (rule.applicability().doesNotApplyWhen().isEmpty() ? "" :
                        "### 적용하지 않는 조건\n" + bullets(rule.applicability().doesNotApplyWhen()) + "\n")
                    + "### 전제와 범위\n- jurisdiction: `" + rule.applicability().jurisdiction() + "`\n"
                    + bullets(rule.applicability().assumptions()) + "\n"
                    + "### 검토 문항\n"
                    + rule.checklist().stream().map(item -> "- [ ] " + item).collect(Collectors.joining("\n"));
        }).filter(value -> !value.isBlank()).collect(Collectors.joining("\n\n"));
    }

    private String renderRule(KnowledgeRule rule, ResponseDetail detail) {
        StringBuilder builder = new StringBuilder();
        builder.append("## ").append(rule.title()).append("\n")
                .append("- knowledgeId: `").append(rule.id()).append("`\n")
                .append("- domain: `").append(rule.domain()).append("`\n")
                .append("- category: `").append(rule.category()).append("`\n")
                .append("- severity: `").append(rule.severity().name().toLowerCase()).append("`\n")
                .append("- status: `").append(rule.status().name().toLowerCase().replace('_', '-')).append("`\n")
                .append("- evidence-level: `").append(rule.evidenceLevel().name().toLowerCase().replace('_', '-')).append("`\n")
                .append("- owner: `").append(rule.governance().owner()).append("`\n")
                .append("- verified-by: `").append(optional(rule.governance().verifiedBy())).append("`\n")
                .append("- last-reviewed: `").append(rule.lastReviewedAt() == null ? "not-recorded" : rule.lastReviewedAt()).append("`\n")
                .append("- summary: ").append(rule.summary());

        if (detail == ResponseDetail.SUMMARY) {
            return builder.toString();
        }

        builder.append("\n\n### 적용 조건\n")
                .append(bullets(rule.applicability().appliesWhen()));
        if (!rule.applicability().doesNotApplyWhen().isEmpty()) {
            builder.append("\n\n### 적용하지 않는 조건\n")
                    .append(bullets(rule.applicability().doesNotApplyWhen()));
        }
        builder.append("\n\n### 전제와 범위\n")
                .append("- jurisdiction: `").append(rule.applicability().jurisdiction()).append("`");
        if (!rule.applicability().assumptions().isEmpty()) {
            builder.append("\n").append(bullets(rule.applicability().assumptions()));
        }
        builder.append("\n\n### 판단 근거\n").append(rule.rationale());
        if (!rule.content().isBlank()) {
            builder.append("\n\n### 이커머스 맥락\n").append(rule.content());
        }
        rule.sections().forEach((name, values) -> {
            builder.append("\n\n").append(HEADERS.getOrDefault(name, "### " + name)).append("\n");
            builder.append("workflow".equals(name) ? numbered(values) : bullets(values));
        });
        if (!rule.checklist().isEmpty()) {
            builder.append("\n\n### 검토 체크리스트\n")
                    .append(rule.checklist().stream().map(item -> "- [ ] " + item)
                            .collect(Collectors.joining("\n")));
        }
        if (!rule.evidence().isEmpty()) {
            builder.append("\n\n### 출처와 검토 상태\n");
            builder.append(rule.evidence().stream()
                    .map(evidence -> "- " + evidence.title() + " — " + evidence.source()
                            + " (type: " + evidence.type()
                            + ", source-version: " + optional(evidence.sourceVersion())
                            + ", accessed: " + (evidence.accessedAt() == null ? "not-recorded" : evidence.accessedAt())
                            + ", reviewed: " + (evidence.reviewedAt() == null ? "not-recorded" : evidence.reviewedAt()) + ")"
                            + (evidence.note().isBlank() ? "" : " — " + evidence.note()))
                    .collect(Collectors.joining("\n")));
        }
        if (!rule.governance().changeNote().isBlank()) {
            builder.append("\n\n### 변경 사유\n").append(rule.governance().changeNote());
        }
        return builder.toString();
    }

    private static String bullets(List<String> values) {
        return values.stream().map(value -> "- " + value).collect(Collectors.joining("\n"));
    }

    private static String numbered(List<String> values) {
        return IntStream.range(0, values.size())
                .mapToObj(index -> (index + 1) + ". " + values.get(index))
                .collect(Collectors.joining("\n"));
    }

    private static String optional(String value) {
        return value == null || value.isBlank() ? "not-recorded" : value;
    }
}
