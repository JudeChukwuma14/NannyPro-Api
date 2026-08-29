const Child = require("../models/Child");
const { successResponse, errorResponse } = require("../utils/apiResponse");

// ─── GET /api/v1/children ─────────────────────────────────────────────────────
// Admin only — paginated, optionally filtered to one family
const getAllChildren = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, family, search } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (family) filter.family = family;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ firstName: searchRegex }, { lastName: searchRegex }];
    }

    const [children, total] = await Promise.all([
      Child.find(filter)
        .select("-notes")
        .populate("family", "firstName lastName familyReference")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Child.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    return successResponse(res, children, "Children retrieved successfully", 200, {
      pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPrevPage: pageNum > 1 },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/children/:id ─────────────────────────────────────────────────
const getChildById = async (req, res, next) => {
  try {
    const child = await Child.findById(req.params.id).populate("family", "firstName lastName familyReference").lean();
    if (!child) return errorResponse(res, "Child not found", 404);
    return successResponse(res, child, "Child retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/children ────────────────────────────────────────────────────
// Admin only — body must include `family` (Family id)
const createChild = async (req, res, next) => {
  try {
    const { family, firstName, lastName, age, gender, allergiesOrNotes } = req.body;
    if (!family) return errorResponse(res, "A family is required", 400);
    if (!firstName || !firstName.trim()) return errorResponse(res, "First name is required", 400);

    const child = await Child.create({ family, firstName, lastName, age, gender, allergiesOrNotes });
    return successResponse(res, child, "Child added successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/children/:id ───────────────────────────────────────────────
const updateChild = async (req, res, next) => {
  try {
    const { firstName, lastName, age, gender, allergiesOrNotes } = req.body;
    const child = await Child.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName, age, gender, allergiesOrNotes },
      { returnDocument: "after", runValidators: true }
    );
    if (!child) return errorResponse(res, "Child not found", 404);
    return successResponse(res, child, "Child updated successfully");
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/v1/children/:id ──────────────────────────────────────────────
const deleteChild = async (req, res, next) => {
  try {
    const child = await Child.findByIdAndDelete(req.params.id);
    if (!child) return errorResponse(res, "Child not found", 404);
    return successResponse(res, null, "Child deleted successfully");
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllChildren, getChildById, createChild, updateChild, deleteChild };
