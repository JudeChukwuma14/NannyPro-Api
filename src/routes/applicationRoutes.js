const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  submitApplication,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  addNote,
  getNotes,
} = require("../controllers/applicationController");

const { protect } = require("../middleware/authMiddleware");
const { uploadDocumentFields } = require("../middleware/uploadMiddleware");
const {
  stripControlFields,
  sanitiseBody,
  validateApplicationSubmission,
  parseMultipartJsonFields,
} = require("../middleware/validateRequest");

// Rate limiter — public submission endpoint only
// Max 5 submissions per IP per hour to deter abuse/spam
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many applications submitted from this IP address. Please try again later.",
    errors: [],
  },
  skip: (req) => process.env.NODE_ENV === "test", // Skip in test environment
});

// ─── PUBLIC ──────────────────────────────────────────────────────────────────

// POST /api/v1/applications
// Accepts multipart/form-data (JSON fields + optional files)
router.post(
  "/",
  submissionLimiter,
  uploadDocumentFields,          // Multer — processes files into req.files
  parseMultipartJsonFields,      // Parse JSON-stringified FormData fields (arrays, objects)
  stripControlFields,            // Strip status, applicationReference etc.
  sanitiseBody,                  // Trim & XSS-clean strings
  validateApplicationSubmission, // Server-side field validation
  submitApplication
);

// ─── ADMIN PROTECTED ─────────────────────────────────────────────────────────

// GET /api/v1/applications
router.get("/", protect, getAllApplications);

// GET /api/v1/applications/:id
router.get("/:id", protect, getApplicationById);

// PATCH /api/v1/applications/:id/status
router.patch("/:id/status", protect, updateApplicationStatus);

// POST /api/v1/applications/:id/notes
router.post("/:id/notes", protect, addNote);

// GET /api/v1/applications/:id/notes
router.get("/:id/notes", protect, getNotes);

module.exports = router;
