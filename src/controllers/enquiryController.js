const Enquiry = require("../models/Enquiry");
const { generateUniqueReference } = require("../utils/generateReference");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { mapFormDataToSchema } = require("../services/enquiryService");
const { logAction } = require("../services/auditLogService");
const { sendEnquiryReceivedEmail } = require("../services/notificationService");

// ─── POST /api/v1/enquiries ──────────────────────────────────────────────────
// Public — no authentication required
const submitEnquiry = async (req, res, next) => {
  try {
    const enquiryReference = await generateUniqueReference(Enquiry, "enquiryReference", "ENQ");
    const enquiryData = mapFormDataToSchema(req.body);

    const enquiry = await Enquiry.create({
      enquiryReference,
      status: "New", // always forced to 'New' — never trusts frontend
      ...enquiryData,
    });

    sendEnquiryReceivedEmail(enquiry);

    return successResponse(
      res,
      { enquiryReference: enquiry.enquiryReference },
      "Enquiry submitted successfully",
      201
    );
  } catch (err) {
    next(err);
  }
};

const VALID_STATUSES = ["New", "Under Review", "Matching", "Introduced", "Placed", "Closed"];

// ─── GET /api/v1/enquiries ────────────────────────────────────────────────────
// Admin only — paginated, filterable, searchable
const getAllEnquiries = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status && VALID_STATUSES.includes(status)) filter.status = status;

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { "parent.firstName": searchRegex },
        { "parent.lastName": searchRegex },
        { "parent.email": searchRegex },
        { enquiryReference: searchRegex },
        { "location.area": searchRegex },
      ];
    }

    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const allowedSortFields = ["createdAt", "updatedAt", "status", "parent.firstName", "parent.lastName"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sort = { [sortField]: sortDirection };

    const [enquiries, total] = await Promise.all([
      Enquiry.find(filter).select("-notes").sort(sort).skip(skip).limit(limitNum).lean(),
      Enquiry.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return successResponse(res, enquiries, "Enquiries retrieved successfully", 200, {
      pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPrevPage: pageNum > 1 },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/enquiries/:id ───────────────────────────────────────────────
// Admin only
const getEnquiryById = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id).select("-notes").lean();
    if (!enquiry) return errorResponse(res, "Enquiry not found", 404);
    return successResponse(res, enquiry, "Enquiry retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/enquiries/:id/status ──────────────────────────────────────
// Admin only
const updateEnquiryStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return errorResponse(res, `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: "after", runValidators: true }
    ).select("enquiryReference status updatedAt parent.firstName parent.lastName");

    if (!enquiry) return errorResponse(res, "Enquiry not found", 404);

    logAction(req, {
      action: "enquiry.status_changed",
      targetType: "Enquiry",
      targetId: enquiry._id,
      summary: `Set ${enquiry.enquiryReference} to '${status}'`,
    });

    return successResponse(res, enquiry, `Status updated to '${status}'`);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/enquiries/:id/notes ────────────────────────────────────────
// Admin only
const addNote = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return errorResponse(res, "Note text is required", 400);

    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { text: text.trim(), createdBy: req.user.email } } },
      { returnDocument: "after" }
    ).select("notes");

    if (!enquiry) return errorResponse(res, "Enquiry not found", 404);

    const addedNote = enquiry.notes[enquiry.notes.length - 1];
    return successResponse(res, addedNote, "Note added successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/enquiries/:id/notes ─────────────────────────────────────────
// Admin only
const getNotes = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id).select("notes enquiryReference").lean();
    if (!enquiry) return errorResponse(res, "Enquiry not found", 404);
    return successResponse(res, enquiry.notes || [], "Notes retrieved successfully");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
  addNote,
  getNotes,
};
