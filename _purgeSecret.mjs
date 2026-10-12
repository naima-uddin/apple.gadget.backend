import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

const EMAIL = "secret@gmail.com";
const URI = process.env.MONGODB_URI || process.env.MONGO_URI;
await mongoose.connect(URI);
const Admin = (await import("./models/Admin.js")).default;
const ActivityLog = (await import("./models/ActivityLog.js")).default;

const admin = await Admin.findOne({ email: EMAIL }).select("_id").lean();
const id = admin?._id;

// Precise: only entries whose actor is THIS account (id) or its email.
// Deliberately NOT matching actorName ("Admin") — that collides with other
// admins historically named "Admin".
const res = await ActivityLog.deleteMany({
  $or: [{ actor: id }, { actorEmail: EMAIL }],
});
console.log("Deleted ActivityLog entries:", res.deletedCount);
await mongoose.disconnect();
