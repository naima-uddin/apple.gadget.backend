/**
 * seedAdmin.js
 * Creates (or updates) an admin account. Self-registration is disabled in
 * routes/admin.js, so the first admin must be seeded with this script.
 *
 * Usage:
 *   node seedAdmin.js <email> <password> [name]
 *   node seedAdmin.js admin@example.com StrongPass123 "Super Admin"
 *
 * If an admin with the same email already exists, its password/name are
 * updated (handy for password resets) — nothing else is touched.
 */

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

const SALT_ROUNDS = 12; // keep in sync with routes/admin.js

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password) {
    console.log("Usage: node seedAdmin.js <email> <password> [name]");
    process.exit(1);
  }
  if (password.length < 6) {
    console.log("Password must be at least 6 characters.");
    process.exit(1);
  }

  const URI =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/AppleBD";
  await mongoose.connect(URI);
  console.log("Connected to MongoDB");

  const Admin = (await import("./models/Admin.js")).default;

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await Admin.findOne({ email: normalizedEmail });
  if (existing) {
    existing.hashedPassword = hashedPassword;
    if (name) existing.name = name;
    existing.isActive = true;
    existing.isLocked = false;
    existing.lockUntil = undefined;
    existing.loginAttempts = 0;
    await existing.save();
    console.log(`Updated existing admin: ${existing.email} (${existing.role})`);
  } else {
    const admin = await Admin.create({
      name: name || "Admin",
      email: normalizedEmail,
      hashedPassword,
      role: "admin",
      isActive: true,
      permissions: [], // empty = unrestricted / full access
    });
    console.log(`Created new admin: ${admin.email}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
