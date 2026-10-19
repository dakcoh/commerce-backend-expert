package com.commerce.context_engine.core.model;

import java.util.Locale;

public enum ResponseDetail {
    SUMMARY,
    FULL;

    public static ResponseDetail from(String value) {
        if (value == null || value.isBlank()) {
            return SUMMARY;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("detail must be summary or full");
        }
    }
}
