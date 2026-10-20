package com.commerce.context_engine.application.search;

import com.commerce.context_engine.core.model.SearchQuery;
import com.commerce.context_engine.core.port.KnowledgeSearch;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class SearchEvaluationTest {

    @Autowired
    KnowledgeSearch search;

    @Test
    void representativeQueries_findExpectedRuleWithinTopThree() throws Exception {
        evaluate("search-evaluation.tsv", 100, 90, 10);
    }

    @Test
    void conversationalQueries_rejectUnrelatedBookingAndKeepBusinessAlternatives() throws Exception {
        evaluate("search-additional-evaluation.tsv", 26, 18, 8);
    }

    private void evaluate(String resource, int expectedRows, int expectedPositive, int expectedNoAnswer) throws Exception {
        String fixture = new ClassPathResource(resource)
                .getContentAsString(StandardCharsets.UTF_8);
        var failures = new ArrayList<String>();
        int rowCount = 0;
        int positiveCount = 0;
        int topOneCount = 0;
        int noAnswerCount = 0;

        for (String line : fixture.lines().filter(value -> !value.isBlank() && !value.startsWith("#")).toList()) {
            rowCount++;
            String[] columns = line.split("\\t", 2);
            assertThat(columns)
                    .as("evaluation row must be query<TAB>rule-id: %s", line)
                    .hasSize(2);

            String query = columns[0];
            String expectedRuleId = columns[1];
            var topThree = search.search(new SearchQuery(
                    query, java.util.Set.of(), java.util.Set.of(), java.util.Set.of(),
                    3, com.commerce.context_engine.core.model.ResponseDetail.SUMMARY, false));

            var actualIds = topThree.stream().map(result -> result.rule().id()).toList();
            if (expectedRuleId.equals("NONE")) {
                noAnswerCount++;
                if (!actualIds.isEmpty()) {
                    failures.add("query '%s' expected no result, actual=%s".formatted(
                            query, Arrays.toString(actualIds.toArray())));
                }
                continue;
            }
            positiveCount++;
            if (!actualIds.isEmpty() && actualIds.get(0).equals(expectedRuleId)) {
                topOneCount++;
            }
            if (!actualIds.contains(expectedRuleId)) {
                failures.add("query '%s' expected %s, actual=%s".formatted(
                        query, expectedRuleId, Arrays.toString(actualIds.toArray())));
            }
        }

        assertThat(rowCount).as("search evaluation scenario count").isEqualTo(expectedRows);
        assertThat(positiveCount).isEqualTo(expectedPositive);
        assertThat(noAnswerCount).isEqualTo(expectedNoAnswer);
        assertThat(failures).as("search evaluation failures").isEmpty();
        System.out.printf("Search evaluation: top1=%d/%d (%.1f%%), top3=%d/%d, no-answer=%d/%d%n",
                topOneCount, positiveCount, topOneCount * 100.0 / positiveCount,
                positiveCount, positiveCount, noAnswerCount, noAnswerCount);
    }
}
