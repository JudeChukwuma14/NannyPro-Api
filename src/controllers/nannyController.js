const jwt = require("jsonwebtoken");
const Nanny = require("../models/Nanny");
const ENV = require("../config/env");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { isTokenValid } = require("../utils/tokenUtils");
const { logAction } = require("../services/auditLogService");

function signNannyToken(nanny) {
  return jwt.sign({ id: nanny._id, email: nanny.email, role: "nanny" }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN,
  });
}

function publicNannyShape(nanny) {
  return {
    id: nanny._id,
    email: nanny.email,
    firstName: nanny.personalDetails?.firstName,
    lastName: nanny.personalDetails?.lastName,
    vettingStatus: nanny.vettingStatus,
    accountStatus: nanny.accountStatus,
    passwordSet: nanny.passwordSet,
    availability: nanny.availability,
  };
}

// ─── POST /api/v1/nannies/login ──────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return errorResponse(res, "Email and password are required", 400);
    }

    const nanny = await Nanny.findOne({ email: email.toLowerCase().trim() }).select("+passwordHash");

    // Identical error message regardless of why login fails — no user enumeration
    if (!nanny) {
      return errorResponse(res, "Invalid email or password", 401);
    }
    if (!nanny.passwordSet) {
      return errorResponse(res, "Please set your password first using the link provided by the agency.", 401);
    }
    const isMatch = await nanny.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, "Invalid email or password", 401);
    }
    if (nanny.accountStatus !== "Active") {
      return errorResponse(res, "This account is not active. Please contact the agency.", 401);
    }

    nanny.lastLoginAt = new Date();
    await nanny.save();

    const token = signNannyToken(nanny);
    return successResponse(res, { token, nanny: publicNannyShape(nanny) }, "Login successful");
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/nannies/set-password ───────────────────────────────────────
// Public — the token itself is the credential, no JWT required to call this
const setPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // setPasswordTokenHash isn't indexed for direct lookup (it's per-nanny,
    // not a globally unique field), so we scan active tokens. Given nanny
    // volume in Phase 1 this is fine; revisit with an indexed lookup if it grows.
    const candidates = await Nanny.find({ setPasswordTokenExpiresAt: { $gt: new Date() } }).select(
      "+setPasswordTokenHash +setPasswordTokenExpiresAt"
    );
    const match = candidates.find((n) => isTokenValid(token, n.setPasswordTokenHash));

    if (!match) {
      return errorResponse(res, "This link is invalid or has expired. Please contact the agency for a new one.", 400);
    }

    match.passwordHash = await Nanny.hashPassword(password);
    match.passwordSet = true;
    match.setPasswordTokenHash = undefined;
    match.setPasswordTokenExpiresAt = undefined;
    await match.save();

    const jwtToken = signNannyToken(match);
    return successResponse(res, { token: jwtToken, nanny: publicNannyShape(match) }, "Password set successfully");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/nannies/me ──────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    return successResponse(res, publicNannyShape(req.nanny), "Nanny profile retrieved");
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/nannies/me/availability ───────────────────────────────────
const updateMyAvailability = async (req, res, next) => {
  try {
    const { availableToday, emergencyBookings, maxTravelDistanceMiles, availableEvenings, availableWeekends } = req.body;

    const nanny = await Nanny.findByIdAndUpdate(
      req.nanny._id,
      {
        $set: {
          "availability.availableToday": !!availableToday,
          "availability.emergencyBookings": !!emergencyBookings,
          "availability.maxTravelDistanceMiles":
            maxTravelDistanceMiles === "" || maxTravelDistanceMiles == null ? null : Number(maxTravelDistanceMiles),
          "availability.availableEvenings": !!availableEvenings,
          "availability.availableWeekends": !!availableWeekends,
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    return successResponse(res, nanny.availability, "Availability updated");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/nannies ─────────────────────────────────────────────────────
// Admin only
const getAllNannies = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 20, vettingStatus, accountStatus, search,
      emergencyBookings, availableToday, availableEvenings, availableWeekends,
    } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (vettingStatus) filter.vettingStatus = vettingStatus;
    if (accountStatus) filter.accountStatus = accountStatus;
    if (emergencyBookings === "true") filter["availability.emergencyBookings"] = true;
    if (availableToday === "true") filter["availability.availableToday"] = true;
    if (availableEvenings === "true") filter["availability.availableEvenings"] = true;
    if (availableWeekends === "true") filter["availability.availableWeekends"] = true;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { "personalDetails.firstName": searchRegex },
        { "personalDetails.lastName": searchRegex },
        { email: searchRegex },
      ];
    }

    const [nannies, total] = await Promise.all([
      Nanny.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Nanny.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    return successResponse(res, nannies, "Nannies retrieved successfully", 200, {
      pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPrevPage: pageNum > 1 },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/nannies/:id ──────────────────────────────────────────────────
// Admin only
const getNannyById = async (req, res, next) => {
  try {
    const nanny = await Nanny.findById(req.params.id).lean();
    if (!nanny) return errorResponse(res, "Nanny not found", 404);
    return successResponse(res, nanny, "Nanny retrieved successfully");
  } catch (err) {
    next(err);
  }
};

const VALID_VETTING_STATUSES = ["Pending", "Vetted", "Suspended", "Revoked"];
const VALID_ACCOUNT_STATUSES = ["Active", "Inactive", "Suspended"];

// ─── PATCH /api/v1/nannies/:id/vetting-status ────────────────────────────────
// Admin only
const updateVettingStatus = async (req, res, next) => {
  try {
    const { vettingStatus } = req.body;
    if (!vettingStatus || !VALID_VETTING_STATUSES.includes(vettingStatus)) {
      return errorResponse(res, `Invalid vettingStatus. Must be one of: ${VALID_VETTING_STATUSES.join(", ")}`, 400);
    }
    const nanny = await Nanny.findByIdAndUpdate(req.params.id, { vettingStatus }, { returnDocument: "after", runValidators: true });
    if (!nanny) return errorResponse(res, "Nanny not found", 404);

    logAction(req, {
      action: "nanny.vetting_status_changed",
      targetType: "Nanny",
      targetId: nanny._id,
      summary: `Set ${nanny.email}'s vetting status to '${vettingStatus}'`,
    });

    return successResponse(res, nanny, `Vetting status updated to '${vettingStatus}'`);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/nannies/:id/account-status ────────────────────────────────
// Admin only
const updateAccountStatus = async (req, res, next) => {
  try {
    const { accountStatus } = req.body;
    if (!accountStatus || !VALID_ACCOUNT_STATUSES.includes(accountStatus)) {
      return errorResponse(res, `Invalid accountStatus. Must be one of: ${VALID_ACCOUNT_STATUSES.join(", ")}`, 400);
    }
    const nanny = await Nanny.findByIdAndUpdate(req.params.id, { accountStatus }, { returnDocument: "after", runValidators: true });
    if (!nanny) return errorResponse(res, "Nanny not found", 404);

    logAction(req, {
      action: "nanny.account_status_changed",
      targetType: "Nanny",
      targetId: nanny._id,
      summary: `Set ${nanny.email}'s account status to '${accountStatus}'`,
    });

    return successResponse(res, nanny, `Account status updated to '${accountStatus}'`);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/nannies/:id/availability ──────────────────────────────────
// Admin only — same shape as updateMyAvailability, but admin-gated and
// targets :id instead of the caller's own record (e.g. a nanny calls in and
// says she's free today — an admin can flip it on her behalf).
const updateNannyAvailabilityAdmin = async (req, res, next) => {
  try {
    const { availableToday, emergencyBookings, maxTravelDistanceMiles, availableEvenings, availableWeekends } = req.body;

    const nanny = await Nanny.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          "availability.availableToday": !!availableToday,
          "availability.emergencyBookings": !!emergencyBookings,
          "availability.maxTravelDistanceMiles":
            maxTravelDistanceMiles === "" || maxTravelDistanceMiles == null ? null : Number(maxTravelDistanceMiles),
          "availability.availableEvenings": !!availableEvenings,
          "availability.availableWeekends": !!availableWeekends,
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!nanny) return errorResponse(res, "Nanny not found", 404);

    return successResponse(res, nanny, "Availability updated");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  setPassword,
  getMe,
  updateMyAvailability,
  getAllNannies,
  getNannyById,
  updateVettingStatus,
  updateAccountStatus,
  updateNannyAvailabilityAdmin,
};
