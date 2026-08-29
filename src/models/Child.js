const mongoose = require("mongoose");

// Same shape as Application.js's noteSchema — admin-only internal notes.
const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

/**
 * A family's actual child, entered once and reused across bookings.
 *
 * This is deliberately separate from Enquiry.children[] and Shift.children[],
 * which are point-in-time snapshots of what was requested for one specific
 * booking — those are never migrated into or synced with this model.
 */
const childSchema = new mongoose.Schema(
  {
    family: { type: mongoose.Schema.Types.ObjectId, ref: "Family", required: true, index: true },
    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true },
    age: { type: Number, min: 0, max: 17 },
    gender: { type: String, trim: true },
    allergiesOrNotes: { type: String, trim: true },
    notes: [noteSchema],
  },
  {
    timestamps: true,
  }
);

childSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Child", childSchema);
