const Nanny = require("../models/Nanny");

/**
 * Extract a UK postcode's outward code (e.g. "SW1A 1AA" -> "SW1A").
 * Falls back to the first whitespace-delimited token for malformed input.
 */
function extractOutwardCode(postcode) {
  if (!postcode) return null;
  const cleaned = postcode.trim().toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/);
  return match ? match[1] : cleaned.split(/\s+/)[0];
}

/**
 * Bucket a child's age into the same age-group keys used by
 * experience.ageGroupExperience on both Application and Nanny.
 */
function mapAgeToBand(age) {
  if (age <= 1) return "newborns";
  if (age <= 3) return "toddlers";
  if (age <= 5) return "preschool";
  if (age <= 12) return "schoolAge";
  return "teenagers";
}

/**
 * v1 eligibility check — no geocoding. "Within service area" means matching
 * outward postcode codes, or the shift's area string appearing in the
 * nanny's free-text areasWillingToWork. maxTravelDistanceMiles is captured
 * per the spec but not enforced as a real radius yet (flagged limitation —
 * a clean follow-up would swap the area-match block for a postcodes.io
 * distance check without touching any caller of this function).
 *
 * @param {Object} nanny - Nanny document or lean object
 * @param {Object} shift - Shift document or lean object
 * @returns {boolean}
 */
function isNannyEligibleForShift(nanny, shift) {
  if (nanny.vettingStatus !== "Vetted" || nanny.accountStatus !== "Active") return false;
  if (!nanny.availability?.emergencyBookings) return false;

  const excluded = (shift.excludedNannyIds || []).some(
    (id) => id.toString() === nanny._id.toString()
  );
  if (excluded) return false;

  const today = new Date().toISOString().slice(0, 10);
  if (shift.schedule.date === today && !nanny.availability?.availableToday) return false;

  const isWeekend = [0, 6].includes(new Date(shift.schedule.date).getDay());
  if (isWeekend && !nanny.availability?.availableWeekends) return false;

  const startHr = parseInt(shift.schedule.startTime.split(":")[0], 10);
  const finishHr = parseInt(shift.schedule.finishTime.split(":")[0], 10);
  const isEvening = startHr >= 18 || finishHr >= 18 || finishHr < startHr;
  if (isEvening && !nanny.availability?.availableEvenings) return false;

  const nannyOutward = extractOutwardCode(nanny.personalDetails?.postcode);
  const shiftOutward = extractOutwardCode(shift.location?.postcode);
  const areaListed = (nanny.workPreferences?.areasWillingToWork || "")
    .toLowerCase()
    .includes((shift.location?.area || "").toLowerCase());
  if (nannyOutward !== shiftOutward && !areaListed) return false;

  const bands = [...new Set((shift.children || []).map((c) => mapAgeToBand(c.age)))];
  const hasExperience = bands.every(
    (band) => (nanny.experience?.ageGroupExperience?.[band] || 0) > 0
  );
  if (!hasExperience) return false;

  return true;
}

/**
 * Query all Vetted/Active/emergency-opted-in nannies and filter them down
 * to those eligible for this specific shift. Used both to decide who to
 * push shift:created to, and (with a single nanny) to re-validate inside
 * acceptShift so a stale client-side list can never bypass eligibility.
 *
 * @param {Object} shift
 * @returns {Promise<import('mongoose').Document[]>} eligible Nanny documents
 */
async function getEligibleNannies(shift) {
  const candidates = await Nanny.find({
    vettingStatus: "Vetted",
    accountStatus: "Active",
    "availability.emergencyBookings": true,
  }).select(
    "personalDetails.postcode workPreferences.areasWillingToWork availability experience.ageGroupExperience vettingStatus accountStatus"
  );

  return candidates.filter((nanny) => isNannyEligibleForShift(nanny, shift));
}

module.exports = {
  extractOutwardCode,
  mapAgeToBand,
  isNannyEligibleForShift,
  getEligibleNannies,
};
