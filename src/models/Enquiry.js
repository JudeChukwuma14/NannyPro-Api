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

    // ── STEP 1: Service & Schedule ───────────────────────────────────────────
    serviceType: { type: String, trim: true, required: true },
    frequency: { type: String, enum: ["ongoing", "temporary", "one-off"], required: true },
    isUrgent: { type: Boolean, default: false },
    preferredStartDate: { type: String, required: true },

    // (Part of Step 1)
    schedule: {
      daysNeeded: [{ type: String }],
      hoursPerWeek: { type: String, trim: true },
      scheduleNotes: { type: String, trim: true },
    },

    // ── STEP 2: Family & Children ────────────────────────────────────────────
    children: {
      type: [childSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one child is required",
      },
    },

    // ── STEP 3: Contact & Location ───────────────────────────────────────────
    location: {
      postcode: { type: String, trim: true, required: true },
      area: { type: String, trim: true, required: true },
      locationType: { type: String, trim: true, required: true },
      livingArrangement: { type: String, trim: true, required: true },
    },

    // (Part of Step 2)
    needs: {
      duties: [{ type: String }],
      experienceRequired: { type: String, trim: true },
      qualifications: [{ type: String }],
      specialRequirements: { type: String, trim: true },
    },

    // (Part of Step 3)
    parent: {
      firstName: { type: String, trim: true, required: true },
      lastName: { type: String, trim: true, required: true },
      email: { type: String, trim: true, lowercase: true, required: true },
      phone: { type: String, trim: true, required: true },
      contactMethod: { type: String, trim: true },
    },

    // ── STEP 4: Declaration ──────────────────────────────────────────────────
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
