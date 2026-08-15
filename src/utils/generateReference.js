const crypto = require("crypto");

/**
 * Generate a unique application reference.
 * Format: NAN-YYYY-XXXXX  (e.g. NAN-2026-00042)
 *
 * We use a cryptographically random 5-character hex suffix as a fallback
 * uniqueness guarantee. The Application model enforces a unique index on
 * applicationReference, so any collision will surface as a duplicate-key error
 * and can be retried.
 *
 * @returns {string}
 */
function generateReference() {
  const year = new Date().getFullYear();
  // 3 random bytes → 6 hex chars, take first 5 and uppercase
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
  return `NAN-${year}-${randomPart}`;
}

/**
 * Attempt to generate a reference that does not yet exist in the database.
 * Retries up to `maxAttempts` times before throwing.
 *
 * @param {import('mongoose').Model} Application - The Application model
 * @param {number} [maxAttempts=5]
 * @returns {Promise<string>}
 */
async function generateUniqueReference(Application, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const ref = generateReference();
    const existing = await Application.findOne({ applicationReference: ref }).lean();
    if (!existing) return ref;
  }
  throw new Error("Could not generate a unique application reference. Please try again.");
}

module.exports = { generateReference, generateUniqueReference };
