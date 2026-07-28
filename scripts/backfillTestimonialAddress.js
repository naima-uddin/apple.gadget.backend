/**
 * One-time backfill: set `address` on the testimonials inserted by
 * seedTestimonials.js before the address field existed.
 *
 * Run: node scripts/backfillTestimonialAddress.js
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

const ADDRESS_BY_NAME = {
  "Rafiul Islam": "Dhaka, Bangladesh",
  "Nusrat Jahan": "Chattogram, Bangladesh",
  "Tanvir Ahmed": "Sylhet, Bangladesh",
  "Farhana Akter": "Khulna, Bangladesh",
  "Shakil Hasan": "Rajshahi, Bangladesh",
};

let count = 0;
for (const [name, address] of Object.entries(ADDRESS_BY_NAME)) {
  const res = await Testimonial.updateOne(
    { name, address: { $in: [null, ""] } },
    { $set: { address } },
  );
  if (res.modifiedCount) count++;
}
console.log(`Updated ${count} testimonial(s).`);

await mongoose.disconnect();
console.log("Done.");
