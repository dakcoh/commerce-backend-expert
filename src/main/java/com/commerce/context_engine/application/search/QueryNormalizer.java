package com.commerce.context_engine.application.search;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;

public class QueryNormalizer {

    private static final int MAX_TERMS = 32;
    private static final Set<String> STOP_WORDS = Set.of(
            "그리고", "또는", "에서", "으로", "하는", "있는", "대한", "위한",
            "방법", "전체", "확인", "싶어", "궁금해", "해줘",
            "public", "private", "class", "void", "string", "return", "this", "new"
    );
    private static final List<String> KOREAN_PARTICLES = List.of(
            "으로부터", "에서", "에게", "처럼", "보다", "으로", "하고", "하며",
            "라고", "이라", "과", "와", "은", "는", "이", "가", "을", "를", "의", "에", "로", "도", "만"
    );
    private static final List<String> KOREAN_VERB_ENDINGS = List.of(
            "했습니다", "했는데", "했어요", "하려고", "하려면", "합니다", "했어", "한다"
    );

    public NormalizedQuery normalize(String query) {
        String normalized = normalizeText(query);
        // A contrast replaces the topic; additive phrases such as '뿐만 아니라' do not match.
        normalized = normalized.replaceFirst("^.*?(?:가|이)\\s*아니라\\s+(.+)$", "$1");
        LinkedHashSet<String> terms = tokenize(normalized)
                .distinct()
                .limit(MAX_TERMS)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        return new NormalizedQuery(normalized, stripSpaces(normalized), List.copyOf(terms));
    }

    public List<String> distinctTerms(String text) {
        return tokenize(normalizeText(text)).distinct().toList();
    }

    private static Stream<String> tokenize(String normalized) {
        return Arrays.stream(normalized.split("[^\\p{L}\\p{N}@_-]+"))
                .map(String::trim)
                .map(QueryNormalizer::stripVerbEnding)
                .map(QueryNormalizer::stripKoreanParticle)
                .filter(term -> term.length() >= 2)
                .filter(term -> !STOP_WORDS.contains(term));
    }

    private static String stripVerbEnding(String value) {
        for (String ending : KOREAN_VERB_ENDINGS) {
            if (value.endsWith(ending) && value.length() - ending.length() >= 2) {
                return value.substring(0, value.length() - ending.length());
            }
        }
        return value;
    }

    static String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    static String stripSpaces(String value) {
        return value.replaceAll("\\s+", "");
    }

    private static String stripKoreanParticle(String value) {
        for (String particle : KOREAN_PARTICLES) {
            if (value.endsWith(particle) && value.length() - particle.length() >= 2) {
                return value.substring(0, value.length() - particle.length());
            }
        }
        return value;
    }

    public record NormalizedQuery(String phrase, String compactPhrase, List<String> terms) {
        public boolean isBlank() {
            return phrase.isBlank();
        }
    }
}
