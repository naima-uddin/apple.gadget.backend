/**
 * seedDiscounts.js
 * Adds 4 sample offer/coupon cards (with embedded illustrations) to the
 * homepage "Offers to say yes" section.
 *
 * The illustrations are inlined as data-URI SVGs, so the image travels inside
 * the coupon document itself and renders correctly on any host (local or prod)
 * without depending on the /uploads static route or PUBLIC_UPLOAD_BASE.
 *
 * Usage:
 *   node seedDiscounts.js            # append 4 new coupons (keeps existing)
 *   node seedDiscounts.js --replace  # delete ALL existing coupons first
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Wrap inner SVG markup in a 96×96 canvas with the given stroke colour and
// return it as a ready-to-store data URI.
const icon = (stroke, inner) => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" ` +
    `stroke="${stroke}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">` +
    inner +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
};

// ── Line-art illustrations (Apple gadgets) ───────────────────────────────────
const airpods = (c) =>
  icon(
    c,
    `<ellipse cx="36" cy="33" rx="11" ry="13"/>` +
      `<path d="M33 45v22a6 6 0 0 0 12 0V43"/>` +
      `<ellipse cx="66" cy="33" rx="7" ry="9" opacity="0.5"/>` +
      `<path d="M64 41v18a4 4 0 0 0 8 0V40" opacity="0.5"/>`,
  );

const watch = (c) =>
  icon(
    c,
    `<rect x="33" y="30" width="30" height="36" rx="9"/>` +
      `<path d="M40 30l2-12h12l2 12M40 66l2 12h12l2-12"/>` +
      `<path d="M63 42h4M63 54h4"/>` +
      `<path d="M48 42v7l5 4"/>`,
  );

const iphone = (c) =>
  icon(
    c,
    `<rect x="32" y="15" width="32" height="66" rx="9"/>` +
      `<rect x="42" y="21" width="12" height="4" rx="2"/>` +
      `<circle cx="48" cy="73" r="2.4" fill="${c}" stroke="none"/>`,
  );

const macbook = (c) =>
  icon(
    c,
    `<rect x="30" y="24" width="36" height="27" rx="3"/>` +
      `<path d="M22 62h52a2 2 0 0 0 1.9-2.6l-1.8-6.1a2 2 0 0 0-1.9-1.3H25.8a2 2 0 0 0-1.9 1.3l-1.8 6.1A2 2 0 0 0 22 62Z"/>` +
      `<path d="M42 56h12"/>`,
  );

// Two weeks / a month out from "now" for the expiry fine print.
const daysFromNow = (n) => new Date(Date.now() + n * 864e5);

const coupons = [
  {
    highlight: "15% Off AirPods",
    subtitle: "On all AirPods & audio accessories",
    couponCode: "AIRPODS15",
    bgColor: "#0F6E6A",
    buttonColor: "#F2C94C",
    textColor: "#FFFFFF",
    image: { url: airpods("#FFFFFF"), public_id: "" },
    discountType: "percentage",
    discountValue: 15,
    minOrderAmount: 999,
    maxDiscountAmount: 1500,
    expiresAt: daysFromNow(21),
    isActive: true,
  },
  {
    highlight: "Save ৳500",
    subtitle: "On any Apple Watch this week",
    couponCode: "WATCH500",
    bgColor: "#F6E7C1",
    buttonColor: "#1D1D1F",
    textColor: "#1D1D1F",
    image: { url: watch("#1D1D1F"), public_id: "" },
    discountType: "fixed",
    discountValue: 500,
    minOrderAmount: 5000,
    expiresAt: daysFromNow(14),
    isActive: true,
  },
  {
    highlight: "Free Delivery",
    subtitle: "First order — anywhere in Bangladesh",
    couponCode: "APPLEFREE",
    bgColor: "#524A87",
    buttonColor: "#E7E0FF",
    textColor: "#FFFFFF",
    image: { url: iphone("#FFFFFF"), public_id: "" },
    discountType: "free_shipping",
    discountValue: 0,
    minOrderAmount: 0,
    isFirstOrderOnly: true,
    expiresAt: daysFromNow(30),
    isActive: true,
  },
  {
    highlight: "20% Off MacBook",
    subtitle: "Limited-time back-to-work deal",
    couponCode: "MAC20",
    bgColor: "#1A1A1E",
    buttonColor: "#E8863B",
    textColor: "#FFFFFF",
    image: { url: macbook("#FFFFFF"), public_id: "" },
    discountType: "percentage",
    discountValue: 20,
    minOrderAmount: 50000,
    maxDiscountAmount: 20000,
    expiresAt: daysFromNow(10),
    isActive: true,
  },
];

async function main() {
  const replace = process.argv.includes("--replace");
  const URI =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/AppleBD";
  await mongoose.connect(URI);
  console.log("Connected to MongoDB");

  const Discount = (await import("./models/Discount.js")).default;

  if (replace) {
    const { deletedCount } = await Discount.deleteMany({});
    console.log(`Removed ${deletedCount} existing coupon(s) (--replace).`);
  }

  // Append after any existing coupons so ordering stays predictable.
  const last = await Discount.findOne().sort({ order: -1 });
  let order = last ? last.order + 1 : 0;
  const withOrder = coupons.map((c) => ({ ...c, order: order++ }));

  const inserted = await Discount.insertMany(withOrder);
  console.log(`Inserted ${inserted.length} coupon(s):`);
  inserted.forEach((c, i) =>
    console.log(`  ${i + 1}. ${c.highlight}  [${c.couponCode}]  order=${c.order}`),
  );

  const total = await Discount.countDocuments();
  console.log(`Total coupons now in DB: ${total}`);

  await mongoose.disconnect();
  console.log("Done — discount seed complete.");
}

main().catch((err) => {
  console.error("SEED ERROR", err);
  process.exit(1);
});
