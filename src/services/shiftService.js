const Shift = require("../models/Shift");
const Family = require("../models/Family");
const ENV = require("../config/env");
const { generateToken, isTokenValid, isTokenMatch } = require("../utils/tokenUtils");
const { generateUniqueReference } = require("../utils/generateReference");
const { getEligibleNannies, isNannyEligibleForShift } = require("./shiftMatchingService");

const CONFIRMATION_WINDOW_MS = () => ENV.SHIFT_CONFIRMATION_WINDOW_MINUTES * 60 * 1000;

// ─── Socket emit helpers ──────────────────────────────────────────────────────
// Transport plumbing (rooms/auth) lives in src/socket.js; these just decide
// *what* to emit, from the one place each state transition happens.

function emitShiftCreated(io, shift, eligibleNannies) {
  if (!io) return;
  const payload = {
    shiftId: shift._id,
    shiftReference: shift.shiftReference,
    type: shift.type,
    urgency: shift.urgency,
    schedule: shift.schedule,
    location: shift.location,
    children: shift.children.map((c) => ({ age: c.age })),
    duties: shift.duties,
    rate: shift.rate,
    specialRequirements: shift.specialRequirements,
    createdAt: shift.createdAt,
  };
  eligibleNannies.forEach((nanny) => {
    io.to(`nanny:${nanny._id}`).emit("shift:created", payload);
  });
}

function emitShiftAccepted(io, shift, nanny, confirmationToken) {
  if (!io) return;
  io.to("nannies:vetted").emit("shift:accepted", {
    shiftId: shift._id,
    shiftReference: shift.shiftReference,
    status: shift.status,
  });
  io.to(`shift:${shift._id}`).emit("shift:accepted", {
    shiftId: shift._id,
    shiftReference: shift.shiftReference,
    status: shift.status,
    nanny: {
      id: nanny._id,
      firstName: nanny.personalDetails.firstName,
      lastNameInitial: (nanny.personalDetails.lastName || "").charAt(0),
      yearsExperience: nanny.experience?.professionalChildcareExperienceYears,
      dbsStatus: nanny.qualifications?.enhancedDBS,
    },
    confirmationExpiresAt: shift.confirmationExpiresAt,
    confirmationToken,
  });
}

function emitShiftConfirmed(io, shift) {
  if (!io) return;
  const payload = { shiftId: shift._id, shiftReference: shift.shiftReference, status: shift.status, confirmedAt: shift.confirmedAt };
  io.to("nannies:vetted").emit("shift:confirmed", payload);
  if (shift.assignedNanny) io.to(`nanny:${shift.assignedNanny}`).emit("shift:confirmed", payload);
  io.to(`shift:${shift._id}`).emit("shift:confirmed", payload);
}

function emitShiftAcceptExpired(io, nannyId, shift) {
  if (!io) return;
  io.to(`nanny:${nannyId}`).emit("shift:accept-expired", {
    shiftId: shift._id,
    shiftReference: shift.shiftReference,
    message: "Your acceptance window expired before the booking was confirmed.",
  });
}

function emitShiftExpired(io, shift) {
  if (!io) return;
  const payload = { shiftId: shift._id, shiftReference: shift.shiftReference, status: "Expired" };
  io.to("nannies:vetted").emit("shift:expired", payload);
  io.to(`shift:${shift._id}`).emit("shift:expired", payload);
}

function emitShiftCancelled(io, shift) {
  if (!io) return;
  const payload = { shiftId: shift._id, shiftReference: shift.shiftReference, status: "Cancelled", reason: shift.cancellation?.reason };
  io.to("nannies:vetted").emit("shift:cancelled", payload);
  if (shift.assignedNanny) io.to(`nanny:${shift.assignedNanny}`).emit("shift:cancelled", payload);
  io.to(`shift:${shift._id}`).emit("shift:cancelled", payload);
}

// ─── Family upsert ────────────────────────────────────────────────────────────

/**
 * Find a Family by email, or create one. No parent login exists — this is
 * an anonymous upsert exactly like the existing enquiry flow has no account.
 */
