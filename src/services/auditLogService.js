const AuditLog = require("../models/AuditLog");

/**
 * Log an admin action. Fire-and-forget — never blocks or fails the actual
 * operation it's logging; a logging failure is swallowed (and printed) so it
 * can never turn a successful status change into a failed request.
 *
 * @param {import('express').Request} req - must have req.user attached (protect middleware)
 * @param {{ action: string, targetType: string, targetId: any, summary?: string }} entry
 */
function logAction(req, { action, targetType, targetId, summary }) {
  if (!req.user) return;
  AuditLog.create({
    actor: { id: req.user._id, email: req.user.email, role: req.user.role },
    action,
    targetType,
    targetId,
    summary,
  }).catch((err) => {
    console.error("[AuditLog] Failed to record action:", action, err.message);
  });
}

module.exports = { logAction };
