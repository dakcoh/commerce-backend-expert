package com.commerce.context_engine.application.search;

import com.commerce.context_engine.core.model.*;
import com.commerce.context_engine.core.port.KnowledgeReviewer;
import com.commerce.context_engine.core.port.KnowledgeSearch;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class SearchImprovementRegressionTest {
    @Autowired KnowledgeSearch search;
    @Autowired KnowledgeReviewer reviewer;

    @Test
    void severalTopicTerms_outweighOneAliasInAnExpandedBody() {
        var query = new QueryNormalizer().normalize("할인 세금 배송비 결제 금액 스냅샷");
        String body = "할인 세금 배송비 결제 금액 스냅샷";
        var focused = fixture("price", "가격 금액 스냅샷", "가격 계산", List.of(), body);
        var broad = fixture("refund", "부분 환불", "할인 회수", List.of("할인"), body);
        var scorer = new RelevanceScorer();
        assertThat(scorer.score(focused, query).score()).isGreaterThan(scorer.score(broad, query).score());
    }

    @Test
    void repeatedBoilerplate_doesNotConsumeTheDistinctTermBudget() {
        var normalized = new QueryNormalizer().normalize("boilerplate ".repeat(100) + "웹훅 서명");
        assertThat(normalized.terms()).contains("웹훅", "서명").hasSize(3);
    }

    @Test
    void distinctTermBudget_remainsBounded() {
        String query = java.util.stream.IntStream.range(0, 100).mapToObj(i -> "term" + i)
                .collect(java.util.stream.Collectors.joining(" "));
        assertThat(new QueryNormalizer().normalize(query).terms()).hasSize(32);
    }

    @Test
    void priceAndReturnFlow_regainTheirPrimaryRules() {
        assertThat(search.search(SearchQuery.of("할인 세금 배송비가 반영된 결제 금액 스냅샷")).get(0).rule().id())
                .isEqualTo("commerce-pricing-money");
        assertThat(search.search(SearchQuery.of("반품 접수 후 회수 배송과 환불 순서")).get(0).rule().id())
                .isEqualTo("commerce-fulfillment-reverse-logistics");
    }

    @Test
    void javaImports_doNotHideTheWebhookCode() {
        String imports = java.util.stream.IntStream.range(0, 40)
                .mapToObj(i -> "import example.library.Type" + i + ";\n")
                .collect(java.util.stream.Collectors.joining());
        assertWebhookCandidate(imports + webhookCode(), "");
        assertWebhookCandidate(imports + webhookCode(), "결제 웹훅 서명");
    }

    @Test
    void longRepeatedPreamble_doesNotHideTheWebhookCode() {
        assertWebhookCandidate("/* " + "boilerplate ".repeat(17000) + " */\n" + webhookCode(), "");
    }

    @Test
    void ownershipQuestions_includeTheSecurityRule() {
        for (String query : List.of("다른 회원의 주문번호로 API 조회하면 데이터가 보이네", "타인 주문 소유권 검증")) {
            assertThat(search.search(new SearchQuery(query, Set.of(), Set.of(), Set.of(), 3, ResponseDetail.SUMMARY, false)))
                    .as(query).extracting(r -> r.rule().id()).contains("spring-security-authz");
        }
    }

    @Test
    void operationalNames_findStatementsAndTransactionBoundaries() {
        assertThat(search.search(SearchQuery.of("수수료율 변경 후 과거 정산서 금액이 바뀌어")))
                .extracting(r -> r.rule().id()).contains("settlement-statement");
        assertThat(search.search(SearchQuery.of("@Transactional로 PG 외부 호출까지 묶었어")))
                .extracting(r -> r.rule().id()).contains("spring-commerce-transaction-boundary");
    }

    @Test
    void inventoryPhrases_distinguishQuantityAndReservationLifecycle() {
        assertThat(search.search(SearchQuery.of("재고가 마이너스 돼요")).get(0).rule().id())
                .isEqualTo("available-stock-query");
        assertThat(search.search(new SearchQuery("예약 해제 이벤트 두 번 전달", Set.of(), Set.of(), Set.of(),
                3, ResponseDetail.SUMMARY, false))).extracting(r -> r.rule().id()).contains("stock-reservation");
    }

    @Test
    void documentAliases_doNotTakeOverDeductionQuestions() {
        assertThat(search.search(SearchQuery.of("수수료 반품 프로모션 분담금 정산 공제")).get(0).rule().id())
                .isEqualTo("settlement-deduction");
    }

    private void assertWebhookCandidate(String artifact, String scenario) {
        var report = reviewer.review(new ReviewRequest(artifact, "code", Set.of("payment"), scenario, 5));
        assertThat(report.findings()).extracting(ReviewFinding::ruleId).contains("webhook-handling");
        assertThat(report.findings()).allMatch(f -> f.status() == FindingStatus.REVIEW_REQUIRED);
    }

    private String webhookCode() {
        return "// 결제 웹훅 서명 검증 없이 주문 완료 처리\n"
                + "@PostMapping(\"/webhook\") public void webhook(PaymentEvent event) { order.setStatus(\"PAID\"); }";
    }

    private KnowledgeRule fixture(String id, String title, String summary, List<String> aliases, String body) {
        return new KnowledgeRule(id, "example", "example", title, summary, RuleSeverity.MEDIUM,
                null, summary, body, Map.of(), List.of(), List.of(), List.of(), aliases, List.of(),
                null, null, RuleStatus.ACTIVE);
    }
}
