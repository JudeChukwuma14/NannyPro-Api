/**
 * NannyPro API — Entry Point
 *
 * Loads environment variables, connects to MongoDB,
 * then starts the Express server.
 */

// Load env first — must happen before any other imports that use process.env
require("dotenv").config();

const http = require("http");
const connectDB = require("./src/config/db");
const ENV = require("./src/config/env");
const app = require("./src/server");
const { attachSocket } = require("./src/socket");
const { startShiftExpirySweep } = require("./src/jobs/shiftExpirySweep");

const startServer = async () => {
  // Connect to MongoDB — exits the process on failure (see db.js)
  await connectDB();

  const PORT = ENV.PORT || 5000;

  // Wrap the Express app in a raw HTTP server so Socket.IO can attach to it —
  // src/server.js stays a pure Express app builder.
  const httpServer = http.createServer(app);
  const io = attachSocket(httpServer);
  app.set("io", io); // controllers/services reach it via req.app.get("io")

  httpServer.listen(PORT, () => {
    console.log("─────────────────────────────────────────────");
    console.log(`  NannyPro API started`);
    console.log(`  Environment : ${ENV.NODE_ENV}`);
    console.log(`  Port        : ${PORT}`);
    console.log(`  Health      : http://localhost:${PORT}/api/v1/health`);
    console.log("─────────────────────────────────────────────");
  });

  startShiftExpirySweep(io);
};

// Handle unexpected rejections to prevent silent crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server] Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("[Server] SIGTERM received — shutting down gracefully");
  process.exit(0);
});

startServer();
