const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const ENV = require("./config/env");

// ─── Route imports ─────────────────────────────────────────────────────────
const applicationRoutes = require("./routes/applicationRoutes");
const documentRoutes = require("./routes/documentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const nannyRoutes = require("./routes/nannyRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const familyRoutes = require("./routes/familyRoutes");
const childRoutes = require("./routes/childRoutes");
const contentRoutes = require("./routes/contentRoutes");
const communicationRoutes = require("./routes/communicationRoutes");
const { getAllDocuments, getDocumentUrl } = require("./controllers/documentController");
const { protect } = require("./middleware/authMiddleware");

// ─── Error handlers ────────────────────────────────────────────────────────
const { errorHandler, notFound } = require("./middleware/errorMiddleware");

const app = express();

// ─── Security headers ──────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ──────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || ENV.NODE_ENV !== "production") {
      return callback(null, true);
    }
    const allowedOrigins = ENV.CLIENT_URL.split(",").map((url) => url.trim());
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin '${origin}' is not allowed`));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));

// ─── Global rate limiter ───────────────────────────────────────────────────
// Broad limit — specific endpoints (login, submit) have their own tighter limits
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please slow down and try again shortly.",
    errors: [],
  },
});
app.use(globalLimiter);

// ─── Body parsing ──────────────────────────────────────────────────────────
// Limit JSON body to 2 MB — multipart/form-data is handled by Multer
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

// ─── Root health check (for hosting providers like Render) ───────────────
app.get("/", (req, res) => {
  res.status(200).send("NannyPro API is running");
});

// ─── Health check ──────────────────────────────────────────────────────────
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "NannyPro API is running",
    environment: ENV.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ────────────────────────────────────────────────────────────
app.use("/api/v1/applications", applicationRoutes);
app.use("/api/v1/applications/:id/documents", documentRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/nannies", nannyRoutes);
app.use("/api/v1/shifts", shiftRoutes);
app.use("/api/v1/enquiries", enquiryRoutes);
app.use("/api/v1/families", familyRoutes);
app.use("/api/v1/children", childRoutes);
app.use("/api/v1/content", contentRoutes);
app.use("/api/v1/communications", communicationRoutes);

// Cross-application document repository — a single read-only aggregate, not
// a resource with its own lifecycle, so it doesn't get a dedicated route file.
app.get("/api/v1/documents", protect, getAllDocuments);
app.get("/api/v1/documents/:applicationId/:documentId/url", protect, getDocumentUrl);

// ─── 404 handler ───────────────────────────────────────────────────────────
app.use(notFound);

// ─── Centralised error handler ─────────────────────────────────────────────
// Must be last middleware — 4 arguments required
app.use(errorHandler);

module.exports = app;
