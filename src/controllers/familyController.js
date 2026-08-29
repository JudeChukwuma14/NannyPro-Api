const Family = require("../models/Family");
const Shift = require("../models/Shift");
const { successResponse, errorResponse } = require("../utils/apiResponse");

// ─── GET /api/v1/families ─────────────────────────────────────────────────────
// Admin only — paginated, searchable
const getAllFamilies = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { familyReference: searchRegex },
        { area: searchRegex },
      ];
    }

    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const allowedSortFields = ["createdAt", "updatedAt", "firstName", "lastName"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sort = { [sortField]: sortDirection };

    const [families, total] = await Promise.all([
      Family.find(filter).select("-notes").sort(sort).skip(skip).limit(limitNum).lean(),
      Family.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return successResponse(res, families, "Families retrieved successfully", 200, {
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/families/:id ─────────────────────────────────────────────────
// Admin only — family detail + booking history in one payload
const getFamilyById = async (req, res, next) => {
  try {
    const family = await Family.findById(req.params.id).select("-notes").lean();
    if (!family) {
      return errorResponse(res, "Family not found", 404);
    }

    const shifts = await Shift.find({ family: req.params.id })
      .select("shiftReference status schedule rate assignedNanny type urgency")
      .populate("assignedNanny", "personalDetails.firstName personalDetails.lastName")
      .sort({ createdAt: -1 })
      .lean();

    return successResponse(res, { ...family, shifts }, "Family retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/families/:id/notes ─────────────────────────────────────────
// Admin only
const addNote = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return errorResponse(res, "Note text is required", 400);
    }

    const family = await Family.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          notes: {
            text: text.trim(),
            createdBy: req.user.email,
          },
        },
      },
      { returnDocument: "after" }
    ).select("notes");

    if (!family) {
      return errorResponse(res, "Family not found", 404);
    }

    const addedNote = family.notes[family.notes.length - 1];
    return successResponse(res, addedNote, "Note added successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/families/:id/notes ──────────────────────────────────────────
// Admin only
const getNotes = async (req, res, next) => {
  try {
    const family = await Family.findById(req.params.id).select("notes familyReference").lean();
    if (!family) {
      return errorResponse(res, "Family not found", 404);
    }

    return successResponse(res, family.notes || [], "Notes retrieved successfully");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllFamilies,
  getFamilyById,
  addNote,
  getNotes,
};
