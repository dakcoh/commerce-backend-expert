// Synthetic single-instance synchronous oracle; no DB or external PG execution.
function fingerprint(request) {
  return JSON.stringify({units: [...request.units].sort(), amount: request.amount});
}

function createRefund(payment, refunds, request) {
  if (typeof request.key !== "string" || !request.key.trim() || !Number.isSafeInteger(request.amount) || request.amount <= 0 || !Array.isArray(request.units) ||
      !request.units.length || new Set(request.units).size !== request.units.length ||
      request.units.some(unit => !Object.hasOwn(payment.unitPaid, unit)) ||
      request.units.reduce((sum, unit) => sum + payment.unitPaid[unit], 0) !== request.amount) throw Error("INVALID_REQUEST");
  const existing = refunds.find(refund => refund.key === request.key);
  if (existing) {
    if (fingerprint(existing) !== fingerprint(request)) throw Error("KEY_CONFLICT");
    return existing;
  }
  const reserved = refunds.filter(refund => ["SUCCEEDED", "REQUESTED", "PROCESSING", "UNKNOWN"].includes(refund.status));
  if (reserved.reduce((sum, refund) => sum + refund.amount, 0) + request.amount > payment.paid) throw Error("REFUND_LIMIT");
  if (reserved.some(refund => refund.units.some(unit => request.units.includes(unit)))) throw Error("UNIT_RESERVED");
  const refund = {...request, units: [...request.units], status: "REQUESTED"};
  refunds.push(refund);
  return refund;
}

const payment = {paid: 20009, unitPaid: {"X-1": 6669, "X-2": 6670, "Y-1": 6670}};
const refunds = [{key: "refund-1", units: ["X-1"], amount: 6669, status: "UNKNOWN"}];
const request = {key: "refund-2", units: ["X-2"], amount: 6670};
module.exports = {createRefund, payment, refunds, request};
