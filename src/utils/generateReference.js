const crypto = require("crypto");

/**
 * Generate a unique reference string.
 * Format: PREFIX-YYYY-XXXXX  (e.g. NAN-2026-00042, SHF-2026-A1B2C, FAM-2026-9F3D1)
 *
 * We use a cryptographically random 5-character hex suffix as a fallback
 * uniqueness guarantee. Callers enforce a unique index on the target field,
 * so any collision surfaces as a duplicate-key error and can be retried.
 *
 * @param {string} [prefix="NAN"]
 * @returns {string}
 */
function generateReference(prefix = "NAN") {
  const year = new Date().getFullYear();
  // 3 random bytes → 6 hex chars, take first 5 and uppercase
  const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
  return `${prefix}-${year}-${randomPart}`;
}

/**
 * Attempt to generate a reference that does not yet exist in the database.
 * Retries up to `maxAttempts` times before throwing.
 *
 * @param {import('mongoose').Model} Model - The model to check uniqueness against
 * @param {string} [fieldName="applicationReference"] - The unique field to check/set
 * @param {string} [prefix="NAN"]
 * @param {number} [maxAttempts=5]
 * @returns {Promise<string>}
 */
async function generateUniqueReference(Model, fieldName = "applicationReference", prefix = "NAN", maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const ref = generateReference(prefix);
    const existing = await Model.findOne({ [fieldName]: ref }).lean();
    if (!existing) return ref;
  }
  throw new Error(`Could not generate a unique ${fieldName}. Please try again.`);
}

module.exports = { generateReference, generateUniqueReference };
