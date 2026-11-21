// Single-process ledger; calls are sequential and no external provider is used.
// Per order, an identical replay returns the original entry. A changed amount
// for the same key raises CONFLICT. A fresh key must fit the remaining balance.
function reserve(order, key, amount) {
  if (amount > order.remaining) throw Error("LIMIT");
  const previous = order.entries.get(key);
  if (previous) {
    if (previous.amount !== amount) throw Error("CONFLICT");
    return previous;
  }
  const entry = {key, amount};
  order.remaining -= amount;
  order.entries.set(key, entry);
  return entry;
}

const order = {id: "R", remaining: 8000, entries: new Map()};
module.exports = {order, reserve};
