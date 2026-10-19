package com.commerce.context_engine.application.search;

import com.commerce.context_engine.core.model.SearchQuery;
import com.commerce.context_engine.core.port.KnowledgeSearch;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class KoreanIntentRegressionTest {
    @Autowired KnowledgeSearch search;

    @Test
    void spokenPartialReturnFindsTheRefundRule() {
        assertThat(search.search(SearchQuery.of("상품 일부만 반품했는데 카드 취소액과 쿠폰 복원이 맞지 않아")))
                .extracting(r -> r.rule().id()).contains("partial-refund");
    }

    @Test
    void offTopicIntentAndAmbiguousReservationDoNotBecomeCommerceAnswers() {
        for (String query : List.of("재고가 아니라 오늘 기온이 궁금해", "부산 맛집 예약", "서울 병원 예약", "제주 숙소 예약")) {
            assertThat(search.search(SearchQuery.of(query))).as(query).isEmpty();
        }
    }

    @Test
    void changedCommerceTopicAndAdditivePhrasesRemainSearchable() {
        assertThat(search.search(SearchQuery.of("재고가 아니라 쿠폰 발급 중복 방지")))
                .extracting(r -> r.rule().id()).contains("coupon-issuance");
        assertThat(search.search(SearchQuery.of("예약 만료 재고 복구")))
                .extracting(r -> r.rule().id()).contains("stock-reservation");
        assertThat(search.search(SearchQuery.of("결제뿐만 아니라 환불 쿠폰 배부"))).isNotEmpty();
    }

    @Test
    void newConjugationHandlingKeepsSettlementCoverageAndUnseenExpressions() {
        assertThat(search.search(SearchQuery.of("셀러 정산 금액이 주문금액과 안맞아")))
                .extracting(r -> r.rule().id()).contains("settlement-integrity");
        assertThat(search.search(SearchQuery.of("품목 몇 개 반품했어요 카드 취소액 쿠폰 복원")))
                .extracting(r -> r.rule().id()).contains("partial-refund");
        assertThat(search.search(SearchQuery.of("쿠폰이 아니라 오늘 서울 날씨"))).isEmpty();
        assertThat(search.search(SearchQuery.of("맛집 말고 재고 예약 만료")))
                .extracting(r -> r.rule().id()).contains("stock-reservation");
    }
}
