/**
 * One-time seed: insert sample testimonials so the homepage "What Our
 * Customers Say" section has content to show. Safe to re-run — skips if
 * testimonials already exist.
 *
 * Run: node scripts/seedTestimonials.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error("MONGODB_URI not set in .env");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log("Connected to MongoDB");

const Testimonial = (await import("../models/Testimonial.js")).default;

const existing = await Testimonial.countDocuments();
if (existing > 0) {
  console.log(`${existing} testimonial(s) already exist — skipping seed.`);
  await mongoose.disconnect();
  process.exit(0);
}

const SAMPLE = [
  {
    name: "Rafiul Islam",
    rating: 5,
    message:
      "Ordered an iPhone charger and case — genuine product, well packed, and delivered within a day. Exactly what I expected.",
  },
  {
    name: "Nusrat Jahan",
    rating: 5,
    message:
      "Great collection of Apple accessories at fair prices. Customer support replied quickly when I asked about warranty.",
  },
  {
    name: "Tanvir Ahmed",
    rating: 4,
    message:
      "Smooth checkout and fast shipping. The AirPods case I bought looks and feels premium — will order again.",
  },
  {
    name: "Farhana Akter",
    rating: 5,
    message:
      "This is my second order from here. Products are always authentic and delivery is reliable every time.",
  },
  {
    name: "Shakil Hasan",
    rating: 5,
    message:
      "Best place to buy Apple gadgets online in Bangladesh. Easy returns policy gave me confidence to buy without hesitation.",
  },
];

for (let i = 0; i < SAMPLE.length; i++) {
  await Testimonial.create({ ...SAMPLE[i], order: i, isActive: true });
}
console.log(`Inserted ${SAMPLE.length} testimonials.`);

await mongoose.disconnect();
console.log("Done.");
