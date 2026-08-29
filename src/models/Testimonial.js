const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    quote: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    service: { type: String, trim: true },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

testimonialSchema.index({ order: 1 });

module.exports = mongoose.model("Testimonial", testimonialSchema);
