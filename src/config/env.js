const dotenv = require("dotenv");
dotenv.config();

const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 5000,

  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_DB_URL,

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",

  CLOUDINARY_CLOUD_NAME:
    process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",

  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,

  // ── Emergency shift booking ────────────────────────────────────────────
  SHIFT_CONFIRMATION_WINDOW_MINUTES: Number(process.env.SHIFT_CONFIRMATION_WINDOW_MINUTES) || 15,
  SHIFT_MAX_ACCEPT_CYCLES: Number(process.env.SHIFT_MAX_ACCEPT_CYCLES) || 3,
  SHIFT_EXPIRY_SWEEP_INTERVAL_MS: Number(process.env.SHIFT_EXPIRY_SWEEP_INTERVAL_MS) || 60000,
  NANNY_SET_PASSWORD_TOKEN_TTL_HOURS: Number(process.env.NANNY_SET_PASSWORD_TOKEN_TTL_HOURS) || 168,

  // ── Outbound email — Gmail via OAuth2 (optional — sending fails gracefully until these are set) ──
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_MAIL_HOST: process.env.GOOGLE_MAIL_HOST,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
};

// Validate critical variables
const required = [
  "MONGODB_URI",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
const missing = required.filter((key) => !ENV[key]);
if (missing.length > 0) {
  console.error(
    `[ENV] Missing required environment variables: ${missing.join(", ")}`,
  );
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

module.exports = ENV;
