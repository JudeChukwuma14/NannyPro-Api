const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { login, getMe } = require("../controllers/adminController");
const { protect } = require("../middleware/authMiddleware");

// Rate limiter for login — max 10 attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
    errors: [],
  },
  skip: (req) => process.env.NODE_ENV === "test",
});

// POST /api/v1/admin/login  (public)
router.post("/login", loginLimiter, login);

// GET /api/v1/admin/me  (admin protected)
router.get("/me", protect, getMe);

module.exports = router;
