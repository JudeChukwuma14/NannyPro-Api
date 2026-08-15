const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const ENV = require("../config/env");
const { successResponse, errorResponse } = require("../utils/apiResponse");

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
        role: req.user.role,
        createdAt: req.user.createdAt,
      },
      "Admin profile retrieved"
    );
  } catch (err) {
    next(err);
  }
};

module.exports = { login, getMe };
