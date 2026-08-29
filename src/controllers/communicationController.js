const Message = require("../models/Message");
const { sendEmail } = require("../services/emailService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

// ─── POST /api/v1/communications/send ─────────────────────────────────────────
// Sends one ad-hoc email and always logs the attempt, regardless of outcome.
const sendMessage = async (req, res, next) => {
  try {
    const { toEmail, toName, subject, body, relatedToType, relatedToId } = req.body;
    if (!toEmail || !subject || !body) {
      return errorResponse(res, "Recipient email, subject and body are required", 400);
    }

    const result = await sendEmail({ to: toEmail, subject, body });

    const message = await Message.create({
      to: { email: toEmail, name: toName },
      subject,
      body,
      relatedTo: relatedToType && relatedToId ? { type: relatedToType, id: relatedToId } : undefined,
      sentBy: req.user._id,
      status: result.sent ? "sent" : "failed",
      errorMessage: result.sent ? undefined : result.error,
    });

    if (!result.sent) {
      return successResponse(res, message, `Email was not sent: ${result.error}`, 200);
    }
    return successResponse(res, message, "Email sent successfully", 201);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/v1/communications ────────────────────────────────────────────────
const getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (status) filter.status = status;

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .populate("sentBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Message.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    return successResponse(res, messages, "Messages retrieved successfully", 200, {
      pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPrevPage: pageNum > 1 },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendMessage, getMessages };
