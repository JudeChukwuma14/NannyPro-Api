const mongoose = require("mongoose");

const childSchema = new mongoose.Schema(
  {
    age: { type: Number, required: true, min: 0, max: 17 },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const shiftSchema = new mongoose.Schema(
  {
    // Human-readable display ID only — never treated as a security credential.
    shiftReference: {
      type: String,
      unique: true,
      index: true,
    },

    // "backupCare" is reserved for a future non-instant-accept flow.
    // No matching/accept logic is built for it in this phase.
    type: {
      type: String,
      enum: ["emergency", "backupCare"],
      default: "emergency",
      index: true,
    },

    status: {
      type: String,
      enum: ["Open", "Pending Confirmation", "Confirmed", "Completed", "Cancelled", "Expired"],
      default: "Open",
      index: true,
    },

    urgency: {
      type: String,
      enum: ["ASAP (within 2 hours)", "Today", "Within 24 hours", "Planned (2+ days)"],
      required: true,
    },

    schedule: {
      date: { type: String, required: true }, // "YYYY-MM-DD"
      startTime: { type: String, required: true }, // "HH:mm"
      finishTime: { type: String, required: true }, // "HH:mm"
    },

    location: {
      postcode: { type: String, trim: true, required: true },
      area: { type: String, trim: true, required: true },
    },

    children: {
      type: [childSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one child is required",
      },
    },

    duties: [{ type: String }],

    rate: {
      amount: { type: Number, required: true, min: 0 },
      unit: { type: String, enum: ["per hour", "per shift"], default: "per hour" },
    },

    specialRequirements: { type: String, trim: true },

    family: { type: mongoose.Schema.Types.ObjectId, ref: "Family", required: true, index: true },

    assignedNanny: { type: mongoose.Schema.Types.ObjectId, ref: "Nanny", default: null, index: true },
    acceptedAt: { type: Date },
    confirmedAt: { type: Date },

    // Regenerated every time the shift enters "Pending Confirmation".
    // Deliberately stored in recoverable (not one-way-hashed) form — see
    // isTokenMatch() in tokenUtils.js for why.
    confirmationToken: { type: String, select: false },
    confirmationExpiresAt: { type: Date },

    // Generated once at creation, constant for the shift's lifetime.
    parentTrackingTokenHash: { type: String, select: false },

    // Nannies who accepted-then-timed-out or withdrew — excluded from re-offer.
    excludedNannyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Nanny" }],
    acceptCycleCount: { type: Number, default: 0 },

    cancellation: {
      cancelledBy: { type: String, enum: ["Parent", "Admin", "Nanny", "System"] },
      reason: { type: String, trim: true },
      cancelledAt: { type: Date },
    },

    // ── Phase 4 (ledger/analytics) fields are deliberately NOT added here yet:
    // nannyPayment, incidentReported, hoursCompleted, parentFeedback, timesheets.
    // Adding them later is a pure additive schema edit.
  },
  {
    timestamps: true,
  }
);

shiftSchema.index({ status: 1, "schedule.date": 1 });
shiftSchema.index({ family: 1, createdAt: -1 });
shiftSchema.index({ assignedNanny: 1, status: 1 });
shiftSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Shift", shiftSchema);
