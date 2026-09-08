import Counter from "../models/Counter.js";

export const ORDER_NUMBER_PREFIX = "apl";

// Counter seeds here, so the first order number is ORDER_NUMBER_SEED + 1
// (apl1675). Chosen so numbers look established rather than starting at #1.
// Keep in sync with the Counter schema default in models/Counter.js.
export const ORDER_NUMBER_SEED = 1674;

/**
 * Atomically reserve the next human-friendly order number, e.g. "apl1001".
 * The counter seeds at 1000, so the first order becomes apl1001. Sequential
 * and never random — the same value is shown across the storefront/dashboard
 * and sent to couriers as the merchant invoice id.
 */
export async function nextOrderNumber() {
  const doc = await Counter.findByIdAndUpdate(
    "orderNumber",
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `${ORDER_NUMBER_PREFIX}${doc.seq}`;
}
