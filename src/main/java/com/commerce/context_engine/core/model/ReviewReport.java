package com.commerce.context_engine.core.model;

import java.util.List;
import java.util.Set;

public record ReviewReport(
        String artifactType,
        Set<String> detectedDomains,
        List<ReviewFinding> findings,
        String notice,
        int analyzedChunks,
        boolean analysisTruncated
) {
    public ReviewReport {
        detectedDomains = detectedDomains == null
                ? Set.of()
                : java.util.Collections.unmodifiableSet(new java.util.LinkedHashSet<>(detectedDomains));
        findings = findings == null ? List.of() : List.copyOf(findings);
        notice = notice == null ? "" : notice;
    }
}
