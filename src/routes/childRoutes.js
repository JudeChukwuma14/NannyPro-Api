const express = require("express");
const router = express.Router();

const { getAllChildren, getChildById, createChild, updateChild, deleteChild } = require("../controllers/childController");
const { protect } = require("../middleware/authMiddleware");

// All admin-only — children are managed by staff, not submitted publicly.
router.get("/", protect, getAllChildren);
router.get("/:id", protect, getChildById);
router.post("/", protect, createChild);
router.patch("/:id", protect, updateChild);
router.delete("/:id", protect, deleteChild);

module.exports = router;
