const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const nannySchema = new mongoose.Schema(
  {
    // Top-level (not nested under personalDetails) so MongoDB's duplicate-key
    // error reports `field === "email"`, which errorMiddleware.js already
    // handles — no new branch needed there.
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email"],
    },

    passwordHash: { type: String, select: false },
    passwordSet: { type: Boolean, default: false },
    setPasswordTokenHash: { type: String, select: false },
    setPasswordTokenExpiresAt: { type: Date, select: false },

    personalDetails: {
      firstName: { type: String, trim: true, required: true },
      lastName: { type: String, trim: true, required: true },
      dateOfBirth: { type: String },
      phone: { type: String, trim: true, required: true },
      address1: { type: String, trim: true },
      address2: { type: String, trim: true },
      city: { type: String, trim: true },
      postcode: { type: String, trim: true, required: true },
      area: { type: String, trim: true },
    },

    experience: {
      professionalChildcareExperienceYears: { type: Number },
      ageGroupExperience: {
        newborns: { type: Number, default: 0 },
        toddlers: { type: Number, default: 0 },
        preschool: { type: Number, default: 0 },
        schoolAge: { type: Number, default: 0 },
        teenagers: { type: Number, default: 0 },
      },
    },

    qualifications: {
      enhancedDBS: { type: String, enum: ["Yes", "No", "In progress", ""] },
      paediatricFirstAid: { type: String, enum: ["Yes", "No", ""] },
    },

    workPreferences: {
      areasWillingToWork: { type: String, trim: true },
      maximumTravelDistance: { type: String, trim: true },
    },

    // Nanny opts into these herself after first login — not copied from Application.
    availability: {
      availableToday: { type: Boolean, default: false },
      emergencyBookings: { type: Boolean, default: false },
      maxTravelDistanceMiles: { type: Number, default: null },
      availableEvenings: { type: Boolean, default: false },
      availableWeekends: { type: Boolean, default: false },
    },

    vettingStatus: {
      type: String,
      enum: ["Pending", "Vetted", "Suspended", "Revoked"],
      default: "Pending",
      index: true,
    },
    accountStatus: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
      index: true,
    },

    applicationRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      unique: true,
      sparse: true,
    },

    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Instance method: compare a plain password against the stored hash
nannySchema.methods.comparePassword = async function (plainPassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Static helper: hash a password before saving — mirrors Admin.hashPassword
nannySchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
};

nannySchema.index({ vettingStatus: 1, accountStatus: 1 });
nannySchema.index({ "personalDetails.postcode": 1 });
nannySchema.index({ "personalDetails.firstName": "text", "personalDetails.lastName": "text" });
nannySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Nanny", nannySchema);
