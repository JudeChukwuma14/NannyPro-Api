const mongoose = require("mongoose");

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["ID", "DBS", "PAEDIATRIC_FIRST_AID", "CHILDCARE_QUALIFICATION", "RIGHT_TO_WORK", "OTHER"],
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

const referenceSchema = new mongoose.Schema(
  {
    employerName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    role: { type: String, trim: true },
    relationship: { type: String, trim: true },
    startDate: { type: String },
    endDate: { type: String },
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

    // ── Personal Details ─────────────────────────────────────────────────────
    personalDetails: {
      fullName: { type: String, trim: true, required: true },
      preferredName: { type: String, trim: true },
      dateOfBirth: { type: String },
      email: { type: String, trim: true, lowercase: true, required: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      postcode: { type: String, trim: true },
      nationality: { type: String, trim: true },
      languages: { type: String, trim: true },
    },

    // ── Childcare Experience ─────────────────────────────────────────────────
    experience: {
      yearsChildcareExp: { type: String },
      yearsNannyExp: { type: String },
      ageGroups: [{ type: String }],
      previousRoles: { type: String, trim: true },
      newbornExp: { type: String },
      toddlerExp: { type: String },
      schoolAgeExp: { type: String },
      multipleChildrenExp: { type: String },
      additionalNeedsExp: { type: String },
      additionalNeedsDetail: { type: String, trim: true },
      otherExp: { type: String, trim: true },
    },

    // ── Qualifications ───────────────────────────────────────────────────────
    qualifications: {
      childcareQualifications: { type: String, trim: true },
      otherQualifications: { type: String, trim: true },
      paediatricFirstAid: { type: String },
      otherFirstAid: { type: String, trim: true },
      otherCertificates: { type: String, trim: true },
    },

    // ── DBS ──────────────────────────────────────────────────────────────────
    dbs: {
      hasCurrentDBS: { type: String, enum: ["Yes", "No", ""] },
      dbsType: { type: String, trim: true },
      dbsDate: { type: String },
      dbsUpdateService: { type: String, enum: ["Yes", "No", ""] },
      // Certificate number is sensitive — stored but never returned in list endpoints
      dbsCertNumber: { type: String, trim: true },
      dbsAdditionalInfo: { type: String, trim: true },
    },

    // ── Right to Work ────────────────────────────────────────────────────────
    rightToWork: {
      rightToWork: { type: String, enum: ["Yes", "No", ""] },
      rightToWorkType: { type: String, trim: true },
      rightToWorkDetails: { type: String, trim: true },
    },

    // ── Availability ─────────────────────────────────────────────────────────
    availability: {
      startDate: { type: String },
      workType: { type: String, trim: true },
      liveInOut: { type: String, trim: true },
      hoursAvailable: { type: String, trim: true },
      weekendAvailability: { type: String, enum: ["Yes", "No", ""] },
      eveningAvailability: { type: String, enum: ["Yes", "No", ""] },
      preferredHours: { type: String, trim: true },
      areasWillingToWork: { type: String, trim: true },
      maxDistance: { type: String, trim: true },
      // Individual day booleans from frontend day_Monday, day_Tuesday, etc.
      daysAvailable: [{ type: String }],
    },

    // ── Skills ────────────────────────────────────────────────────────────────
    skills: {
      skillDriving: { type: Boolean, default: false },
      skillCar: { type: Boolean, default: false },
      skillNewborn: { type: Boolean, default: false },
      skillCooking: { type: Boolean, default: false },
      skillHomework: { type: Boolean, default: false },
      skillSwimming: { type: Boolean, default: false },
      skillLanguages: { type: Boolean, default: false },
      skillSEN: { type: Boolean, default: false },
      skillSleep: { type: Boolean, default: false },
      skillSchoolRuns: { type: Boolean, default: false },
      skillOther: { type: Boolean, default: false },
      otherSkillsDetail: { type: String, trim: true },
    },

    // ── About the Candidate ───────────────────────────────────────────────────
    about: {
      aboutYourself: { type: String, trim: true },
      whyNanny: { type: String, trim: true },
      enjoyAboutChildcare: { type: String, trim: true },
      familyType: { type: String, trim: true },
    },

    // ── Declaration ──────────────────────────────────────────────────────────
    declaration: {
      declarationAccurate: { type: Boolean },
      consentReview: { type: Boolean },
      consentReferences: { type: Boolean },
      agreePrivacy: { type: Boolean },
      agreeTerms: { type: Boolean },
      declarationName: { type: String, trim: true },
      declarationDate: { type: String },
    },

    // ── References (embedded) ─────────────────────────────────────────────────
    references: [referenceSchema],

    // ── Documents (metadata only — binary stored in Cloudinary) ───────────────
    documents: [documentSchema],

    // ── Admin-only internal notes ─────────────────────────────────────────────
    notes: [noteSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes for admin search/filter
applicationSchema.index({ "personalDetails.email": 1 });
applicationSchema.index({ "personalDetails.fullName": "text" });
applicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Application", applicationSchema);
