package com.commerce.context_engine.application.review;

import com.commerce.context_engine.core.model.ReviewRequest;
import com.commerce.context_engine.core.port.KnowledgeReviewer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ReviewSignalRegressionTest {
    @Autowired KnowledgeReviewer reviewer;
    private static final String WEBHOOK = "// 결제 웹훅 서명 검증 멱등성 중복 이벤트 처리\n"
            + "@PostMapping(\"/webhook\") public void webhook(PaymentEvent event) { order.setStatus(\"PAID\"); }";

    @Test
    void businessSignalsSurviveUniqueFieldsAtEitherEndAndAnIndependentScenario() {
        String fields = IntStream.range(0, 45).mapToObj(i -> "private int opaqueField%03d;".formatted(i))
                .collect(Collectors.joining("\n"));
        for (String artifact : new String[]{WEBHOOK, WEBHOOK + fields, fields + WEBHOOK}) {
            assertWebhook(artifact, "");
            assertWebhook(artifact, "결제 웹훅 서명 멱등성");
        }
    }

    @Test
    void independentScenarioSurvivesAnUnrelatedLongArtifact() {
        String artifact = IntStream.range(0, 1000).mapToObj(i -> "opaqueField" + i)
                .collect(Collectors.joining(" "));
        assertWebhook(artifact, "결제 웹훅 서명 멱등성");
        assertThat(reviewer.review(new ReviewRequest(artifact, "code", Set.of(), "", 5)).findings()).isEmpty();
    }

    @Test
    void userScenarioFindsRulesForJavaCodeWithoutKoreanComments() {
        String[][] cases = {
                {"payment",
                        "@PostMapping(\"/webhook\") public void receive(PaymentEvent event) { order.markPaid(event.orderId()); }",
                        "결제 웹훅 서명 검증과 중복 이벤트 멱등성 처리", "webhook-handling"},
                {"inventory",
                        "int stock = inventoryRepository.findStock(sku); if (stock >= quantity) { inventoryRepository.updateStock(sku, stock - quantity); }",
                        "동시 주문 재고 조건부 차감과 초과 판매 방지", "available-stock-query"},
                {"spring-commerce",
                        "@Transactional public void createOrder(Order order) { orderRepository.save(order); kafkaTemplate.send(\"order-created\", order); }",
                        "트랜잭션 커밋과 이벤트 발행 Outbox 유실 방지", "spring-commerce-events-outbox"}
        };
        for (String[] entry : cases) {
            var result = reviewer.review(new ReviewRequest(entry[1], "code", Set.of(entry[0]), entry[2], 5));
            assertThat(result.findings()).as(entry[0]).extracting(finding -> finding.ruleId()).contains(entry[3]);
            assertThat(result.findings()).hasSizeLessThanOrEqualTo(5)
                    .allSatisfy(finding -> assertThat(finding.status().name()).isEqualTo("REVIEW_REQUIRED"));
            var withoutScenario = reviewer.review(new ReviewRequest(entry[1], "code", Set.of(entry[0]), "", 5));
            if (withoutScenario.findings().isEmpty()) {
                assertThat(withoutScenario.notice()).contains("결함 없음이 아닙니다", "scenario");
            }
        }
    }

    private void assertWebhook(String artifact, String scenario) {
        var result = reviewer.review(new ReviewRequest(artifact, "code", Set.of("payment"), scenario, 5));
        assertThat(result.findings()).as("scenario=%s", scenario).extracting(f -> f.ruleId()).contains("webhook-handling");
        assertThat(result.findings()).hasSizeLessThanOrEqualTo(5);
    }

    @Test
    void boundedAnalysisReportsSamplingAndDoesNotCallEmptyImportsClean() {
        String artifact = IntStream.range(0, 5000).mapToObj(i -> "opaqueField" + i)
                .collect(Collectors.joining(" "));
        var sampled = reviewer.review(new ReviewRequest(artifact + " " + WEBHOOK, "code", Set.of("payment"), "", 5));
        assertThat(sampled.analysisTruncated()).isTrue();
        assertThat(sampled.analyzedChunks()).isEqualTo(32);
        assertThat(sampled.notice()).contains("일부 구간", "scenario");
        var imports = reviewer.review(new ReviewRequest("import java.util.List;", "code", Set.of("payment"), "", 5));
        assertThat(imports.findings()).isEmpty();
        assertThat(imports.notice()).contains("결함 없음이 아닙니다");
    }
}
