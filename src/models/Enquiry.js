const mongoose = require("mongoose");

// Same shape as Application.js's noteSchema — admin-only internal notes.
const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

const childSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    age: { type: Number, required: true, min: 0, max: 17 },
    gender: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const enquirySchema = new mongoose.Schema(
  {
    enquiryReference: {
      type: String,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["New", "Under Review", "Matching", "Introduced", "Placed", "Closed"],
      default: "New",
      index: true,
    },

    // ── STEP 1: Service Requirements ─────────────────────────────────────────
    serviceType: { type: String, trim: true, required: true },
    frequency: { type: String, enum: ["ongoing", "temporary", "one-off"], required: true },
    isUrgent: { type: Boolean, default: false },
    preferredStartDate: { type: String, required: true },

    // ── STEP 2: Schedule ──────────────────────────────────────────────────────
    schedule: {
      daysNeeded: [{ type: String }],
      hoursPerWeek: { type: String, trim: true },
      scheduleNotes: { type: String, trim: true },
    },

    // ── STEP 3: Children ──────────────────────────────────────────────────────
    children: {
      type: [childSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one child is required",
      },
    },

    // ── STEP 4: Location & Travel ─────────────────────────────────────────────
    location: {
      postcode: { type: String, trim: true, required: true },
      area: { type: String, trim: true, required: true },
      locationType: { type: String, trim: true, required: true },
      livingArrangement: { type: String, trim: true, required: true },
    },

    // ── STEP 5: Family Needs & Duties ─────────────────────────────────────────
    needs: {
      duties: [{ type: String }],
      experienceRequired: { type: String, trim: true },
      qualifications: [{ type: String }],
      specialRequirements: { type: String, trim: true },
    },

    // ── STEP 6: Parent Details ────────────────────────────────────────────────
    parent: {
      firstName: { type: String, trim: true, required: true },
      lastName: { type: String, trim: true, required: true },
      email: { type: String, trim: true, lowercase: true, required: true },
      phone: { type: String, trim: true, required: true },
      contactMethod: { type: String, trim: true },
    },

    // ── STEP 7: Declaration ───────────────────────────────────────────────────
    agreeToContact: { type: Boolean, default: false },

    // ── Admin-only internal notes ─────────────────────────────────────────────
    notes: [noteSchema],
  },
  {
    timestamps: true,
  }
);

enquirySchema.index({ "parent.email": 1 });
enquirySchema.index({ "parent.firstName": "text", "parent.lastName": "text" });
enquirySchema.index({ createdAt: -1 });
enquirySchema.index({ "location.area": 1 });

module.exports = mongoose.model("Enquiry", enquirySchema);
