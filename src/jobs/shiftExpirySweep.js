const ENV = require("../config/env");
const { sweepExpiredConfirmations } = require("../services/shiftService");

/**
 * Starts a setInterval-driven sweep of Pending Confirmation shifts whose
 * confirmationExpiresAt has passed. No job-scheduler dependency is added —
 * a plain interval is simple, correct for a single-instance deployment, and
 * safe even under naive multi-instance scaling because every transition
 * inside sweepExpiredConfirmations uses an atomic conditional update.
 *
 * @param {import('socket.io').Server} io
 * @returns {NodeJS.Timeout} the interval handle (unref'd so it never blocks
 *   process exit — mirrors the "never let background work keep the process
 *   alive unexpectedly" default used for SIGTERM handling in app.js)
 */
function startShiftExpirySweep(io) {
  const interval = setInterval(() => {
    sweepExpiredConfirmations(io).catch((err) => {
      console.error("[ShiftExpirySweep] sweep failed:", err);
    });
  }, ENV.SHIFT_EXPIRY_SWEEP_INTERVAL_MS);

  interval.unref();
  return interval;
}

module.exports = { startShiftExpirySweep };
