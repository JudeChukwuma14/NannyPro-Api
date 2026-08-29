const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  login,
  setPassword,
  getMe,
  updateMyAvailability,
  getAllNannies,
  getNannyById,
  updateVettingStatus,
  updateAccountStatus,
  updateNannyAvailabilityAdmin,
} = require("../controllers/nannyController");

const { protect } = require("../middleware/authMiddleware");
const { protectNanny } = require("../middleware/nannyAuthMiddleware");
const { stripNannyControlFields, sanitiseBody, validateNannySetPassword } = require("../middleware/validateRequest");

// Max 10 attempts per IP per 15 minutes — mirrors adminRoutes.js's login limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again in 15 minutes.", errors: [] },
  skip: (req) => process.env.NODE_ENV === "test",
});

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

// POST /api/v1/nannies/login
router.post("/login", loginLimiter, login);

// POST /api/v1/nannies/set-password
router.post("/set-password", loginLimiter, sanitiseBody, validateNannySetPassword, setPassword);

// ─── NANNY PROTECTED ─────────────────────────────────────────────────────────

// GET /api/v1/nannies/me
router.get("/me", protectNanny, getMe);

// PATCH /api/v1/nannies/me/availability
router.patch("/me/availability", protectNanny, stripNannyControlFields, sanitiseBody, updateMyAvailability);

// ─── ADMIN PROTECTED ─────────────────────────────────────────────────────────

// GET /api/v1/nannies
router.get("/", protect, getAllNannies);

// GET /api/v1/nannies/:id
router.get("/:id", protect, getNannyById);

// PATCH /api/v1/nannies/:id/vetting-status
router.patch("/:id/vetting-status", protect, updateVettingStatus);

// PATCH /api/v1/nannies/:id/account-status
router.patch("/:id/account-status", protect, updateAccountStatus);

// PATCH /api/v1/nannies/:id/availability
router.patch("/:id/availability", protect, updateNannyAvailabilityAdmin);

module.exports = router;
