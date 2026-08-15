const Application = require("../models/Application");
const { generateUniqueReference } = require("../utils/generateReference");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { mapFormDataToSchema, processUploadedFiles } = require("../services/applicationService");
const { generateSignedUrl } = require("../services/cloudinaryService");

// ─── POST /api/v1/applications ───────────────────────────────────────────────
// Public — no authentication required
const submitApplication = async (req, res, next) => {
  try {
    const formData = req.body;

    // Generate a unique application reference (backend-generated, never trusted from frontend)
    const applicationReference = await generateUniqueReference(Application);

    // Map flat frontend form data → nested schema
    const applicationData = mapFormDataToSchema(formData);

    // Process any uploaded files → Cloudinary → document metadata
    const documents = req.files
      ? await processUploadedFiles(req.files, applicationReference)
      : [];

    const application = await Application.create({
      applicationReference,
      status: "New", // always forced to 'New' — never trusts frontend
      ...applicationData,
      documents,
    });

    return successResponse(
      res,
      { applicationReference: application.applicationReference },
      "Application submitted successfully",
      201
    );
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/applications ────────────────────────────────────────────────
// Admin only — paginated, filterable, searchable
const getAllApplications = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      workType,
      liveInOut,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter = {};

    // Status filter
    const VALID_STATUSES = [
      "New", "Under Review", "Documents Pending", "References",
      "Interview", "Vetting", "Approved", "Not Approved",
    ];
    if (status && VALID_STATUSES.includes(status)) {
      filter.status = status;
    }

    // Text search across name, email, reference, city
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { "personalDetails.fullName": searchRegex },
        { "personalDetails.email": searchRegex },
        { applicationReference: searchRegex },
        { "personalDetails.city": searchRegex },
      ];
    }

    if (workType) filter["availability.workType"] = workType;
    if (liveInOut) filter["availability.liveInOut"] = liveInOut;

    // Build sort
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const allowedSortFields = ["createdAt", "updatedAt", "status", "personalDetails.fullName"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sort = { [sortField]: sortDirection };

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .select("-notes -documents.publicId -dbs.dbsCertNumber") // Never return sensitive fields in list
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Application.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return successResponse(
      res,
      applications,
      "Applications retrieved successfully",
      200,
      {
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      }
    );
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/applications/:id ───────────────────────────────────────────
// Admin only — full application detail
const getApplicationById = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .select("-notes") // notes are returned via a separate endpoint
      .lean();

    if (!application) {
      return errorResponse(res, "Application not found", 404);
    }

    // Strip sensitive Cloudinary publicIds from document metadata in the response.
    // Admins access documents via GET /applications/:id/documents which generates signed URLs.
    if (application.documents) {
      application.documents = application.documents.map(({ publicId, ...rest }) => rest);
    }

    return successResponse(res, application, "Application retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/applications/:id/status ──────────────────────────────────
// Admin only
const updateApplicationStatus = async (req, res, next) => {
  try {
    const VALID_STATUSES = [
      "New", "Under Review", "Documents Pending", "References",
      "Interview", "Vetting", "Approved", "Not Approved",
    ];

    const { status } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      return errorResponse(
        res,
        `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
        400
      );
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: "after", runValidators: true }
    ).select("applicationReference status updatedAt personalDetails.fullName");

    if (!application) {
      return errorResponse(res, "Application not found", 404);
    }

    return successResponse(res, application, `Status updated to '${status}'`);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/applications/:id/notes ────────────────────────────────────
// Admin only
const addNote = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return errorResponse(res, "Note text is required", 400);
    }

    const application = await Application.findByIdAndUpdate(
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

    if (!application) {
      return errorResponse(res, "Application not found", 404);
    }

    const addedNote = application.notes[application.notes.length - 1];
    return successResponse(res, addedNote, "Note added successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/applications/:id/notes ─────────────────────────────────────
// Admin only
const getNotes = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .select("notes applicationReference")
      .lean();

    if (!application) {
      return errorResponse(res, "Application not found", 404);
    }

    return successResponse(res, application.notes || [], "Notes retrieved successfully");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitApplication,
  getAllApplications,
  getApplicationById,
  updateApplicationStatus,
  addNote,
  getNotes,
};
