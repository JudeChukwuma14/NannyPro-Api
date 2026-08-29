const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const ENV = require("./config/env");
const Nanny = require("./models/Nanny");
const Admin = require("./models/Admin");
const Shift = require("./models/Shift");
const { isTokenValid } = require("./utils/tokenUtils");

/**
 * Attach a Socket.IO server to the raw HTTP server (called from app.js,
 * which already owns .listen()). src/server.js itself stays untouched.
 *
 * Transport plumbing only (auth handshake, room membership) lives here —
 * business logic of *what* to emit stays in src/services/shiftService.js,
 * called from controllers with req.app.get("io").
 */
function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: ENV.NODE_ENV !== "production" ? true : ENV.CLIENT_URL,
      credentials: true,
    },
  });

  // Anonymous (parent) connections are allowed through unauthenticated —
  // they only gain room membership after proving trackingToken possession
  // via the join:shift-tracking event below.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET);
      if (decoded.role === "nanny") {
        const nanny = await Nanny.findById(decoded.id).select("-passwordHash -setPasswordTokenHash");
        if (!nanny || nanny.accountStatus !== "Active") {
          return next(new Error("Invalid or inactive account"));
        }
        socket.nanny = nanny;
      } else if (decoded.role === "admin" || decoded.role === "superadmin") {
        const admin = await Admin.findById(decoded.id).select("-passwordHash");
        if (!admin) return next(new Error("Invalid account"));
        socket.admin = admin;
      }
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.nanny) {
      socket.join(`nanny:${socket.nanny._id}`);
      if (socket.nanny.vettingStatus === "Vetted") socket.join("nannies:vetted");
    }
    if (socket.admin) {
      socket.join("admin:all");
    }

    // A parent proves ownership of a shift by presenting the trackingToken
    // returned once at creation — rooms are server-controlled, so a client
    // can never join shift:<id> just by knowing/guessing the room name.
    socket.on("join:shift-tracking", async ({ shiftReference, trackingToken } = {}, ack) => {
      try {
        if (!shiftReference || !trackingToken) return ack?.({ ok: false });
        const shift = await Shift.findOne({ shiftReference }).select("+parentTrackingTokenHash");
        if (shift && isTokenValid(trackingToken, shift.parentTrackingTokenHash)) {
          socket.join(`shift:${shift._id}`);
          return ack?.({ ok: true });
        }
        return ack?.({ ok: false });
      } catch {
        return ack?.({ ok: false });
      }
    });
  });

  return io;
}

module.exports = { attachSocket };
