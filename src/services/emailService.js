const nodemailer = require("nodemailer");
const ENV = require("../config/env");

/**
 * Send an email via SMTP. Returns a result object instead of throwing —
 * callers (communicationController) always log the outcome to Message,
 * so a config or delivery failure must come back as data, not an exception.
 *
 * @param {{ to: string, subject: string, body: string }} params
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
async function sendEmail({ to, subject, body }) {
  if (!ENV.GOOGLE_CLIENT_ID || !ENV.GOOGLE_CLIENT_SECRET || !ENV.GOOGLE_MAIL_HOST || !ENV.GOOGLE_REFRESH_TOKEN) {
    return { sent: false, error: "Email is not configured yet. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_MAIL_HOST and GOOGLE_REFRESH_TOKEN." };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: ENV.GOOGLE_MAIL_HOST,
        clientId: ENV.GOOGLE_CLIENT_ID,
        clientSecret: ENV.GOOGLE_CLIENT_SECRET,
        refreshToken: ENV.GOOGLE_REFRESH_TOKEN,
      },
    });

    await transporter.sendMail({
      from: ENV.GOOGLE_MAIL_HOST,
      to,
      subject,
      text: body,
    });

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}

module.exports = { sendEmail };
