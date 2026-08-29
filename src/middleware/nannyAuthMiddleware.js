const jwt = require("jsonwebtoken");
const Nanny = require("../models/Nanny");
const ENV = require("../config/env");
const { errorResponse } = require("../utils/apiResponse");

/**
 * protectNanny — mirrors authMiddleware.js's `protect` exactly, but resolves
 * against the Nanny model and attaches req.nanny (never req.user), so nanny
 * and admin auth stay visually distinct in every downstream handler.
 *
 * A parallel middleware rather than a role-branch inside `protect` — isolates
 * this new code path from the three routers that already depend on `protect`
 * working exactly as it does today.
 */
const protectNanny = async (req, res, next) => {
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

    if (decoded.role !== "nanny") {
      return errorResponse(res, "Invalid authentication token.", 401);
    }

    const nanny = await Nanny.findById(decoded.id).select("-passwordHash -setPasswordTokenHash");
    if (!nanny) {
      return errorResponse(res, "Account no longer exists.", 401);
    }
    if (nanny.accountStatus !== "Active") {
      return errorResponse(res, "This account is not active. Please contact the agency.", 401);
    }

    req.nanny = nanny;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { protectNanny };
