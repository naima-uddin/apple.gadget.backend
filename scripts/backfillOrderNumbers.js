/**
 * Assign human-friendly sequential order numbers ("apl1675", "apl1676", …) to
 * existing orders. Orders are numbered oldest-first (by createdAt) so the
 * sequence matches the order in which they were placed. The shared Counter
 * document is then seeded to the last number assigned, so newly-placed orders
 * continue the sequence without collisions.
 *
 * Modes:
 *   node scripts/backfillOrderNumbers.js
 *       Only numbers orders that don't have a number yet (safe, incremental).
 *
 *   node scripts/backfillOrderNumbers.js --reset
 *       Clears ALL existing order numbers, resets the counter, and renumbers
 *       every order fresh from apl1675. Use this to clean up bad numbers
 *       (e.g. early apl1/apl2 test orders) — it CHANGES existing numbers.
 *
 * Run from the Apple-backend directory.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../models/Order.js";
import Counter from "../models/Counter.js";
import {
  ORDER_NUMBER_PREFIX,
  ORDER_NUMBER_SEED,
  formatOrderNumber,
} from "../lib/orderNumber.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

const RESET = process.argv.includes("--reset");

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  if (RESET) {
    const cleared = await Order.updateMany(
      {},
      { $unset: { orderNumber: "" } },
    );
    await Counter.deleteOne({ _id: "orderNumber" });
    console.log(
      `--reset: cleared numbers on ${cleared.modifiedCount} order(s) and removed the counter.`,
    );
  }

  // Highest number already in use (so a plain re-run continues rather than
  // restarting). In --reset mode nothing is numbered, so this stays at the seed.
  const existing = await Order.find(
    { orderNumber: { $regex: `^${ORDER_NUMBER_PREFIX}\\d+$` } },
    "orderNumber",
  ).lean();
  let seq = ORDER_NUMBER_SEED;
  for (const o of existing) {
    const n = parseInt(String(o.orderNumber).replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > seq) seq = n;
  }
  console.log(
    `${existing.length} order(s) already numbered. Continuing from ${formatOrderNumber(seq + 1)}.`,
  );

  // Number the rest oldest-first.
  const cursor = Order.find({
    $or: [{ orderNumber: null }, { orderNumber: { $exists: false } }],
  })
    .sort({ createdAt: 1 })
    .cursor();

  let assigned = 0;
  for (let order = await cursor.next(); order; order = await cursor.next()) {
    seq += 1;
    const orderNumber = formatOrderNumber(seq);
    await Order.updateOne({ _id: order._id }, { $set: { orderNumber } });
    assigned += 1;
    if (assigned % 100 === 0) console.log(`  …${assigned} numbered`);
  }
  console.log(
    `Assigned ${assigned} new order number(s). Last = ${formatOrderNumber(seq)}.`,
  );

  // Seed the counter so the next live order gets seq + 1.
  await Counter.findByIdAndUpdate(
    "orderNumber",
    { $set: { seq } },
    { upsert: true },
  );
  console.log(`Counter "orderNumber" set to ${seq}.`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
