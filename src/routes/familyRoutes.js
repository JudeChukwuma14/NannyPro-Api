const express = require("express");
const router = express.Router();

const { getAllFamilies, getFamilyById, addNote, getNotes } = require("../controllers/familyController");
const { protect } = require("../middleware/authMiddleware");

// No public routes — Family records are created anonymously via
// shiftService.findOrCreateFamily() when a parent submits a shift request.

// GET /api/v1/families
router.get("/", protect, getAllFamilies);

// GET /api/v1/families/:id
router.get("/:id", protect, getFamilyById);

// POST /api/v1/families/:id/notes
router.post("/:id/notes", protect, addNote);

// GET /api/v1/families/:id/notes
router.get("/:id/notes", protect, getNotes);

module.exports = router;
