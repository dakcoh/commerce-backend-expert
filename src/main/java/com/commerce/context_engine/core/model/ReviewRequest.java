package com.commerce.context_engine.core.model;

import java.util.Set;

public record ReviewRequest(
        String artifact,
        String artifactType,
        Set<String> domains,
        String scenario,
        int maxFindings
) {
    public ReviewRequest {
        if (artifact == null || artifact.isBlank()) {
            throw new IllegalArgumentException("artifact must not be blank");
        }
        artifact = artifact.trim();
        artifactType = artifactType == null || artifactType.isBlank() ? "design"
                : artifactType.trim().toLowerCase(java.util.Locale.ROOT);
        if (!Set.of("design", "api", "ddl", "code").contains(artifactType)) {
            throw new IllegalArgumentException("artifactType must be design, api, ddl or code");
        }
        domains = domains == null ? Set.of() : Set.copyOf(domains);
        scenario = scenario == null ? "" : scenario.trim();
        if (maxFindings <= 0 || maxFindings > SearchQuery.MAX_TOP_K) {
            throw new IllegalArgumentException("maxFindings must be between 1 and " + SearchQuery.MAX_TOP_K);
        }
    }
}
