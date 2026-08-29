const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const ENV = require("../config/env");
const { errorResponse } = require("../utils/apiResponse");

/**
 * protect — verifies a JWT in the Authorization header.
 * Attaches the admin document to req.user on success.
 * Returns 401 if the token is missing or invalid.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(res, "Authentication required. No token provided.", 401);
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === "TokenExpiredError") {
        return errorResponse(res, "Session expired. Please log in again.", 401);
      }
      return errorResponse(res, "Invalid authentication token.", 401);
    }

    // Fetch the admin — will return null if account was deleted after token issued
    const admin = await Admin.findById(decoded.id).select("-passwordHash");
    if (!admin) {
      return errorResponse(res, "Account no longer exists.", 401);
    }
    if (admin.isActive === false) {
      return errorResponse(res, "This account has been deactivated.", 401);
    }

    req.user = admin;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * requireRole — checks that req.user has one of the allowed roles.
 * Must be used after the protect middleware.
 * Returns 403 Forbidden if the role is insufficient.
 *
 * @param {...string} roles
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return errorResponse(res, "You do not have permission to perform this action.", 403);
  }
  next();
};

module.exports = { protect, requireRole };
