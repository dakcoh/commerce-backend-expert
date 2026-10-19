package com.commerce.context_engine;

import com.commerce.context_engine.adapter.in.mcp.CommerceKnowledgeTool;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the guidance returned by MCP. These tests do not execute a stock or coupon system.
 */
@SpringBootTest
class KnowledgePolicyRegressionTest {

    @Autowired
    CommerceKnowledgeTool tool;

    @Test
    void inventoryGuidance_acceptsAtomicDecrementWithoutReservationColumns() {
        for (String id : List.of("stock-reservation", "available-stock-query", "commerce-inventory-availability")) {
            assertThat(tool.getRule(id).markdown()).as(id)
                    .contains("DB 조건부", "재고 모델")
                    .doesNotContain(
                            "3단계로 처리해야 오버셀링을 막을 수 있다",
                            "예약 단계 없이 바로 stock - quantity 하면",
                            "reserved_quantity 컬럼 없는 단일 quantity 스키마 — 예약과 확정을 구분 불가");
        }
        assertThat(tool.getRule("available-stock-query").rule().applicability().assumptions())
                .anyMatch(value -> value.contains("예약형"));
    }

    @Test
    void inventoryChecklist_checksTheChosenModelInsteadOfRequiringReservation() {
        assertThat(checklist("inventory"))
                .contains("재고 모델", "동시", "복구")
                .doesNotContain(
                        "재고 예약 단계 없이 바로 차감하지 않았는가?",
                        "재고 조회 시 (total - reserved) 기준으로 가용 재고를 확인하는가?",
                        "MSA 구조라면 Saga 보상 트랜잭션이 정의됐는가?");
    }

    @Test
    void inventoryIdempotency_retainsBusinessProtectionBeyondCacheExpiry() {
        assertThat(tool.getRule("idempotency").markdown())
                .contains("재시도", "재처리", "보존 기간", "영속")
                .doesNotContain("키는 TTL 24시간으로 저장");
    }

    @Test
    void saga_distinguishesOutboxPublicationFromCompensationCompletion() {
        assertThat(tool.getRule("saga-pattern").markdown())
                .contains("로컬 트랜잭션", "소비자", "재시도", "대사")
                .doesNotContain("Outbox 패턴으로 이벤트 유실 없이 보상 트랜잭션 보장");
    }

    @Test
    void couponGuidance_acceptsDbOnlyIssuanceAcrossDomains() {
        for (String id : List.of("coupon-issuance", "coupon-issuance-compensation",
                "commerce-promotion-allocation", "spring-commerce-locking-idempotency")) {
            assertThat(tool.getRule(id).markdown()).as(id)
                    .contains("DB 조건부")
                    .doesNotContain("오버이슈 방어 불가", "Redis 선점 없이 DB만으로 처리");
        }
    }

    @Test
    void redisCompensation_coversCrashesAndUncertainDatabaseCommits() {
        assertThat(tool.getRule("coupon-issuance-compensation").markdown())
                .contains("영속", "attempt", "응답 유실", "대사", "선점 토큰");
        assertThat(tool.getRule("coupon-issuance-compensation").rule().applicability().doesNotApplyWhen())
                .anyMatch(value -> value.contains("DB"));
    }

    @Test
    void couponCalculation_preservesPolicyChoicesAndOrderTimeAllocation() {
        assertThat(tool.getRule("coupon-discount-calculation").markdown())
                .contains("정액→정률", "정책 버전", "스냅샷", "유지", "회수")
                .doesNotContain(
                        "복수 쿠폰 적용 순서: 정률 쿠폰 먼저, 정액 쿠폰 나중",
                        "최소 주문금액 미달 시 쿠폰 자동 무효화 처리");
    }

    @Test
    void couponChecklist_doesNotRequireRedisOrOneDiscountOrder() {
        assertThat(checklist("coupon"))
                .contains("정책", "수량", "중복", "복구")
                .doesNotContain(
                        "Redis 선점 + DB 확정 두 단계로 쿠폰 발급을 처리하는가?",
                        "복수 쿠폰 적용 순서(정률 → 정액) 정책이 정의됐는가?",
                        "부분 취소 시 쿠폰 할인 금액 역산 및 무효화 처리가 있는가?");
    }

    @Test
    void checkoutAndAllocation_doNotReintroduceMandatoryReservationOrBenefitWithdrawal() {
        assertThat(tool.getRule("commerce-cart-checkout").markdown())
                .contains("선택한 재고 모델")
                .doesNotContain("주문 생성 시 견적을 재검증하고 재고 예약과 결제 대기를 시작한다.");
        assertThat(tool.getRule("commerce-promotion-allocation").markdown())
                .contains("정책", "유지", "회수")
                .doesNotContain("부분 취소 후 최소 주문 금액 미달인데 쿠폰이 그대로 유지된다.");
    }

    private String checklist(String domain) {
        var response = tool.getChecklist(domain, null);
        return response.rules().stream().flatMap(rule -> rule.items().stream())
                .collect(Collectors.joining("\n")) + "\n" + response.markdown();
    }
}
