const mongoose = require("mongoose");

// Immutable log entries — no updatedAt needed.
const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
      email: { type: String, required: true },
      role: { type: String, required: true },
    },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
