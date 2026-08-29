const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Application = require("../models/Application");
const Family = require("../models/Family");
const Nanny = require("../models/Nanny");
const Enquiry = require("../models/Enquiry");
const Shift = require("../models/Shift");
const AuditLog = require("../models/AuditLog");
const ENV = require("../config/env");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { logAction } = require("../services/auditLogService");

// ─── POST /api/v1/admin/login ─────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, "Email and password are required", 400);
    }

    // Re-select passwordHash (excluded from default queries)
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash");

    // Use identical error message regardless of whether email exists —
    // prevents user enumeration attacks
    if (!admin) {
      return errorResponse(res, "Invalid email or password", 401);
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, "Invalid email or password", 401);
    }
    if (admin.isActive === false) {
      return errorResponse(res, "This account has been deactivated. Please contact a Super Admin.", 401);
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: admin.role },
      ENV.JWT_SECRET,
      { expiresIn: ENV.JWT_EXPIRES_IN }
    );

    return successResponse(
      res,
      {
        token,
        admin: {
          id: admin._id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      },
      "Login successful"
    );
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/admin/me ─────────────────────────────────────────────────────
// Protected — returns the currently authenticated admin's profile
const getMe = async (req, res, next) => {
  try {
    // req.user is attached by the protect middleware
    return successResponse(
      res,
      {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        createdAt: req.user.createdAt,
      },
      "Admin profile retrieved"
    );
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/admin/stats ───────────────────────────────────────────────────
// Protected — dashboard summary counts
const getStats = async (req, res, next) => {
  try {
    const AWAITING_DECISION_STATUSES = [
      "New", "Under Review", "Documents Pending", "References", "Interview", "Vetting",
    ];
    const SHIFT_STATUSES = ["Open", "Pending Confirmation", "Confirmed", "Completed", "Cancelled", "Expired"];

    const [
      nanniesTotal,
      nanniesVetted,
      applicationsTotal,
      applicationsAwaitingDecision,
      familiesTotal,
      enquiriesTotal,
      enquiriesNew,
      shiftCounts,
    ] = await Promise.all([
      Nanny.countDocuments({}),
      Nanny.countDocuments({ vettingStatus: "Vetted" }),
      Application.countDocuments({}),
      Application.countDocuments({ status: { $in: AWAITING_DECISION_STATUSES } }),
      Family.countDocuments({}),
      Enquiry.countDocuments({}),
      Enquiry.countDocuments({ status: "New" }),
      Promise.all(SHIFT_STATUSES.map((status) => Shift.countDocuments({ status }))),
    ]);

    const shiftsByStatus = SHIFT_STATUSES.reduce((acc, status, i) => {
      acc[status] = shiftCounts[i];
      return acc;
    }, {});

    return successResponse(
      res,
      {
        nannies: { total: nanniesTotal, vetted: nanniesVetted },
        applications: { total: applicationsTotal, awaitingDecision: applicationsAwaitingDecision },
        families: { total: familiesTotal },
        enquiries: { total: enquiriesTotal, new: enquiriesNew },
        shifts: shiftsByStatus,
      },
      "Stats retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/admin/users ──────────────────────────────────────────────────
// Superadmin only
const getAllAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find({}).sort({ createdAt: -1 }).lean();
    return successResponse(res, admins, "Admins retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/admin/users ─────────────────────────────────────────────────
// Superadmin only — the first HTTP-based way to create an admin account.
// seedAdmin.js's CLI script remains the bootstrap path for the very first one.
const createAdmin = async (req, res, next) => {
  try {
    const { email, name, password, role } = req.body;
    if (!email || !password) {
      return errorResponse(res, "Email and password are required", 400);
    }
    if (role && !["admin", "superadmin"].includes(role)) {
      return errorResponse(res, "Invalid role", 400);
    }

    const existing = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return errorResponse(res, "An admin with this email already exists", 409);
    }

    const passwordHash = await Admin.hashPassword(password);
    const admin = await Admin.create({
      email: email.toLowerCase().trim(),
      name,
      passwordHash,
      role: role || "admin",
    });

    logAction(req, {
      action: "admin.created",
      targetType: "Admin",
      targetId: admin._id,
      summary: `Created admin account for ${admin.email} (${admin.role})`,
    });

    const { passwordHash: _omit, ...safeAdmin } = admin.toObject();
    return successResponse(res, safeAdmin, "Admin created successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/admin/users/:id/role ──────────────────────────────────────
// Superadmin only
const updateAdminRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role || !["admin", "superadmin"].includes(role)) {
      return errorResponse(res, "Invalid role. Must be 'admin' or 'superadmin'", 400);
    }

    const admin = await Admin.findByIdAndUpdate(req.params.id, { role }, { returnDocument: "after", runValidators: true });
    if (!admin) return errorResponse(res, "Admin not found", 404);

    logAction(req, {
      action: "admin.role_changed",
      targetType: "Admin",
      targetId: admin._id,
      summary: `Changed ${admin.email}'s role to '${role}'`,
    });

    return successResponse(res, admin, `Role updated to '${role}'`);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/admin/users/:id/status ────────────────────────────────────
// Superadmin only
const updateAdminStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return errorResponse(res, "isActive must be true or false", 400);
    }
    if (String(req.params.id) === String(req.user._id) && !isActive) {
      return errorResponse(res, "You cannot deactivate your own account", 400);
    }

    const admin = await Admin.findByIdAndUpdate(req.params.id, { isActive }, { returnDocument: "after", runValidators: true });
    if (!admin) return errorResponse(res, "Admin not found", 404);

    logAction(req, {
      action: "admin.status_changed",
      targetType: "Admin",
      targetId: admin._id,
      summary: `${isActive ? "Reactivated" : "Deactivated"} ${admin.email}`,
    });

    return successResponse(res, admin, `Account ${isActive ? "activated" : "deactivated"}`);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/admin/audit-log ──────────────────────────────────────────────
// Any admin can view — transparency, not a superadmin-only concern
const getAuditLog = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, action, actor } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (action) filter.action = action;
    if (actor) filter["actor.email"] = actor;

    const [entries, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      AuditLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    return successResponse(res, entries, "Audit log retrieved successfully", 200, {
      pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPrevPage: pageNum > 1 },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  getMe,
  getStats,
  getAllAdmins,
  createAdmin,
  updateAdminRole,
  updateAdminStatus,
  getAuditLog,
};
