/**
 * Seed script — creates the first admin account.
 * Run with: npm run seed:admin
 *
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from .env
 * Hashes the password before saving.
 * Uses upsert so it is safe to run multiple times.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const ENV = require("../config/env");

// Fix DNS for environments that have resolution issues
const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function seed() {
  if (!ENV.MONGODB_URI) {
    console.error("[Seed] MONGODB_URI is not set. Check your .env file.");
    process.exit(1);
  }

  if (!ENV.ADMIN_EMAIL || !ENV.ADMIN_PASSWORD) {
    console.error("[Seed] ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(ENV.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log("[Seed] Connected to MongoDB");

    const passwordHash = await Admin.hashPassword(ENV.ADMIN_PASSWORD);

    const result = await Admin.findOneAndUpdate(
      { email: ENV.ADMIN_EMAIL.toLowerCase().trim() },
      {
        email: ENV.ADMIN_EMAIL.toLowerCase().trim(),
        passwordHash,
        role: "admin",
      },
      { upsert: true, returnDocument: "after", runValidators: true }
    );

    console.log(`[Seed] Admin account ready → ${result.email} (role: ${result.role})`);
  } catch (error) {
    console.error("[Seed] Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("[Seed] Disconnected. Done.");
  }
}

seed();
