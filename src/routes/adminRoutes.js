const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  login, getMe, getStats,
  getAllAdmins, createAdmin, updateAdminRole, updateAdminStatus, getAuditLog,
} = require("../controllers/adminController");
const { protect, requireRole } = require("../middleware/authMiddleware");

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

// GET /api/v1/admin/stats  (admin protected)
router.get("/stats", protect, getStats);

// GET /api/v1/admin/audit-log  (any admin can view)
router.get("/audit-log", protect, getAuditLog);

// ─── Users & Roles — superadmin only ──────────────────────────────────────────
router.get("/users", protect, requireRole("superadmin"), getAllAdmins);
router.post("/users", protect, requireRole("superadmin"), createAdmin);
router.patch("/users/:id/role", protect, requireRole("superadmin"), updateAdminRole);
router.patch("/users/:id/status", protect, requireRole("superadmin"), updateAdminStatus);

module.exports = router;
