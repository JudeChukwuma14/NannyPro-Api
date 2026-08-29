const Application = require("../models/Application");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const { uploadFile, deleteFile, generateSignedUrl } = require("../services/cloudinaryService");
const { FIELD_TO_DOC_TYPE } = require("../services/applicationService");

// ─── POST /api/v1/applications/:id/documents ────────────────────────────────
// Admin — upload additional documents to an existing application
const uploadDocuments = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return errorResponse(res, "Application not found", 404);
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return errorResponse(res, "No files were uploaded", 400);
    }

    const folder = `nanny-applications/${application.applicationReference}`;
    const newDocuments = [];

    for (const [fieldName, fileArray] of Object.entries(req.files)) {
      const docType = FIELD_TO_DOC_TYPE[fieldName] || "OTHER";
      for (const file of fileArray) {
        const result = await uploadFile(file.buffer, file.originalname, file.mimetype, folder);
        newDocuments.push({
          type: docType,
          originalName: file.originalname,
          publicId: result.publicId,
          resourceType: result.resourceType,
          format: result.format,
          bytes: result.bytes,
          uploadedAt: new Date(),
        });
      }
    }

    application.documents.push(...newDocuments);
    await application.save();

    // Return metadata without publicIds
    const safeDocuments = newDocuments.map(({ publicId, ...rest }) => rest);

    return successResponse(res, safeDocuments, "Documents uploaded successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/applications/:id/documents ──────────────────────────────────
// Admin — returns document metadata with short-lived signed download URLs
const getDocuments = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .select("documents applicationReference")
      .lean();

    if (!application) {
      return errorResponse(res, "Application not found", 404);
    }

    // Generate signed URLs for each document (valid for 1 hour)
    const documents = (application.documents || []).map((doc) => ({
      _id: doc._id,
      type: doc.type,
      originalName: doc.originalName,
      resourceType: doc.resourceType,
      format: doc.format,
      bytes: doc.bytes,
      uploadedAt: doc.uploadedAt,
      // Generate a signed URL — admin-only, time-limited access
      signedUrl: generateSignedUrl(doc.publicId, doc.resourceType, 3600),
    }));

    return successResponse(res, documents, "Documents retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/v1/applications/:id/documents/:documentId ──────────────────
// Admin — removes document from Cloudinary first, then from MongoDB
const deleteDocument = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      return errorResponse(res, "Application not found", 404);
    }

    const document = application.documents.id(req.params.documentId);
    if (!document) {
      return errorResponse(res, "Document not found", 404);
    }

    // Delete from Cloudinary FIRST — if this fails, we do NOT remove MongoDB record
    // so we can retry. This prevents orphaned MongoDB records.
    try {
      await deleteFile(document.publicId, document.resourceType);
    } catch (cloudinaryErr) {
      console.error("[Documents] Cloudinary deletion failed:", cloudinaryErr.message);
      return errorResponse(
        res,
        "Failed to delete document from storage. The database record has been preserved. Please try again.",
        502
      );
    }

    // Only remove from DB after successful Cloudinary deletion
    application.documents.pull({ _id: req.params.documentId });
    await application.save();

    return successResponse(res, null, "Document deleted successfully");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/documents ────────────────────────────────────────────────────
// Admin — flat cross-application document repository (aggregate, read-only)
const getAllDocuments = async (req, res, next) => {
  try {
    const { type } = req.query;

    const applications = await Application.find({ "documents.0": { $exists: true } })
      .select("applicationReference personalDetails.firstName personalDetails.lastName documents")
      .lean();

    let rows = [];
    for (const app of applications) {
      for (const doc of app.documents || []) {
        rows.push({
          applicationId: app._id,
          applicationReference: app.applicationReference,
          applicantName: [app.personalDetails?.firstName, app.personalDetails?.lastName].filter(Boolean).join(" "),
          documentId: doc._id,
          type: doc.type,
          originalName: doc.originalName,
          format: doc.format,
          bytes: doc.bytes,
          uploadedAt: doc.uploadedAt,
        });
      }
    }

    if (type) rows = rows.filter((r) => r.type === type);
    rows.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return successResponse(res, rows, "Documents retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/documents/:applicationId/:documentId/url ───────────────────
// Admin — generates a signed URL for one document on demand (never cached/listed)
const getDocumentUrl = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.applicationId).select("documents").lean();
    if (!application) return errorResponse(res, "Application not found", 404);

    const document = (application.documents || []).find((d) => String(d._id) === req.params.documentId);
    if (!document) return errorResponse(res, "Document not found", 404);

    const signedUrl = generateSignedUrl(document.publicId, document.resourceType, 3600);
    return successResponse(res, { signedUrl }, "Signed URL generated");
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadDocuments, getDocuments, deleteDocument, getAllDocuments, getDocumentUrl };
