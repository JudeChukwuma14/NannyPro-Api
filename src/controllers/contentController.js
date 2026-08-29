const Faq = require("../models/Faq");
const Testimonial = require("../models/Testimonial");
const { successResponse, errorResponse } = require("../utils/apiResponse");

// ─── GET /api/v1/content/faqs ────────────────────────────────────────────────
// Public — published only, sorted by order
const getPublicFaqs = async (req, res, next) => {
  try {
    const { category } = req.query;
    const filter = { isPublished: true };
    if (category) filter.category = category;

    const faqs = await Faq.find(filter).sort({ order: 1, createdAt: 1 }).lean();
    return successResponse(res, faqs, "FAQs retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/content/testimonials ────────────────────────────────────────
// Public — published only, sorted by order
const getPublicTestimonials = async (req, res, next) => {
  try {
    const testimonials = await Testimonial.find({ isPublished: true }).sort({ order: 1, createdAt: 1 }).lean();
    return successResponse(res, testimonials, "Testimonials retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/content/faqs/all ────────────────────────────────────────────
// Admin — all rows, including unpublished
const getAllFaqs = async (req, res, next) => {
  try {
    const faqs = await Faq.find({}).sort({ category: 1, order: 1 }).lean();
    return successResponse(res, faqs, "FAQs retrieved successfully");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/content/testimonials/all ────────────────────────────────────
// Admin — all rows, including unpublished
const getAllTestimonials = async (req, res, next) => {
  try {
    const testimonials = await Testimonial.find({}).sort({ order: 1 }).lean();
    return successResponse(res, testimonials, "Testimonials retrieved successfully");
  } catch (err) {
    next(err);
  }
};

const VALID_CATEGORIES = ["general", "families", "nannies", "homepage"];

// ─── POST /api/v1/content/faqs ───────────────────────────────────────────────
const createFaq = async (req, res, next) => {
  try {
    const { question, answer, category, order, isPublished } = req.body;
    if (!question || !answer) return errorResponse(res, "Question and answer are required", 400);
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return errorResponse(res, `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`, 400);
    }
    const faq = await Faq.create({ question, answer, category, order, isPublished });
    return successResponse(res, faq, "FAQ created successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/content/faqs/:id ──────────────────────────────────────────
const updateFaq = async (req, res, next) => {
  try {
    const { question, answer, category, order, isPublished } = req.body;
    const faq = await Faq.findByIdAndUpdate(
      req.params.id,
      { question, answer, category, order, isPublished },
      { returnDocument: "after", runValidators: true }
    );
    if (!faq) return errorResponse(res, "FAQ not found", 404);
    return successResponse(res, faq, "FAQ updated successfully");
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/v1/content/faqs/:id ─────────────────────────────────────────
const deleteFaq = async (req, res, next) => {
  try {
    const faq = await Faq.findByIdAndDelete(req.params.id);
    if (!faq) return errorResponse(res, "FAQ not found", 404);
    return successResponse(res, null, "FAQ deleted successfully");
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/content/testimonials ───────────────────────────────────────
const createTestimonial = async (req, res, next) => {
  try {
    const { quote, name, location, service, rating, order, isPublished } = req.body;
    if (!quote || !name) return errorResponse(res, "Quote and name are required", 400);
    const testimonial = await Testimonial.create({ quote, name, location, service, rating, order, isPublished });
    return successResponse(res, testimonial, "Testimonial created successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/v1/content/testimonials/:id ──────────────────────────────────
const updateTestimonial = async (req, res, next) => {
  try {
    const { quote, name, location, service, rating, order, isPublished } = req.body;
    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { quote, name, location, service, rating, order, isPublished },
      { returnDocument: "after", runValidators: true }
    );
    if (!testimonial) return errorResponse(res, "Testimonial not found", 404);
    return successResponse(res, testimonial, "Testimonial updated successfully");
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/v1/content/testimonials/:id ─────────────────────────────────
const deleteTestimonial = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) return errorResponse(res, "Testimonial not found", 404);
    return successResponse(res, null, "Testimonial deleted successfully");
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPublicFaqs,
  getPublicTestimonials,
  getAllFaqs,
  getAllTestimonials,
  createFaq,
  updateFaq,
  deleteFaq,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
};
