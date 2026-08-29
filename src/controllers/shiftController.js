const Shift = require("../models/Shift");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const {
  createShiftFromBooking,
  broadcastShiftToEligibleNannies,
  acceptShift,
  withdrawShift,
  confirmShift,
  cancelShift,
  completeShift,
  trackShift,
} = require("../services/shiftService");
const { isNannyEligibleForShift } = require("../services/shiftMatchingService");
const { logAction } = require("../services/auditLogService");

function getIo(req) {
  return req.app.get("io");
}

// ─── POST /api/v1/shifts ──────────────────────────────────────────────────────
// Public — creates the shift, then broadcasts it to every eligible nanny
const createShift = async (req, res, next) => {
  try {
    const { shift, trackingToken } = await createShiftFromBooking(req.body);
    await broadcastShiftToEligibleNannies(getIo(req), shift);

    return successResponse(
      res,
      { shiftReference: shift.shiftReference, trackingToken },
      "Shift request submitted",
      201
    );
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/shifts/:reference/track ────────────────────────────────────
// Public — parent proves ownership via trackingToken
const track = async (req, res, next) => {
  try {
    const { trackingToken } = req.body;
    if (!trackingToken) return errorResponse(res, "trackingToken is required", 400);

    const result = await trackShift(req.params.reference, trackingToken);
    if (result.error === "NOT_FOUND") return errorResponse(res, "Shift not found or invalid tracking token", 404);

    return successResponse(res, result.shift, "Shift status retrieved");
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/shifts/:reference/confirm ──────────────────────────────────
// Public — parent confirms with the token delivered via socket (or track fallback)
const confirm = async (req, res, next) => {
  try {
    const { confirmationToken } = req.body;
    if (!confirmationToken) return errorResponse(res, "confirmationToken is required", 400);

    const result = await confirmShift(req.params.reference, confirmationToken, getIo(req));
    if (result.error === "NOT_FOUND") return errorResponse(res, "Shift not found or not awaiting confirmation", 404);
    if (result.error === "EXPIRED") return errorResponse(res, "The confirmation window has expired", 410);
    if (result.error === "INVALID_TOKEN") return errorResponse(res, "Invalid confirmation token", 401);

    return successResponse(res, result.shift, "Booking confirmed");
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/shifts/:reference/cancel ───────────────────────────────────
// Public — parent cancels with their tracking token
const cancelByParent = async (req, res, next) => {
  try {
    const { trackingToken, reason } = req.body;
    if (!trackingToken) return errorResponse(res, "trackingToken is required", 400);

    const trackResult = await trackShift(req.params.reference, trackingToken);
    if (trackResult.error === "NOT_FOUND") return errorResponse(res, "Shift not found or invalid tracking token", 404);

    const shift = await Shift.findOne({ shiftReference: req.params.reference });
    const result = await cancelShift(shift, { cancelledBy: "Parent", reason }, getIo(req));
    if (result.error === "NOT_CANCELLABLE") return errorResponse(res, "This shift can no longer be cancelled", 409);

    return successResponse(res, result.shift, "Shift cancelled");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/shifts/available ────────────────────────────────────────────
// protectNanny — Open shifts this nanny is currently eligible for
const getAvailableShifts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    // Broad DB-level filter first (cheap), then apply the full eligibility
    // check in memory — mirrors the same isNannyEligibleForShift() used at
    // creation/accept time, so a nanny is never shown a shift she couldn't
    // actually accept.
    const openShifts = await Shift.find({ status: "Open" }).sort({ createdAt: -1 }).limit(500);
    const eligible = openShifts.filter((shift) => isNannyEligibleForShift(req.nanny, shift));

    const total = eligible.length;
    const start = (pageNum - 1) * limitNum;
    const page_ = eligible.slice(start, start + limitNum);

    return successResponse(res, page_, "Available shifts retrieved", 200, {
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/shifts/mine ──────────────────────────────────────────────────
// protectNanny — this nanny's own shifts, any status
const getMyShifts = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { assignedNanny: req.nanny._id };
    if (status) filter.status = status;

    const shifts = await Shift.find(filter).sort({ createdAt: -1 });
    return successResponse(res, shifts, "Your shifts retrieved");
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/shifts/:id/accept ──────────────────────────────────────────
// protectNanny
const accept = async (req, res, next) => {
  try {
    const result = await acceptShift(req.params.id, req.nanny, getIo(req));
    if (result.error === "NOT_FOUND") return errorResponse(res, "Shift not found", 404);
    if (result.error === "ALREADY_TAKEN") return errorResponse(res, "This shift has already been accepted by another nanny", 409);
    if (result.error === "NOT_ELIGIBLE") return errorResponse(res, "You are not eligible for this shift", 403);

    return successResponse(res, { shift: result.shift }, "Shift accepted — awaiting parent confirmation");
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/shifts/:id/withdraw ────────────────────────────────────────
// protectNanny
const withdraw = async (req, res, next) => {
  try {
    const result = await withdrawShift(req.params.id, req.nanny, getIo(req));
    if (result.error === "NOT_WITHDRAWABLE") return errorResponse(res, "This shift cannot be withdrawn from", 409);

    return successResponse(res, result.shift, "Withdrawn — shift reopened");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/shifts ───────────────────────────────────────────────────────
// Admin only
const getAllShifts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ shiftReference: searchRegex }, { "location.area": searchRegex }, { "location.postcode": searchRegex }];
    }

    const [shifts, total] = await Promise.all([
      Shift.find(filter)
        .populate("family", "firstName lastName email phone")
        .populate("assignedNanny", "personalDetails.firstName personalDetails.lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Shift.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    return successResponse(res, shifts, "Shifts retrieved successfully", 200, {
      pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPrevPage: pageNum > 1 },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/shifts/:id ───────────────────────────────────────────────────
// Admin only
const getShiftById = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .populate("family")
      .populate("assignedNanny", "-passwordHash -setPasswordTokenHash")
      .lean();
    if (!shift) return errorResponse(res, "Shift not found", 404);
    return successResponse(res, shift, "Shift retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/shifts/:id/cancel ─────────────────────────────────────────
// Admin only
const adminCancel = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) return errorResponse(res, "Shift not found", 404);

    const result = await cancelShift(shift, { cancelledBy: "Admin", reason: req.body.reason }, getIo(req));
    if (result.error === "NOT_CANCELLABLE") return errorResponse(res, "This shift can no longer be cancelled", 409);

    logAction(req, {
      action: "shift.cancelled",
      targetType: "Shift",
      targetId: result.shift._id,
      summary: `Cancelled ${result.shift.shiftReference}${req.body.reason ? `: ${req.body.reason}` : ""}`,
    });

    return successResponse(res, result.shift, "Shift cancelled");
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/shifts/:id/complete ───────────────────────────────────────
// Admin only
const adminComplete = async (req, res, next) => {
  try {
    const result = await completeShift(req.params.id);
    if (result.error === "NOT_COMPLETABLE") return errorResponse(res, "Only a Confirmed shift can be marked Completed", 409);

    logAction(req, {
      action: "shift.completed",
      targetType: "Shift",
      targetId: result.shift._id,
      summary: `Marked ${result.shift.shiftReference} as Completed`,
    });

    return successResponse(res, result.shift, "Shift marked as completed");
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
