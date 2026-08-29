const express = require("express");
const router = express.Router();

const {
  getPublicFaqs, getPublicTestimonials, getAllFaqs, getAllTestimonials,
  createFaq, updateFaq, deleteFaq, createTestimonial, updateTestimonial, deleteTestimonial,
} = require("../controllers/contentController");
const { protect } = require("../middleware/authMiddleware");

// ─── PUBLIC ──────────────────────────────────────────────────────────────────
router.get("/faqs", getPublicFaqs);
router.get("/testimonials", getPublicTestimonials);

// ─── ADMIN ───────────────────────────────────────────────────────────────────
router.get("/faqs/all", protect, getAllFaqs);
router.post("/faqs", protect, createFaq);
router.patch("/faqs/:id", protect, updateFaq);
router.delete("/faqs/:id", protect, deleteFaq);

router.get("/testimonials/all", protect, getAllTestimonials);
router.post("/testimonials", protect, createTestimonial);
router.patch("/testimonials/:id", protect, updateTestimonial);
router.delete("/testimonials/:id", protect, deleteTestimonial);

module.exports = router;
