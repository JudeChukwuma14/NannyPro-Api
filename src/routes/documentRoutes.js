const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams gives access to :id from parent router

const { uploadDocuments, getDocuments, deleteDocument } = require("../controllers/documentController");
const { protect } = require("../middleware/authMiddleware");
const { uploadDocumentFields } = require("../middleware/uploadMiddleware");

// All document routes require admin authentication

// POST /api/v1/applications/:id/documents
router.post("/", protect, uploadDocumentFields, uploadDocuments);

// GET /api/v1/applications/:id/documents
router.get("/", protect, getDocuments);

// DELETE /api/v1/applications/:id/documents/:documentId
router.delete("/:documentId", protect, deleteDocument);

module.exports = router;
