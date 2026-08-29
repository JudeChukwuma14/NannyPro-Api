const mongoose = require("mongoose");

// Same shape as Application.js's noteSchema — admin-only internal notes.
const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

const familySchema = new mongoose.Schema(
  {
    familyReference: {
      type: String,
      unique: true,
      index: true,
    },

    firstName: { type: String, trim: true, required: true },
    lastName: { type: String, trim: true, required: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email"],
    },
    phone: { type: String, trim: true, required: true },
    postcode: { type: String, trim: true },
    area: { type: String, trim: true },

    notes: [noteSchema],
  },
  {
    timestamps: true,
  }
);

familySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Family", familySchema);
