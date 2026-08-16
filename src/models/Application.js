const mongoose = require("mongoose");

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["CV", "ID", "DBS", "PAEDIATRIC_FIRST_AID", "CHILDCARE_QUALIFICATION", "RIGHT_TO_WORK", "OTHER"],
      required: true,
    },
    originalName: { type: String, required: true },
    publicId: { type: String, required: true },
    // secureUrl is NOT included here intentionally — it is generated on-demand
    // by the backend using the publicId, so it is never persisted or returned publicly
    resourceType: { type: String, default: "raw" },
    format: { type: String },
    bytes: { type: Number },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

// ─── Main Application Schema ───────────────────────────────────────────────────

const applicationSchema = new mongoose.Schema(
  {
    applicationReference: {
      type: String,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "New",
        "Under Review",
        "Documents Pending",
        "References",
        "Interview",
        "Vetting",
        "Approved",
        "Not Approved",
      ],
      default: "New",
      index: true,
    },

    // ── STEP 1: Personal Details ─────────────────────────────────────────────
    personalDetails: {
      firstName: { type: String, trim: true, required: true },
      lastName: { type: String, trim: true, required: true },
      dateOfBirth: { type: String, required: true },
      email: { type: String, trim: true, lowercase: true, required: true },
      phone: { type: String, trim: true, required: true },
      address1: { type: String, trim: true, required: true },
      address2: { type: String, trim: true },
      city: { type: String, trim: true, required: true },
      postcode: { type: String, trim: true, required: true },
      area: { type: String, trim: true, required: true },
    },

    // ── STEP 2: Work Preferences ─────────────────────────────────────────────
    workPreferences: {
      workTypes: [{ type: String, enum: ["permanent", "backupCare", "holidayWork", "all"] }],
      employmentType: { type: String, trim: true }, // Full-time / Part-time
      workingArrangement: { type: String, trim: true }, // Live-in / Live-out
      preferredWorkingHours: { type: String, trim: true },
      areasWillingToWork: { type: String, trim: true },
      maximumTravelDistance: { type: String, trim: true },
      startDate: { type: String },
    },

    // ── STEP 3: Childcare Experience ──────────────────────────────────────────
    experience: {
      professionalChildcareExperienceYears: { type: Number },
      ageGroupExperience: {
        newborns: { type: Number, default: 0 },
        toddlers: { type: Number, default: 0 },
        preschool: { type: Number, default: 0 },
        schoolAge: { type: Number, default: 0 },
        teenagers: { type: Number, default: 0 },
      },
      previousChildcareExperience: { type: String, trim: true },
      multipleChildrenExperience: { type: String, trim: true },
      additionalNeedsExperience: { type: String, trim: true },
    },

    // ── STEP 4: Skills ────────────────────────────────────────────────────────
    skills: {
      skills: [{ type: String }], // Array of skills from checkboxes
      languages: { type: String, trim: true },
      otherSkillsInterests: { type: String, trim: true },
      drivingLicence: { type: Boolean, default: false },
      carAccess: { type: Boolean, default: false },
    },

    // ── STEP 5: Qualifications ───────────────────────────────────────────────
    qualifications: {
      enhancedDBS: { type: String, enum: ["Yes", "No", "In progress", ""] },
      paediatricFirstAid: { type: String, enum: ["Yes", "No", ""] },
      childcareQualifications: { type: String, trim: true },
      otherQualifications: { type: String, trim: true },
    },

    // ── STEP 6: Additional Information & Documents ──────────────────────────
    additionalInfo: {
      swimming: { type: String, enum: ["Yes", "No", ""] },
      animalAllergy: { type: String, enum: ["Yes", "No", ""] },
    },
    // Documents (metadata only — binary stored in Cloudinary)
    documents: [documentSchema],

    // ── STEP 7: Declaration ──────────────────────────────────────────────────
    declaration: {
      informationAccurate: { type: Boolean, default: false },
      applicationReviewConsent: { type: Boolean, default: false },
      referenceConsent: { type: Boolean, default: false },
      privacyPolicyConsent: { type: Boolean, default: false },
      termsConsent: { type: Boolean, default: false },
    },

    // ── Admin-only internal notes ─────────────────────────────────────────────
    notes: [noteSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes for admin search/filter
applicationSchema.index({ "personalDetails.email": 1 });
applicationSchema.index({ "personalDetails.firstName": "text", "personalDetails.lastName": "text" });
applicationSchema.index({ createdAt: -1 });
applicationSchema.index({ "personalDetails.area": 1 });

module.exports = mongoose.model("Application", applicationSchema);
