/**
 * One-time migration: assign human-friendly sequential order numbers
 * ("apl1001", "apl1002", …) to every existing order that doesn't already have
 * one. Orders are numbered oldest-first (by createdAt) so the sequence matches
 * the order in which they were placed. The shared Counter document is then
 * seeded to the last number assigned, so newly-placed orders continue the
 * sequence without collisions.
 *
 * Safe to re-run: orders that already have an orderNumber are skipped, and the
 * counter is only bumped forward.
 *
 * Run: node scripts/backfillOrderNumbers.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../models/Order.js";
import Counter from "../models/Counter.js";
import { ORDER_NUMBER_PREFIX, ORDER_NUMBER_SEED } from "../lib/orderNumber.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

const START = ORDER_NUMBER_SEED; // first assigned number becomes START + 1 = apl1675

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Highest number already in use (from a previous partial run), so a re-run
  // continues rather than restarting at 1001.
  const existing = await Order.find(
    { orderNumber: { $regex: `^${ORDER_NUMBER_PREFIX}\\d+$` } },
    "orderNumber",
  ).lean();
  let seq = START;
  for (const o of existing) {
    const n = parseInt(String(o.orderNumber).replace(/\D/g, ""), 10);
    if (Number.isFinite(n) && n > seq) seq = n;
  }
  console.log(
    `${existing.length} order(s) already numbered. Continuing from ${ORDER_NUMBER_PREFIX}${seq + 1}.`,
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
    const orderNumber = `${ORDER_NUMBER_PREFIX}${seq}`;
    await Order.updateOne({ _id: order._id }, { $set: { orderNumber } });
    assigned += 1;
    if (assigned % 100 === 0) console.log(`  …${assigned} numbered`);
  }
  console.log(`Assigned ${assigned} new order number(s). Last = ${ORDER_NUMBER_PREFIX}${seq}.`);

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
