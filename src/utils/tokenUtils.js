const crypto = require("crypto");

/**
 * Generate a random bearer token plus its SHA-256 hash.
 * Only the hash is ever persisted; the plaintext token is returned once
 * to the caller (e.g. embedded in a set-password link, or returned in a
 * shift-creation response) and can never be recovered from the database.
 *
 * @returns {{ token: string, tokenHash: string }}
 */
function generateToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

/**
 * @param {string} token
 * @returns {string}
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Constant-time-safe comparison of a plaintext token against a stored hash.
 * @param {string} token
 * @param {string} tokenHash
 * @returns {boolean}
 */
function isTokenValid(token, tokenHash) {
  if (!token || !tokenHash) return false;
  const candidateHash = Buffer.from(hashToken(token));
  const storedHash = Buffer.from(tokenHash);
  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(candidateHash, storedHash);
}

/**
 * Constant-time-safe comparison of two plaintext tokens (no hashing).
 * Used for the shift confirmationToken, which is deliberately stored in
 * recoverable form (still behind select:false) rather than one-way hashed,
 * because it must be returnable via the track() fallback endpoint if a
 * parent's live socket connection drops before they see the confirm prompt.
 * It is short-lived (matches confirmationExpiresAt, default 15 min) and
 * low-value compared to the tracking/set-password tokens, which stay
 * one-way hashed since they're longer-lived credentials.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isTokenMatch(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { generateToken, hashToken, isTokenValid, isTokenMatch };
