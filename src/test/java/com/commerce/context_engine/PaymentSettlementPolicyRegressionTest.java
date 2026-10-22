package com.commerce.context_engine;

import com.commerce.context_engine.adapter.in.mcp.CommerceKnowledgeTool;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/** Guards MCP guidance, without executing a payment provider, bank or accounting system. */
@SpringBootTest
class PaymentSettlementPolicyRegressionTest {

    @Autowired
    CommerceKnowledgeTool tool;

    @Test
    void paymentStates_allowFurtherPartialRefundsAndTrustedConfirmationPaths() {
        assertThat(rule("payment-status-machine"))
                .contains("결제 시도", "환불 거래", "PARTIAL_CANCELLED", "잔여 환불 가능액", "검증된 웹훅")
                .doesNotContain("PAID에서만 환불/취소 가능", "UNCERTAIN 상태는 scheduler만 처리 가능");
    }

    @Test
    void duplicateApproval_isClaimedBeforeCallingTheProvider() {
        assertThat(rule("duplicate-payment-guard"))
                .contains("외부 승인 전", "원자적 선점", "요청 지문", "UNIQUE", "미확정")
                .doesNotContain("DB에 동일 pg_payment_id 존재 여부 체크");
    }

    @Test
    void webhookAuthenticationAndDeduplication_followTheEventContract() {
        assertThat(rule("webhook-handling"))
                .contains("이벤트별", "서명이 없는", "인증된 조회", "이벤트 ID", "거래 ID", "같은 결제")
                .doesNotContain("웹훅 ID 또는 결제 번호로 중복 수신 여부 확인");
    }

    @Test
    void uncertainty_belongsToTheAttemptAndLateApprovalIsReconciled() {
        assertThat(rule("network-cancellation"))
                .contains("결제 시도", "취소", "늦은 승인", "가상계좌", "입금", "대사")
                .doesNotContain("주문을 UNCERTAIN 상태로 전환");
        assertThat(rule("commerce-order-lifecycle"))
                .contains("늦은 승인", "조건부", "보상");
    }

    @Test
    void refundGuidance_capsCompletedAndInFlightAmountsAndSeparatesInspection() {
        assertThat(rule("partial-refund"))
                .contains("누적 환불액", "처리 중", "원 결제액", "원자적", "동일 환불", "잔차", "검수", "유지", "회수")
                .doesNotContain("취소된 상품 수량만큼만 재고 복구");
    }

    @Test
    void businessKeys_allowStableDateSequenceAndUuidWithoutRecreatingThemOnRetry() {
        for (String id : List.of("payment-idempotency", "partial-refund", "idempotency")) {
            assertThat(rule(id)).as(id)
                    .contains("업무키", "업무일자", "순번", "UUID", "고유 범위", "자정", "재발급")
                    .contains("같은 키", "다른 요청");
        }
        assertThat(rule("payment-idempotency"))
                .contains("내부 업무키", "외부 멱등키", "영속", "PG 계약");
    }

    @Test
    void refundKeepsRequestIdentityAndAuthenticatedResultsInFullSearchAndChecklist() {
        var full = tool.searchKnowledge("partial-refund", "payment", null, 1, "full", "json");
        assertThat(full.fullRules()).singleElement().satisfies(rule -> {
            assertThat(rule.id()).isEqualTo("partial-refund");
            assertThat(String.join("\n", rule.sections().get("guidance")))
                    .contains("요청 지문", "원 결제", "금액", "통화", "거부", "인증된 조회", "검증된 웹훅");
        });
        assertThat(checklist("payment")).contains("요청 지문", "다른 요청", "인증된 조회", "검증된 웹훅", "멱등");
        for (String id : List.of("duplicate-payment-guard", "network-cancellation", "partial-refund")) {
            assertThat(rule(id)).as(id).contains("보상", "멱등", "인증된 조회", "검증된 웹훅");
        }
    }

    @Test
    void documentedIdempotencyReferences_doNotClaimIndependentRuleVerification() {
        for (String id : List.of("payment-idempotency", "partial-refund")) {
            var rule = tool.getRule(id, "json").rule();
            assertThat(rule.evidenceLevel()).isEqualTo("external-source");
            assertThat(rule.status()).isEqualTo("needs-review");
            assertThat(rule.verifiedBy()).isNull();
            assertThat(rule.lastReviewedAt()).isNull();
            assertThat(rule.evidence()).allSatisfy(evidence -> {
                assertThat(evidence.type()).isEqualTo("official-documentation");
                assertThat(evidence.accessedAt()).isNotNull();
                assertThat(evidence.note()).isNotBlank();
            });
            assertThat(rule.evidence()).anySatisfy(evidence -> assertThat(evidence.source())
                    .isEqualTo("https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/"));
        }
    }