async function findOrCreateFamily({ firstName, lastName, email, phone, postcode, area }) {
  const normalisedEmail = String(email).toLowerCase().trim();
  const existing = await Family.findOne({ email: normalisedEmail });
  if (existing) return existing;

  try {
    const familyReference = await generateUniqueReference(Family, "familyReference", "FAM");
    return await Family.create({ familyReference, firstName, lastName, email: normalisedEmail, phone, postcode, area });
  } catch (err) {
    if (err.code === 11000) {
      const family = await Family.findOne({ email: normalisedEmail });
      if (family) return family;
    }
    throw err;
  }
}

// ─── Shift lifecycle ──────────────────────────────────────────────────────────

/**
 * Create a new emergency shift from a public parent submission.
 * Returns the plaintext trackingToken once — it is never recoverable again.
 */
async function createShiftFromBooking(body) {
  const family = await findOrCreateFamily(body.family);

  const shiftReference = await generateUniqueReference(Shift, "shiftReference", "SHF");
  const { token: trackingToken, tokenHash: parentTrackingTokenHash } = generateToken();

  const shift = await Shift.create({
    shiftReference,
    type: "emergency",
    status: "Open",
    urgency: body.urgency,
    schedule: body.schedule,
    location: body.location,
    children: body.children,
    duties: body.duties || [],
    rate: body.rate,
    specialRequirements: body.specialRequirements,
    family: family._id,
    parentTrackingTokenHash,
  });

  return { shift, trackingToken };
}

/**
 * Broadcast a newly created (or reopened) shift to every currently-eligible
 * nanny. Separated from createShiftFromBooking so the reopen path (sweep job)
 * can reuse it without re-running family/shift creation.
 */
async function broadcastShiftToEligibleNannies(io, shift) {
  const eligible = await getEligibleNannies(shift);
  emitShiftCreated(io, shift, eligible);
  return eligible;
}

/**
 * The concurrency-safe accept. Only the first of two simultaneous calls can
 * match the { status: "Open" } filter — Mongo guarantees document-level
 * atomicity, so no transaction is needed.
 */
async function acceptShift(shiftId, nanny, io) {
  const shift = await Shift.findById(shiftId);
  if (!shift) return { error: "NOT_FOUND" };
  if (shift.status !== "Open") return { error: "ALREADY_TAKEN" };
  if (!isNannyEligibleForShift(nanny, shift)) return { error: "NOT_ELIGIBLE" };

  const { token: confirmationToken } = generateToken();

  const updated = await Shift.findOneAndUpdate(
    { _id: shiftId, status: "Open" },
    {
      $set: {
        status: "Pending Confirmation",
        assignedNanny: nanny._id,
        acceptedAt: new Date(),
        confirmationToken,
        confirmationExpiresAt: new Date(Date.now() + CONFIRMATION_WINDOW_MS()),
      },
      $inc: { acceptCycleCount: 1 },
    },
    { returnDocument: "after" }
  );

  if (!updated) return { error: "ALREADY_TAKEN" };

  emitShiftAccepted(io, updated, nanny, confirmationToken);
  return { shift: updated, confirmationToken };
}

/**
 * A nanny withdraws their own (not-yet-confirmed) acceptance. Reopens the
 * shift immediately and excludes the withdrawing nanny from re-offer.
 */
async function withdrawShift(shiftId, nanny, io) {
  const updated = await Shift.findOneAndUpdate(
    { _id: shiftId, status: "Pending Confirmation", assignedNanny: nanny._id },
    {
      $set: { status: "Open", assignedNanny: null, confirmationToken: undefined, confirmationExpiresAt: null },
      $push: { excludedNannyIds: nanny._id },
    },
    { returnDocument: "after" }
  );
  if (!updated) return { error: "NOT_WITHDRAWABLE" };

  await broadcastShiftToEligibleNannies(io, updated);
  return { shift: updated };
}

/**
 * Parent confirms via the token delivered live over the socket (or fetched
 * as a fallback via trackShift).
 */
