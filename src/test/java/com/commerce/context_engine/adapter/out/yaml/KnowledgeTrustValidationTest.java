package com.commerce.context_engine.adapter.out.yaml;

import com.commerce.context_engine.core.model.RuleStatus;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class KnowledgeTrustValidationTest {
    private static final String VALID = """
            schema-version: 1
            domain: example
            governance:
              owner: example-maintainers
            rules:
              - id: example-rule
                category: security
                title: Test rule
                summary: Test summary
                severity: high
                status: active
                tags: [example]
                applicability:
                  applies-when: ["condition"]
                review:
                  last-reviewed-at: 2026-07-21
                  verified-by: fixture-reviewer
                evidence:
                  - title: Fixture source
                    source: https://official.example/contract
                    type: official-documentation
                    accessed-at: 2026-07-21
            """;

    @Test void validMetadata_canRemainActive() throws Exception {
        assertThat(map(VALID).status()).isEqualTo(RuleStatus.ACTIVE);
    }

    @Test void blankApplicability_cannotActivateAHighRiskRule() throws Exception {
        assertThat(map(VALID.replace("[\"condition\"]", "[\"  \"]")).status()).isEqualTo(RuleStatus.NEEDS_REVIEW);
    }

    @Test void emptyEvidenceSource_isRejected() {
        assertThatThrownBy(() -> map(VALID.replace("https://official.example/contract", "\"  \"")))
                .hasMessageContaining("example-rule").hasMessageContaining("evidence[0].source");
    }

    @Test void halfReview_isRejected() {
        assertThatThrownBy(() -> map(VALID.replace("verified-by: fixture-reviewer", "verified-by: \"\"")))
                .hasMessageContaining("example-rule").hasMessageContaining("verified-by");
    }

    @Test void malformedReviewDate_namesTheFieldAndRule() {
        assertThatThrownBy(() -> map(VALID.replace("last-reviewed-at: 2026-07-21", "last-reviewed-at: bad-date")))
                .hasMessageContaining("example-rule").hasMessageContaining("review.last-reviewed-at");
    }

    @Test void futureReviewDate_isRejected() {
        assertThatThrownBy(() -> map(VALID.replace("last-reviewed-at: 2026-07-21", "last-reviewed-at: 2999-01-01")))
                .hasMessageContaining("review.last-reviewed-at");
    }

    @Test void externalEvidence_requiresAccessDate() {
        assertThatThrownBy(() -> map(VALID.replace("accessed-at: 2026-07-21", "note: no access date")))
                .hasMessageContaining("example-rule").hasMessageContaining("evidence[0].accessed-at");
    }

    @Test void futureAccessDate_isRejected() {
        assertThatThrownBy(() -> map(VALID.replace("accessed-at: 2026-07-21", "accessed-at: 2999-01-01")))
                .hasMessageContaining("evidence[0].accessed-at");
    }

    @Test void missingExplicitEvidence_cannotActivateAHighRiskRule() throws Exception {
        assertThat(map(VALID.substring(0, VALID.indexOf("    evidence:"))).status()).isEqualTo(RuleStatus.NEEDS_REVIEW);
    }

    @Test void internalEvidence_doesNotRequireAnExternalAccessDate() throws Exception {
        var rule = map(VALID.replace("https://official.example/contract", "docs/contract.md")
                .replace("official-documentation", "project-guidance")
                .replace("accessed-at: 2026-07-21", "note: fixture"));
        assertThat(rule.status()).isEqualTo(RuleStatus.ACTIVE);
        assertThat(rule.evidence().get(0).accessedAt()).isNull();
    }

    @Test void loaderAcceptsValidDocuments() {
        var catalog = new YamlKnowledgeCatalog();
        catalog.load(resource("valid.yml", VALID));
        assertThat(catalog.findById("example-rule")).isPresent();
    }

    @Test void loaderRejectsUnknownPropertiesWithSourceLocation() {
        assertThatThrownBy(() -> new YamlKnowledgeCatalog().load(resource("unknown.yml",
                VALID.replace("severity: high", "unexpected-field: true"))))
                .hasMessageContaining("unknown.yml").hasMessageContaining("unexpected-field").hasMessageContaining("line:");
    }

    @Test void loaderRejectsUnknownEnumsWithFileRuleAndField() {
        for (String field : java.util.List.of("severity", "status")) {
            String yaml = field.equals("severity") ? VALID.replace("severity: high", "severity: invalid")
                    : VALID.replace("status: active", "status: invalid");
            assertThatThrownBy(() -> new YamlKnowledgeCatalog().load(resource("enum.yml", yaml)))
                    .hasMessageContaining("enum.yml").hasMessageContaining("example-rule").hasMessageContaining(field);
        }
    }

    @Test void loaderRejectsDuplicateMappingKeysAtEveryLevel() {
        java.util.Map.of(
                "schema-version", VALID.replace("schema-version: 1", "schema-version: 1\nschema-version: 1"),
                "severity", VALID.replace("severity: high", "severity: high\n    severity: low"),
                "verified-by", VALID.replace("verified-by: fixture-reviewer",
                        "verified-by: fixture-reviewer\n      verified-by: replacement-reviewer")
        ).forEach((field, yaml) -> assertThatThrownBy(() -> new YamlKnowledgeCatalog().load(resource("duplicate.yml", yaml)))
                .hasMessageContaining("duplicate.yml").hasMessageContaining("Duplicate field '" + field + "'")
                .hasMessageContaining("line:"));
    }

    @Test void loaderRejectsDuplicateIdsAcrossDifferentDomains() {
        assertThatThrownBy(() -> new YamlKnowledgeCatalog().load(resource("first.yml", VALID),
                resource("second.yml", VALID.replace("domain: example", "domain: other"))))
                .hasMessageContaining("first.yml").hasMessageContaining("second.yml")
                .hasMessageContaining("Duplicate rule id: example-rule");
    }

    @Test void loaderRejectsUnknownRelatedIds() {
        assertThatThrownBy(() -> new YamlKnowledgeCatalog().load(resource("related.yml",
                VALID.replace("tags: [example]", "tags: [example]\n    related-rule-ids: [missing-rule]"))))
                .hasMessageContaining("related.yml").hasMessageContaining("example-rule.related-rule-ids")
                .hasMessageContaining("missing-rule");
    }

    @Test void loaderRejectsMissingOwnersAndEmptyTags() {
        assertThatThrownBy(() -> new YamlKnowledgeCatalog().load(resource("owner.yml",
                VALID.replace("owner: example-maintainers", "owner: \"\""))))
                .hasMessageContaining("owner.yml").hasMessageContaining("governance.owner");
        assertThatThrownBy(() -> new YamlKnowledgeCatalog().load(resource("tags.yml", VALID.replace("[example]", "[]"))))
                .hasMessageContaining("tags.yml").hasMessageContaining("example-rule.tags");
    }

    @Test void loaderRejectsDuplicateDomains() {
        assertThatThrownBy(() -> new YamlKnowledgeCatalog().load(resource("first.yml", VALID),
                resource("second.yml", VALID.replace("id: example-rule", "id: other-rule"))))
                .hasMessageContaining("second.yml").hasMessageContaining("Duplicate knowledge domain: example");
    }

    @Test void explicitEvidenceRequiresTitleTypeAndValidWebLocation() {
        for (String yaml : java.util.List.of(VALID.replace("title: Fixture source", "title: \"\""),
                VALID.replace("type: official-documentation", "type: \"\""),
                VALID.replace("https://official.example/contract", "https://"))) {
            assertThatThrownBy(() -> map(yaml)).hasMessageContaining("example-rule").hasMessageContaining("evidence[0]");
        }
    }

    private ByteArrayResource resource(String name, String yaml) {
        return new ByteArrayResource(yaml.getBytes(StandardCharsets.UTF_8)) {
            @Override public String getFilename() { return name; }
        };
    }

    private com.commerce.context_engine.core.model.KnowledgeRule map(String yaml) throws Exception {
        var doc = YAMLMapper.builder().findAndAddModules().build().readValue(yaml, KnowledgeYamlDocument.class);
        return new YamlKnowledgeCatalog().map(doc.domain(), doc.governance(), doc.rules().get(0));
    }
}
