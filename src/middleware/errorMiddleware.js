const ENV = require("../config/env");

/**
 * Centralised error handling middleware.
 * Must be registered as the last middleware in app.js.
 *
 * Handles:
 *  - Mongoose ValidationError
 *  - Mongoose CastError (invalid ObjectId)
 *  - MongoDB duplicate key (code 11000)
 *  - JWT errors (caught earlier in authMiddleware, but belt-and-suspenders)
 *  - Multer errors (caught in uploadMiddleware, but belt-and-suspenders)
 *  - Generic 500
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = [];

  // ── Mongoose ValidationError ──────────────────────────────────────────────
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // ── Mongoose CastError (invalid ObjectId) ─────────────────────────────────
  else if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 400;
    message = `Invalid ID: '${err.value}' is not a valid resource identifier.`;
  }

  // ── MongoDB Duplicate Key ─────────────────────────────────────────────────
  else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const value = err.keyValue ? err.keyValue[field] : "";
    message = `A record with this ${field} already exists.`;
    if (field === "applicationReference") {
      // Transparent message is fine here — reference is not sensitive
      message = `Application reference '${value}' already exists. Please retry.`;
    } else if (field === "email") {
      // Do not confirm email existence to the public
      message = "This email address is already registered.";
    }
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token.";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Session expired. Please log in again.";
  }

  // ── Cloudinary errors ─────────────────────────────────────────────────────
  else if (err.http_code) {
    // Cloudinary SDK errors carry an http_code property
    statusCode = err.http_code >= 400 && err.http_code < 600 ? err.http_code : 500;
    message = "File upload service error. Please try again.";
  }

  // ── Stack trace suppression in production ─────────────────────────────────
  const isProduction = ENV.NODE_ENV === "production";

  // Never log passwords, secrets, or DBS numbers
  const safeLog = {
    path: req.path,
    method: req.method,
    statusCode,
    message,
    ...(isProduction ? {} : { stack: err.stack }),
  };
  console.error("[Error]", safeLog);

  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

/**
 * 404 handler — placed before errorHandler but after all valid routes.
 */
const notFound = (req, res, next) => {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
};

module.exports = { errorHandler, notFound };