async function confirmShift(shiftReference, confirmationToken, io) {
  const shift = await Shift.findOne({ shiftReference, status: "Pending Confirmation" }).select("+confirmationToken");
  if (!shift) return { error: "NOT_FOUND" };
  if (shift.confirmationExpiresAt && shift.confirmationExpiresAt < new Date()) return { error: "EXPIRED" };
  if (!isTokenMatch(confirmationToken, shift.confirmationToken)) return { error: "INVALID_TOKEN" };

  const updated = await Shift.findOneAndUpdate(
    { _id: shift._id, status: "Pending Confirmation" },
    { $set: { status: "Confirmed", confirmedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!updated) return { error: "NOT_FOUND" };

  emitShiftConfirmed(io, updated);
  return { shift: updated };
}

/**
 * Parent cancels via their tracking token. Admin cancellation reuses this
 * same function with actor "Admin" and no token check (see shiftController).
 */
async function cancelShift(shift, { cancelledBy, reason }, io) {
  const updated = await Shift.findOneAndUpdate(
    { _id: shift._id, status: { $in: ["Open", "Pending Confirmation"] } },
    { $set: { status: "Cancelled", cancellation: { cancelledBy, reason, cancelledAt: new Date() } } },
    { returnDocument: "after" }
  );
  if (!updated) return { error: "NOT_CANCELLABLE" };

  emitShiftCancelled(io, updated);
  return { shift: updated };
}

async function completeShift(shiftId) {
  const updated = await Shift.findOneAndUpdate(
    { _id: shiftId, status: "Confirmed" },
    { $set: { status: "Completed" } },
    { returnDocument: "after" }
  );
  if (!updated) return { error: "NOT_COMPLETABLE" };
  return { shift: updated };
}

/**
 * Parent-facing status check, keyed by trackingToken. While Pending
 * Confirmation, also returns the confirmationToken as a fallback path if
 * the live socket push was missed.
 */
async function trackShift(shiftReference, trackingToken) {
  const shift = await Shift.findOne({ shiftReference }).select("+parentTrackingTokenHash +confirmationToken");
  if (!shift || !isTokenValid(trackingToken, shift.parentTrackingTokenHash)) {
    return { error: "NOT_FOUND" };
  }

  const result = {
    shiftReference: shift.shiftReference,
    status: shift.status,
    schedule: shift.schedule,
    location: shift.location,
  };
  if (shift.status === "Pending Confirmation") {
    result.confirmationExpiresAt = shift.confirmationExpiresAt;
    // Fallback delivery path if the live socket push was missed.
    result.confirmationToken = shift.confirmationToken;
  }
  return { shift: result };
}

/**
 * Sweep every Pending Confirmation shift whose window has lapsed.
 * Reopens (excluding the timed-out nanny) up to SHIFT_MAX_ACCEPT_CYCLES,
 * then terminates as Expired. Called on an interval from
 * src/jobs/shiftExpirySweep.js — every transition reuses the same atomic
 * conditional-update pattern as acceptShift, so concurrent sweep ticks
 * (e.g. under naive multi-instance scaling) can never double-process
 * the same shift.
 */
async function sweepExpiredConfirmations(io) {
  const expired = await Shift.find({
    status: "Pending Confirmation",
    confirmationExpiresAt: { $lt: new Date() },
  });

  for (const shift of expired) {
    const timedOutNannyId = shift.assignedNanny;

    if (shift.acceptCycleCount < ENV.SHIFT_MAX_ACCEPT_CYCLES) {
      const reopened = await Shift.findOneAndUpdate(
        { _id: shift._id, status: "Pending Confirmation" },
        {
          $set: { status: "Open", assignedNanny: null, confirmationToken: undefined, confirmationExpiresAt: null },
          $push: { excludedNannyIds: timedOutNannyId },
        },
        { returnDocument: "after" }
      );
      if (!reopened) continue; // already handled by another tick/instance

      if (timedOutNannyId) emitShiftAcceptExpired(io, timedOutNannyId, reopened);
      await broadcastShiftToEligibleNannies(io, reopened);
    } else {
      const finalised = await Shift.findOneAndUpdate(
        { _id: shift._id, status: "Pending Confirmation" },
        { $set: { status: "Expired", assignedNanny: null } },
        { returnDocument: "after" }
      );
      if (!finalised) continue;

      if (timedOutNannyId) emitShiftAcceptExpired(io, timedOutNannyId, finalised);
      emitShiftExpired(io, finalised);
    }
  }
}

module.exports = {
  createShiftFromBooking,
  broadcastShiftToEligibleNannies,
  acceptShift,
  withdrawShift,
  confirmShift,
  cancelShift,
  completeShift,
  trackShift,
  sweepExpiredConfirmations,
};
