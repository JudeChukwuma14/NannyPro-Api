const multer = require("multer");

// Use memory storage — files are kept in Buffer, passed directly to Cloudinary
// No temporary files are written to disk
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];

/**
 * Validate both MIME type and file extension to prevent
 * extension-spoofing attacks (e.g. an .exe renamed to .jpg).
 */
const fileFilter = (req, file, cb) => {
  const path = require("path");
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      Object.assign(new Error(`File type not allowed. Accepted: PDF, JPG, JPEG, PNG`), {
        code: "INVALID_FILE_TYPE",
      }),
      false
    );
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(
      Object.assign(new Error(`File extension '${ext}' is not permitted.`), {
        code: "INVALID_FILE_EXTENSION",
      }),
      false
    );
  }

  cb(null, true);
};

// 10 MB limit per file (matches frontend hint)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 20, // Maximum total files per request
  },
});

/**
 * Accept all known document field names from the frontend.
 * Each field can carry multiple files.
 */
const uploadDocumentFields = upload.fields([
  { name: "docId", maxCount: 3 },
  { name: "docDBS", maxCount: 3 },
  { name: "docPFA", maxCount: 3 },
  { name: "docQual", maxCount: 5 },
  { name: "docRTW", maxCount: 3 },
  { name: "docOther", maxCount: 5 },
  { name: "dbsCertFiles", maxCount: 3 },
  { name: "rtwFiles", maxCount: 3 },
]);

/**
 * Single-file upload for admin-initiated document uploads.
 */
const uploadSingleDocument = upload.single("document");

/**
 * Wraps a multer middleware and converts multer errors into our standard
 * API error format, rather than letting Express's default error handler fire.
 */
const withMulterErrorHandling = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum allowed size is 10MB.`,
          errors: [],
        });
      }
      if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          message: `Too many files or unexpected field name.`,
          errors: [],
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
        errors: [],
      });
    }

    if (err.code === "INVALID_FILE_TYPE" || err.code === "INVALID_FILE_EXTENSION") {
      return res.status(400).json({
        success: false,
        message: err.message,
        errors: [],
      });
    }

    next(err);
  });
};

module.exports = {
  uploadDocumentFields: withMulterErrorHandling(uploadDocumentFields),
  uploadSingleDocument: withMulterErrorHandling(uploadSingleDocument),
};
