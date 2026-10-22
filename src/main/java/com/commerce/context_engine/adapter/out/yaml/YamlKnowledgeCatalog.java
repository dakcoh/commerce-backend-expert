package com.commerce.context_engine.adapter.out.yaml;

import com.commerce.context_engine.core.model.Applicability;
import com.commerce.context_engine.core.model.Evidence;
import com.commerce.context_engine.core.model.KnowledgeRule;
import com.commerce.context_engine.core.model.KnowledgeGovernance;
import com.commerce.context_engine.core.model.RuleSeverity;
import com.commerce.context_engine.core.model.RuleStatus;
import com.commerce.context_engine.core.port.KnowledgeCatalog;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

@Repository
public class YamlKnowledgeCatalog implements KnowledgeCatalog {

    private static final String LOCATION = "classpath*:knowledge/*.yml";
    private static final Pattern RULE_ID = Pattern.compile("[a-z0-9]+(?:-[a-z0-9]+)*");
    private static final ZoneId KNOWLEDGE_DATE_ZONE = ZoneId.of("Asia/Seoul");
    private final YAMLMapper mapper = YAMLMapper.builder()
            .findAndAddModules()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION)
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();
    private final PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
    private final Clock clock;

    public YamlKnowledgeCatalog() {
        this(Clock.systemUTC());
    }

    YamlKnowledgeCatalog(Clock clock) {
        this.clock = clock.withZone(KNOWLEDGE_DATE_ZONE);
    }

    private List<KnowledgeRule> rules = List.of();
    private Map<String, KnowledgeRule> byId = Map.of();
    private Set<String> domains = Set.of();

    @PostConstruct
    void load() {
        try {
            load(resolver.getResources(LOCATION));
        }
        catch (IOException exception) {
            throw new IllegalStateException("Failed to resolve knowledge YAML at " + LOCATION, exception);
        }
    }

    void load(Resource... resources) {
        List<Resource> ordered = java.util.Arrays.stream(resources)
                .sorted(Comparator.comparing(resource -> Optional.ofNullable(resource.getFilename()).orElse("")))
                .toList();
        if (ordered.isEmpty()) {
            throw new IllegalStateException("No knowledge YAML found at " + LOCATION);
        }

        List<KnowledgeRule> loaded = new ArrayList<>();
        Set<String> loadedDomains = new LinkedHashSet<>();
        Map<String, String> sourceFiles = new LinkedHashMap<>();
        for (Resource resource : ordered) {
            String name = Optional.ofNullable(resource.getFilename()).orElse(resource.getDescription());
            try {
                KnowledgeYamlDocument document;
                try (var input = resource.getInputStream()) {
                    document = mapper.readValue(input, KnowledgeYamlDocument.class);
                }
                validateDocument(document, resource);
                if (!loadedDomains.add(document.domain())) {
                    throw new IllegalStateException("Duplicate knowledge domain: " + document.domain());
                }
                for (KnowledgeYamlDocument.RuleDocument rule : document.rules()) {
                    KnowledgeRule mapped = map(document.domain(), document.governance(), rule);
                    String previous = sourceFiles.putIfAbsent(mapped.id(), name);
                    if (previous != null) {
                        throw new IllegalStateException("Duplicate rule id: " + mapped.id() + " also in " + previous);
                    }
                    loaded.add(mapped);
                }
            }
            catch (IOException | RuntimeException exception) {
                throw new IllegalStateException(name + ": " + exception.getMessage(), exception);
            }
        }
        validateRules(loaded, sourceFiles);
        this.rules = List.copyOf(loaded);
        this.byId = loaded.stream().collect(java.util.stream.Collectors.toUnmodifiableMap(
                KnowledgeRule::id, rule -> rule));
        this.domains = java.util.Collections.unmodifiableSet(new LinkedHashSet<>(loadedDomains));
    }

    @Override
    public List<KnowledgeRule> findAll() {
        return rules;
    }

    @Override
    public Optional<KnowledgeRule> findById(String id) {
        if (id == null || id.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(byId.get(id.trim()));
    }

    @Override
    public List<KnowledgeRule> findByDomains(Set<String> requestedDomains) {
        if (requestedDomains == null || requestedDomains.isEmpty()) {
            return rules;
        }
        return rules.stream().filter(rule -> requestedDomains.contains(rule.domain())).toList();
    }

    @Override
    public Set<String> domains() {
        return domains;
    }

    KnowledgeRule map(
            String domain,
            KnowledgeYamlDocument.GovernanceDocument governance,
            KnowledgeYamlDocument.RuleDocument source
    ) {
        try {
            validateSource(source);
            KnowledgeYamlDocument.ReviewDocument review = source.review();
            LocalDate reviewedAt = review == null ? null : parseDate(review.lastReviewedAt(), null);
            RuleStatus status = inferStatus(source);
            Map<String, List<String>> sections = new LinkedHashMap<>();
            add(sections, "guidance", source.guidance());
            add(sections, "invariants", source.invariants());
            add(sections, "workflow", source.workflow());
            add(sections, "technical-guidance", source.technicalGuidance());
            add(sections, "spring-guidance", source.springGuidance());
            add(sections, "avoid-patterns", source.avoidPatterns());
            add(sections, "failure-scenarios", source.failureScenarios());

            String content = firstNonBlank(source.content(), source.businessContext());
            String rationale = firstNonBlank(source.rationale(), source.businessContext(), source.summary());
            Applicability applicability = mapApplicability(domain, source.category(), source.applicability());
            List<Evidence> evidence = mapEvidence(domain, reviewedAt, source.evidence());
            KnowledgeGovernance ruleGovernance = new KnowledgeGovernance(
                    governance.owner(),
                    review == null ? null : review.verifiedBy(),
                    review == null ? null : review.changeNote()
            );

            return new KnowledgeRule(
                    source.id(), domain, source.category(), source.title(), source.summary(),
                    inferSeverity(source), applicability, rationale, content, sections,
                    safe(source.checklist()), evidence, safe(source.tags()), safe(source.aliases()),
                    safe(source.relatedRuleIds()), ruleGovernance, reviewedAt, status
            );
        }
        catch (RuntimeException exception) {
            throw new IllegalStateException("Rule " + (source == null ? "<null>" : source.id())
                    + ": " + exception.getMessage(), exception);
        }
    }

    private void validateSource(KnowledgeYamlDocument.RuleDocument source) {
        if (source == null) {
            throw new IllegalStateException("rules entry must not be null");
        }
        try {
            inferSeverity(source);
        }
        catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Invalid severity: " + source.severity(), exception);
        }
        try {
            RuleStatus.from(source.status());
        }
        catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Invalid status: " + source.status(), exception);
        }
        var review = source.review();
        if (review != null) {
            boolean reviewer = review.verifiedBy() != null && !review.verifiedBy().isBlank();
            boolean date = review.lastReviewedAt() != null && !review.lastReviewedAt().isBlank();
            if (reviewer != date) {
                throw new IllegalStateException("review.verified-by and review.last-reviewed-at must be recorded together");
            }
            validateDate(review.lastReviewedAt(), "review.last-reviewed-at");
        }
        var evidenceSources = source.evidence() == null ? List.<KnowledgeYamlDocument.EvidenceDocument>of() : source.evidence();
        for (int i = 0; i < evidenceSources.size(); i++) {
            var evidence = evidenceSources.get(i);
            String field = "evidence[" + i + "]";
            if (evidence == null) {
                throw new IllegalStateException(field + " must not be null");
            }
            requireText(evidence.title(), field + ".title");
            String location = firstNonBlank(evidence.source(), evidence.url());
            requireText(location, field + ".source");
            requireText(evidence.type(), field + ".type");
            boolean webSource = location.startsWith("https://") || location.startsWith("http://");
            if (webSource) {
                try {
                    if (java.net.URI.create(location).getHost() == null) {
                        throw new IllegalArgumentException("missing host");
                    }
                }
                catch (IllegalArgumentException exception) {
                    throw new IllegalStateException(field + ".source must be a valid HTTP(S) URL", exception);
                }
            }
            if (webSource && !Set.of("project-guidance", "internal-reference")
                    .contains(evidence.type().trim().toLowerCase(java.util.Locale.ROOT))) {
                requireText(evidence.accessedAt(), field + ".accessed-at");
            }
            validateDate(evidence.publishedAt(), field + ".published-at");
            validateDate(evidence.reviewedAt(), field + ".reviewed-at");
            validateDate(evidence.accessedAt(), field + ".accessed-at");
        }
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(field + " must not be blank");
        }
    }

    private void validateDate(String value, String field) {
        if (value == null || value.isBlank()) {
            return;
        }
        try {
            if (LocalDate.parse(value.trim()).isAfter(LocalDate.now(clock))) {
                throw new IllegalStateException(field + " must not be in the future");
            }
        }
        catch (java.time.format.DateTimeParseException exception) {
            throw new IllegalStateException(field + " must be an ISO date (yyyy-MM-dd)", exception);
        }
    }

    private static Applicability mapApplicability(
            String domain,
            String category,
            KnowledgeYamlDocument.ApplicabilityDocument source
    ) {
        if (source == null) {
            return Applicability.defaultFor(domain, category);
        }
        return new Applicability(source.appliesWhen(), source.doesNotApplyWhen(),
                source.assumptions(), source.jurisdiction());
    }

    private static List<Evidence> mapEvidence(
            String domain,
            LocalDate reviewedAt,
            List<KnowledgeYamlDocument.EvidenceDocument> sources
    ) {
        if (sources == null || sources.isEmpty()) {
            return List.of(new Evidence(
                    "프로젝트 관리 지식 — 외부 근거 미첨부",
                    "src/main/resources/knowledge/" + domain + ".yml",
                    "project-guidance",
                    "",
                    null,
                    reviewedAt,
                    null,
                    "프로젝트가 관리하는 일반 설계 지침이다. 독립적인 외부 근거로 간주하지 말고, 고위험 결정은 최신 공식 자료로 확인한다."
            ));
        }
        return sources.stream().map(source -> new Evidence(
                source.title(), firstNonBlank(source.source(), source.url()), source.type(),
                source.sourceVersion(), parseDate(source.publishedAt(), null),
                parseDate(source.reviewedAt(), reviewedAt), parseDate(source.accessedAt(), null), source.note()
        )).toList();
    }

    private static RuleSeverity inferSeverity(KnowledgeYamlDocument.RuleDocument source) {
        if (source.severity() != null && !source.severity().isBlank()) {
            return RuleSeverity.from(source.severity());
        }
        String category = Optional.ofNullable(source.category()).orElse("");
        if (Set.of("tax", "security", "webhook", "payout", "concurrency", "state-machine")
                .contains(category)) {
            return RuleSeverity.HIGH;
        }
        if ("checklist".equals(category)) {
            return RuleSeverity.INFO;
        }
        return RuleSeverity.MEDIUM;
    }

    private static RuleStatus inferStatus(KnowledgeYamlDocument.RuleDocument source) {
        RuleStatus declared = RuleStatus.from(source.status());
        if (declared == RuleStatus.DEPRECATED || declared == RuleStatus.NEEDS_REVIEW) {
            return declared;
        }
        RuleSeverity severity = inferSeverity(source);
        boolean highRisk = severity == RuleSeverity.CRITICAL || severity == RuleSeverity.HIGH;
        KnowledgeYamlDocument.ReviewDocument review = source.review();
        boolean traceable = source.applicability() != null
                && source.applicability().appliesWhen() != null
                && source.applicability().appliesWhen().stream().anyMatch(value -> value != null && !value.isBlank())
                && review != null
                && review.lastReviewedAt() != null && !review.lastReviewedAt().isBlank()
                && review.verifiedBy() != null && !review.verifiedBy().isBlank()
                && source.evidence() != null && !source.evidence().isEmpty();
        return highRisk && !traceable ? RuleStatus.NEEDS_REVIEW : RuleStatus.ACTIVE;
    }

    private static void validateDocument(KnowledgeYamlDocument document, Resource resource) {
        String name = Optional.ofNullable(resource.getFilename()).orElse(resource.getDescription());
        if (document == null || document.schemaVersion() != 1) {
            throw new IllegalStateException(name + " must declare schema-version: 1");
        }
        if (document.domain() == null || document.domain().isBlank()) {
            throw new IllegalStateException(name + " must declare domain");
        }
        if (document.governance() == null || document.governance().owner() == null
                || document.governance().owner().isBlank()) {
            throw new IllegalStateException(name + " must declare governance.owner");
        }
        if (document.rules() == null || document.rules().isEmpty()) {
            throw new IllegalStateException(name + " must contain rules");
        }
    }

    private static void validateRules(List<KnowledgeRule> loaded, Map<String, String> sourceFiles) {
        Set<String> ids = new LinkedHashSet<>();
        for (KnowledgeRule rule : loaded) {
            if (!RULE_ID.matcher(rule.id()).matches()) {
                throw new IllegalStateException(sourceFiles.get(rule.id()) + ": Invalid rule id: " + rule.id());
            }
            if (!ids.add(rule.id())) {
                throw new IllegalStateException("Duplicate rule id: " + rule.id());
            }
            if (rule.tags().isEmpty()) {
                throw new IllegalStateException(sourceFiles.get(rule.id()) + ": " + rule.id() + ".tags must not be empty");
            }
            if (rule.governance().owner().isBlank()) {
                throw new IllegalStateException(sourceFiles.get(rule.id()) + ": " + rule.id() + ".owner must not be empty");
            }
        }
        for (KnowledgeRule rule : loaded) {
            for (String related : rule.relatedRuleIds()) {
                if (!ids.contains(related)) {
                    throw new IllegalStateException(sourceFiles.get(rule.id()) + ": Unknown related rule "
                            + related + " in " + rule.id() + ".related-rule-ids");
                }
            }
        }
    }

    private static void add(Map<String, List<String>> sections, String name, List<String> values) {
        List<String> safeValues = safe(values);
        if (!safeValues.isEmpty()) {
            sections.put(name, safeValues);
        }
    }

    private static List<String> safe(List<String> values) {
        return values == null ? List.of() : values;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private static LocalDate parseDate(String value, LocalDate fallback) {
        return value == null || value.isBlank() ? fallback : LocalDate.parse(value.trim());
    }
}
