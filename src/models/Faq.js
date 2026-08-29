const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    // "homepage" is the curated 4-item preview shown on the homepage — distinct
    // content from the three real FAQ-page categories, not a duplicate/subset.
    category: { type: String, enum: ["general", "families", "nannies", "homepage"], required: true, index: true },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

faqSchema.index({ category: 1, order: 1 });

module.exports = mongoose.model("Faq", faqSchema);
