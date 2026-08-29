const express = require("express");
const router = express.Router();

const { sendMessage, getMessages } = require("../controllers/communicationController");
const { protect } = require("../middleware/authMiddleware");

router.post("/send", protect, sendMessage);
router.get("/", protect, getMessages);

module.exports = router;