    @Test
    void pricing_doesNotAddTaxAgainToAnInclusivePrice() {
        assertThat(rule("commerce-pricing-money"))
                .contains("세금 포함", "11,000원", "중복 가산", "정책", "잔차")
                .doesNotContain("주문 합계 = 상품 합계 - 할인 합계 + 배송비 + 세금이라는 회계식");
    }

    @Test
    void settlementDates_separateCalculationAndPayoutCalendars() {
        assertThat(rule("settlement-timing"))
                .contains("산정 기준일", "확정일", "예정 지급일", "실제 지급일", "영업일", "계약")
                .doesNotContain("정산 기준일이 주말/공휴일이면 다음 영업일로 이월 처리 필요");
    }

    @Test
    void batchIdempotency_usesStableBusinessKeysAndAtomicCheckpoints() {
        for (String id : List.of("settlement-cycle", "commerce-settlement-reconciliation", "spring-commerce-scheduler-batch")) {
            assertThat(rule(id)).as(id)
                    .contains("업무키", "실행 ID", "체크포인트", "원자적")
                    .doesNotContain("정산 실행 전 당일 정산 완료 여부 체크", "실행 ID와 대상 거래 ID에 UNIQUE 제약");
        }
    }

    @Test
    void settlementReconciliation_supportsSplitPaymentsAndOutstandingBalances() {
        assertThat(rule("settlement-integrity"))
                .contains("거래 단위", "보류", "지급", "잔액", "중복")
                .doesNotContain("동일 주문 ID가 여러 정산 레코드에 없는지 확인");
        assertThat(rule("settlement-statement"))
                .contains("분할 지급", "이월", "성공 지급 누계", "미지급 잔액", "불변")
                .doesNotContain("명세 최종 지급액 = 실제 지급(payout) 트랜잭션 금액과 일치해야 함");
    }

    @Test
    void payoutUncertainty_doesNotTriggerANewTransferAttempt() {
        assertThat(rule("settlement-payout"))
                .contains("동일 지급 시도", "외부", "미확정", "원자적", "분할 지급", "미지급 잔액", "조회")
                .doesNotContain("payout_id + UNIQUE(settlement_id) 제약", "개인 셀러 실지급액:");
    }

    @Test
    void taxesAndHolds_areBasedOnApplicabilityAndReleasePolicy() {
        assertThat(rule("settlement-tax"))
                .contains("원천징수 적용 대상", "소득 유형", "최신")
                .doesNotContain("개인 셀러 원천징수 누락");
        assertThat(rule("settlement-hold"))
                .contains("산정", "지급 보류", "해제", "권한", "계약")
                .doesNotContain("정산 대상에서 제외하고, 해제 시 다음 주기에 합산해야 한다");
        assertThat(rule("settlement-deduction"))
                .contains("중복 공제", "원 거래", "정책 버전", "상계");
    }

    @Test
    void points_distinguishPartialRefundEventsAndProtectTheBalance() {
        assertThat(rule("commerce-loyalty-point-ledger"))
                .contains("환불 이벤트", "원자적", "원 적립", "만료", "정책", "미복원", "누적", "원 거래 총량")
                .doesNotContain("referenceType + referenceId + type에 UNIQUE 제약");
    }

    @Test
    void retryGuidance_requiresBusinessIdempotencyForSideEffects() {
        assertThat(rule("spring-resilience-retry-timeout"))
                .contains("비멱등", "동일 시도", "요청 지문", "총 재시도", "미확정");
    }

    @Test
    void checklists_preserveTheCorrectedStateDateAndTaxBoundaries() {
        assertThat(checklist("payment"))
                .contains("잔여 환불 가능액", "외부 승인 전", "미확정")
                .doesNotContain("UNCERTAIN 상태에서 scheduler 자동 처리 로직이 있는가?");
        assertThat(checklist("settlement"))
                .contains("업무키", "미지급 잔액", "원천징수 적용 대상", "산정 기준일")
                .doesNotContain("개인 셀러 지급 시 원천징수를 차감한 실이체액으로 처리하는가?");
    }

    private String rule(String id) {
        return tool.getRule(id).markdown();
    }

    private String checklist(String domain) {
        var response = tool.getChecklist(domain, null);
        return response.rules().stream().flatMap(rule -> rule.items().stream())
                .collect(Collectors.joining("\n")) + "\n" + response.markdown();
    }
}
