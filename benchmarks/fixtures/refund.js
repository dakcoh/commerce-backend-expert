// Synthetic review input: one in-memory service instance, no DB or external PG calls.
function createRefund(payment, refunds, request) {
  const existing = refunds.find(refund => refund.key === request.key);
  if (existing) return existing;
  const completed = refunds.filter(refund => refund.status === "SUCCEEDED").reduce((sum, refund) => sum + refund.amount, 0);
  if (completed + request.amount > payment.paid) throw Error("REFUND_LIMIT");
  const refund = {...request, status: "REQUESTED"};
  refunds.push(refund);
  return refund;
}

const payment = {paid: 20009, unitPaid: {"X-1": 6669, "X-2": 6670, "Y-1": 6670}};
const refunds = [{key: "refund-1", units: ["X-1"], amount: 6669, status: "UNKNOWN"}];
const request = {key: "refund-2", units: ["X-1", "X-2"], amount: 13339};

module.exports = {createRefund, payment, refunds, request};
