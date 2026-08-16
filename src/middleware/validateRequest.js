/**
 * Request validation and sanitisation middleware.
 *
 * Used on the public application submission endpoint to:
 *  - Trim whitespace from string fields
 *  - Strip basic XSS vectors from text inputs
 *  - Validate required fields before hitting the controller
 *  - Ensure the frontend cannot inject status or applicationReference
 */

const STRIPPED_FIELDS = ["status", "applicationReference", "_id", "__v", "notes", "documents"];

/**
 * When the frontend submits via multipart/form-data, JSON arrays/objects
 * are stringified before appending to FormData.
 * This middleware parses those fields back into their original types.
 *
 * Must run AFTER multer (uploadDocumentFields) so req.body is populated.
 */
const parseMultipartJsonFields = (req, res, next) => {
  if (!req.body) return next();
  for (const key of Object.keys(req.body)) {
    const val = req.body[key];
    if (typeof val === "string" && (val.startsWith("[") || val.startsWith("{"))) {
      try {
        req.body[key] = JSON.parse(val);
      } catch {
        // Leave as string if JSON.parse fails
      }
    }
  }
  next();
};


/**
 * Remove control fields that should never be set by unauthenticated clients.
 */
const stripControlFields = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    STRIPPED_FIELDS.forEach((field) => {
      delete req.body[field];
    });
  }
  next();
};

/**
 * Recursively trim strings in an object.
 * Does not mutate arrays of objects deeply — references sub-objects safely.
 */
function deepTrimStrings(obj) {
  if (typeof obj === "string") return obj.trim();
  if (Array.isArray(obj)) return obj.map(deepTrimStrings);
  if (obj !== null && typeof obj === "object") {
    const trimmed = {};
    for (const key of Object.keys(obj)) {
      trimmed[key] = deepTrimStrings(obj[key]);
    }
    return trimmed;
  }
  return obj;
}

/**
 * Basic XSS prevention — removes common HTML/script injection patterns
 * from strings. Does NOT replace a proper sanitisation library; it is a
 * belt-and-suspenders layer for an application that renders data server-side.
 */
function sanitiseString(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "") // strip any HTML tags
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, ""); // strip event handlers
}

function deepSanitise(obj) {
  if (typeof obj === "string") return sanitiseString(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitise);
  if (obj !== null && typeof obj === "object") {
    const sanitised = {};
    for (const key of Object.keys(obj)) {
      sanitised[key] = deepSanitise(obj[key]);
    }
    return sanitised;
  }
  return obj;
}

/**
 * Middleware: trim and sanitise all string fields in req.body.
 */
const sanitiseBody = (req, res, next) => {
  if (req.body) {
    req.body = deepTrimStrings(req.body);
    req.body = deepSanitise(req.body);
  }
  next();
};

/**
 * Validate the minimum required fields for an application submission.
 * Returns 400 with field-level errors if validation fails.
 */
const validateApplicationSubmission = (req, res, next) => {
  const errors = [];
  const body = req.body || {};

  const required = [
    { path: "firstName", label: "First name" },
    { path: "lastName", label: "Last name" },
    { path: "email", label: "Email address" },
    { path: "phone", label: "Phone number" },
    { path: "address1", label: "Address Line 1" },
    { path: "city", label: "Town / City" },
    { path: "postcode", label: "Postcode" },
    { path: "informationAccurate", label: "Declaration: information accurate" },
    { path: "applicationReviewConsent", label: "Application review consent" },
    { path: "referenceConsent", label: "Reference consent" },
    { path: "privacyPolicyConsent", label: "Privacy policy agreement" },
    { path: "termsConsent", label: "Terms agreement" },
  ];

  required.forEach(({ path, label }) => {
    const value = body[path];
    if (value === undefined || value === null || value === "" || value === false || value === "false") {
      errors.push({ field: path, message: `${label} is required` });
    }
  });

  // Validate email format
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push({ field: "email", message: "Please provide a valid email address" });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

module.exports = {
  parseMultipartJsonFields,
  stripControlFields,
  sanitiseBody,
  validateApplicationSubmission,
};

