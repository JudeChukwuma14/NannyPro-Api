const { sendEmail } = require("./emailService");

/**
 * Automated transactional emails. Fire-and-forget, same pattern as
 * auditLogService.logAction — never blocks or fails the request they're
 * triggered from; a delivery failure (including SMTP not being configured
 * yet) is just logged, not thrown.
 */

function sendApplicationReceivedEmail(application) {
  const email = application.personalDetails?.email;
  if (!email) return;
  const firstName = application.personalDetails?.firstName || "there";

  sendEmail({
    to: email,
    subject: "Your application has been received | Marvza",
    body: `Hi ${firstName},\n\nThank you for applying to join Marvza as a nanny. Your application (reference ${application.applicationReference}) has been received and is now under review by our team.\n\nWe'll be in touch with next steps soon.\n\nBest,\nThe Marvza Team`,
  })
    .then((result) => {
      if (!result.sent) console.error("[Notification] application-received email failed:", result.error);
    })
    .catch((err) => console.error("[Notification] application-received email error:", err.message));
}

function sendEnquiryReceivedEmail(enquiry) {
  const email = enquiry.parent?.email;
  if (!email) return;
  const firstName = enquiry.parent?.firstName || "there";

  sendEmail({
    to: email,
    subject: "Your request has been received | Marvza",
    body: `Hi ${firstName},\n\nThank you for your childcare request (reference ${enquiry.enquiryReference}). It has been received and is now under review — our team is looking at your requirements and will be in touch shortly with suitable matches.\n\nBest,\nThe Marvza Team`,
  })
    .then((result) => {
      if (!result.sent) console.error("[Notification] enquiry-received email failed:", result.error);
    })
    .catch((err) => console.error("[Notification] enquiry-received email error:", err.message));
}

function sendNannyApprovedEmail(nanny, setPasswordUrl) {
  const email = nanny.email;
  if (!email) return;
  const firstName = nanny.personalDetails?.firstName || "there";

  sendEmail({
    to: email,
    subject: "You're approved to join Marvza | Marvza",
    body: `Hi ${firstName},\n\nGreat news — your application has been approved and your nanny account with Marvza is now active.\n\nSet your password to get started:\n${setPasswordUrl}\n\nBest,\nThe Marvza Team`,
  })
    .then((result) => {
      if (!result.sent) console.error("[Notification] nanny-approved email failed:", result.error);
    })
    .catch((err) => console.error("[Notification] nanny-approved email error:", err.message));
}

function sendShiftConfirmationRequestEmail(family, shift) {
  const email = family?.email;
  if (!email) return;
  const firstName = family.firstName || "there";
  const deadline = shift.confirmationExpiresAt ? new Date(shift.confirmationExpiresAt).toLocaleString("en-GB") : "shortly";

  sendEmail({
    to: email,
    subject: "A nanny has accepted your booking | Marvza",
    body: `Hi ${firstName},\n\nA nanny has accepted your booking (reference ${shift.shiftReference}) for ${shift.schedule?.date} at ${shift.schedule?.startTime}.\n\nPlease confirm using the prompt in your browser by ${deadline}, or the booking will be offered to another nanny.\n\nBest,\nThe Marvza Team`,
  })
    .then((result) => {
      if (!result.sent) console.error("[Notification] shift-confirmation-request email failed:", result.error);
    })
    .catch((err) => console.error("[Notification] shift-confirmation-request email error:", err.message));
}

function sendShiftAcceptExpiredEmail(nanny, shift) {
  const email = nanny?.email;
  if (!email) return;
  const firstName = nanny.personalDetails?.firstName || "there";

  sendEmail({
    to: email,
    subject: "Your acceptance window expired | Marvza",
    body: `Hi ${firstName},\n\nThe confirmation window for booking ${shift.shiftReference} has expired — the parent did not confirm in time, so this booking is no longer assigned to you.\n\nBest,\nThe Marvza Team`,
  })
    .then((result) => {
      if (!result.sent) console.error("[Notification] shift-accept-expired email failed:", result.error);
    })
    .catch((err) => console.error("[Notification] shift-accept-expired email error:", err.message));
}

function sendShiftExpiredNoConfirmationEmail(family, shift) {
  const email = family?.email;
  if (!email) return;
  const firstName = family.firstName || "there";

  sendEmail({
    to: email,
    subject: "No nanny confirmed your booking | Marvza",
    body: `Hi ${firstName},\n\nWe're sorry — no nanny was able to confirm your booking (reference ${shift.shiftReference}) in time. Please submit a new request and we'll do our best to find someone right away.\n\nBest,\nThe Marvza Team`,
  })
    .then((result) => {
      if (!result.sent) console.error("[Notification] shift-expired email failed:", result.error);
    })
    .catch((err) => console.error("[Notification] shift-expired email error:", err.message));
}

function sendShiftCancelledNannyEmail(nanny, shift) {
  const email = nanny?.email;
  if (!email) return;
  const firstName = nanny.personalDetails?.firstName || "there";
  const reasonLine = shift.cancellation?.reason ? `\n\nReason given: ${shift.cancellation.reason}` : "";

  sendEmail({
    to: email,
    subject: "Booking cancelled | Marvza",
    body: `Hi ${firstName},\n\nBooking ${shift.shiftReference} has been cancelled and is no longer taking place.${reasonLine}\n\nBest,\nThe Marvza Team`,
  })
    .then((result) => {
      if (!result.sent) console.error("[Notification] shift-cancelled email failed:", result.error);
    })
    .catch((err) => console.error("[Notification] shift-cancelled email error:", err.message));
}

module.exports = {
  sendApplicationReceivedEmail,
  sendEnquiryReceivedEmail,
  sendNannyApprovedEmail,
  sendShiftConfirmationRequestEmail,
  sendShiftAcceptExpiredEmail,
  sendShiftExpiredNoConfirmationEmail,
  sendShiftCancelledNannyEmail,
};
