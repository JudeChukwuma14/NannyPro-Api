const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  createShift,
  track,
  confirm,
  cancelByParent,
  getAvailableShifts,
  getMyShifts,
  accept,
  withdraw,
  getAllShifts,
  getShiftById,
  adminCancel,
  adminComplete,
} = require("../controllers/shiftController");

const { protect } = require("../middleware/authMiddleware");
const { protectNanny } = require("../middleware/nannyAuthMiddleware");
const { stripShiftControlFields, sanitiseBody, validateShiftSubmission } = require("../middleware/validateRequest");

// Max 10 shift requests per IP per hour — a genuine emergency flow needs a
// higher ceiling than the application-submission limiter (5/hour), but still
// bounded to deter abuse.
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many shift requests submitted from this IP address. Please try again later.", errors: [] },
  skip: (req) => process.env.NODE_ENV === "test",
});

// Generous limiter for the token-gated parent actions (track/confirm/cancel)
const parentActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down and try again shortly.", errors: [] },
  skip: (req) => process.env.NODE_ENV === "test",
});

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

// POST /api/v1/shifts
router.post("/", submissionLimiter, stripShiftControlFields, sanitiseBody, validateShiftSubmission, createShift);

// POST /api/v1/shifts/:reference/track
router.post("/:reference/track", parentActionLimiter, track);

// POST /api/v1/shifts/:reference/confirm
router.post("/:reference/confirm", parentActionLimiter, confirm);

// POST /api/v1/shifts/:reference/cancel
router.post("/:reference/cancel", parentActionLimiter, cancelByParent);

// ─── NANNY PROTECTED ─────────────────────────────────────────────────────────
// /available and /mine are literal paths and MUST be registered before the
// admin /:id routes below, or Express would match :id first.

// GET /api/v1/shifts/available
router.get("/available", protectNanny, getAvailableShifts);

// GET /api/v1/shifts/mine
router.get("/mine", protectNanny, getMyShifts);

// POST /api/v1/shifts/:id/accept
router.post("/:id/accept", protectNanny, accept);

// POST /api/v1/shifts/:id/withdraw
router.post("/:id/withdraw", protectNanny, withdraw);

// ─── ADMIN PROTECTED ─────────────────────────────────────────────────────────

// GET /api/v1/shifts
router.get("/", protect, getAllShifts);

// GET /api/v1/shifts/:id
router.get("/:id", protect, getShiftById);

// PATCH /api/v1/shifts/:id/cancel
router.patch("/:id/cancel", protect, adminCancel);

// PATCH /api/v1/shifts/:id/complete
router.patch("/:id/complete", protect, adminComplete);

module.exports = router;
