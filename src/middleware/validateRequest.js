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

// ─── Shift & Nanny validation ────────────────────────────────────────────────

const SHIFT_STRIPPED_FIELDS = [
  "status", "shiftReference", "_id", "__v", "assignedNanny", "acceptedAt", "confirmedAt",
  "confirmationToken", "confirmationExpiresAt", "parentTrackingTokenHash",
  "excludedNannyIds", "acceptCycleCount", "cancellation",
];

const NANNY_STRIPPED_FIELDS = [
  "status", "_id", "__v", "passwordHash", "setPasswordTokenHash", "setPasswordTokenExpiresAt",
  "vettingStatus", "accountStatus", "applicationRef", "passwordSet",
];

/**
 * Remove fields that should never be set directly by an unauthenticated
 * client submitting a new shift.
 */
const stripShiftControlFields = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    SHIFT_STRIPPED_FIELDS.forEach((field) => {
      delete req.body[field];
    });
  }
  next();
};

/**
 * Remove fields that should never be set directly by a nanny (e.g. via the
 * set-password or availability endpoints).
 */
const stripNannyControlFields = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    NANNY_STRIPPED_FIELDS.forEach((field) => {
      delete req.body[field];
    });
  }
  next();
};

/**
 * Read a dot-notation path off a plain object, e.g. getPath(body, "family.email").
 */
function getPath(obj, dotPath) {
  return dotPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/**
 * Validate the minimum required fields for a public emergency-shift submission.
 * Returns 400 with field-level errors if validation fails.
 */
const validateShiftSubmission = (req, res, next) => {
  const errors = [];
  const body = req.body || {};

  const required = [
    { path: "family.firstName", label: "First name" },
    { path: "family.lastName", label: "Last name" },
    { path: "family.email", label: "Email address" },
    { path: "family.phone", label: "Phone number" },
    { path: "schedule.date", label: "Date" },
    { path: "schedule.startTime", label: "Start time" },
    { path: "schedule.finishTime", label: "Finish time" },
    { path: "location.postcode", label: "Postcode" },
    { path: "location.area", label: "Area" },
    { path: "rate.amount", label: "Rate" },
    { path: "urgency", label: "Urgency" },
  ];

  required.forEach(({ path, label }) => {
    const value = getPath(body, path);
    if (value === undefined || value === null || value === "") {
      errors.push({ field: path, message: `${label} is required` });
    }
  });

  if (!Array.isArray(body.children) || body.children.length === 0) {
    errors.push({ field: "children", message: "At least one child is required" });
  }

  if (body.family?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.family.email)) {
    errors.push({ field: "family.email", message: "Please provide a valid email address" });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: "Validation failed", errors });
  }

  next();
};

/**
 * Validate a nanny set-password submission.
 */
const validateNannySetPassword = (req, res, next) => {
  const errors = [];
  const body = req.body || {};

  if (!body.token) errors.push({ field: "token", message: "Reset token is required" });
  if (!body.password || body.password.length < 8) {
    errors.push({ field: "password", message: "Password must be at least 8 characters" });
  }
  if (body.password !== body.confirmPassword) {
    errors.push({ field: "confirmPassword", message: "Passwords do not match" });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: "Validation failed", errors });
  }

  next();
};

// ─── Enquiry validation ───────────────────────────────────────────────────────

const ENQUIRY_STRIPPED_FIELDS = ["status", "enquiryReference", "_id", "__v", "notes"];

/**
 * Remove fields that should never be set by an unauthenticated client
 * submitting a new enquiry.
 */
const stripEnquiryControlFields = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    ENQUIRY_STRIPPED_FIELDS.forEach((field) => {
      delete req.body[field];
    });
  }
  next();
};

/**
 * Validate the minimum required fields for a public "Request a Nanny"
 * enquiry submission (RequestNannyPage.jsx's flat getValues() shape).
 */
const validateEnquirySubmission = (req, res, next) => {
  const errors = [];
  const body = req.body || {};

  const required = [
    { path: "serviceType", label: "Service type" },
    { path: "frequency", label: "Frequency" },
    { path: "preferredStartDate", label: "Preferred start date" },
    { path: "hoursPerWeek", label: "Hours per week" },
    { path: "postcode", label: "Postcode" },
    { path: "area", label: "Area" },
    { path: "locationType", label: "Location type" },
    { path: "livingArrangement", label: "Living arrangement" },
    { path: "experienceRequired", label: "Experience required" },
    { path: "parentFirstName", label: "First name" },
    { path: "parentLastName", label: "Last name" },
    { path: "email", label: "Email address" },
    { path: "phone", label: "Phone number" },
    { path: "contactMethod", label: "Preferred contact method" },
  ];

  required.forEach(({ path, label }) => {
    const value = body[path];
    if (value === undefined || value === null || value === "") {
      errors.push({ field: path, message: `${label} is required` });
    }
  });

  if (!Array.isArray(body.daysNeeded) || body.daysNeeded.length === 0) {
    errors.push({ field: "daysNeeded", message: "Please select at least one day" });
  }
  if (!Array.isArray(body.duties) || body.duties.length === 0) {
    errors.push({ field: "duties", message: "Please select at least one duty" });
  }
  if (!Array.isArray(body.children) || body.children.length === 0) {
    errors.push({ field: "children", message: "At least one child is required" });
  }
  if (body.agreeToContact !== true && body.agreeToContact !== "true") {
    errors.push({ field: "agreeToContact", message: "You must agree to be contacted to continue" });
  }

  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push({ field: "email", message: "Please provide a valid email address" });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: "Validation failed", errors });
  }

  next();
};

module.exports = {
  parseMultipartJsonFields,
  stripControlFields,
  sanitiseBody,
  validateApplicationSubmission,
  stripShiftControlFields,
  stripNannyControlFields,
  validateShiftSubmission,
  validateNannySetPassword,
  stripEnquiryControlFields,
  validateEnquirySubmission,
};

