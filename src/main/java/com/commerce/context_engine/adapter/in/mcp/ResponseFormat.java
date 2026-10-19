package com.commerce.context_engine.adapter.in.mcp;

import java.util.Locale;

enum ResponseFormat {
    JSON, BOTH;

    static ResponseFormat from(String value) {
        if (value == null || value.isBlank()) return BOTH;
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("responseFormat must be json or both");
        }
    }
}
