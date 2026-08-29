const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  submitEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
  addNote,
  getNotes,
} = require("../controllers/enquiryController");

const { protect } = require("../middleware/authMiddleware");
const {
  stripEnquiryControlFields,
  sanitiseBody,
  validateEnquirySubmission,
} = require("../middleware/validateRequest");

// Max 5 submissions per IP per hour — mirrors applicationRoutes.js's submission limiter
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests submitted from this IP address. Please try again later.",
    errors: [],
  },
  skip: (req) => process.env.NODE_ENV === "test",
});

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

// POST /api/v1/enquiries
router.post(
  "/",
  submissionLimiter,
  stripEnquiryControlFields,
  sanitiseBody,
  validateEnquirySubmission,
  submitEnquiry
);

// ─── ADMIN PROTECTED ─────────────────────────────────────────────────────────

// GET /api/v1/enquiries
router.get("/", protect, getAllEnquiries);

// GET /api/v1/enquiries/:id
router.get("/:id", protect, getEnquiryById);

// PATCH /api/v1/enquiries/:id/status
router.patch("/:id/status", protect, updateEnquiryStatus);

// POST /api/v1/enquiries/:id/notes
router.post("/:id/notes", protect, addNote);

// GET /api/v1/enquiries/:id/notes
router.get("/:id/notes", protect, getNotes);

module.exports = router;
