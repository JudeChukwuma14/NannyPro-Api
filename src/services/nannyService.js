const Nanny = require("../models/Nanny");
const ENV = require("../config/env");
const { generateToken } = require("../utils/tokenUtils");

/**
 * Pure field-copy from an approved Application document to the Nanny shape.
 * `availability.*` is deliberately left at schema defaults — a freshly
 * promoted nanny opts into shift types herself after logging in.
 *
 * @param {Object} application - An Application mongoose document (or lean object)
 * @returns {Object} Fields ready to pass to Nanny.create(...)
 */
function mapApplicationToNanny(application) {
  return {
    email: application.personalDetails.email,
    personalDetails: {
      firstName: application.personalDetails.firstName,
      lastName: application.personalDetails.lastName,
      dateOfBirth: application.personalDetails.dateOfBirth,
      phone: application.personalDetails.phone,
      address1: application.personalDetails.address1,
      address2: application.personalDetails.address2,
      city: application.personalDetails.city,
      postcode: application.personalDetails.postcode,
      area: application.personalDetails.area,
    },
    experience: {
      professionalChildcareExperienceYears: application.experience?.professionalChildcareExperienceYears,
      ageGroupExperience: {
        newborns: application.experience?.ageGroupExperience?.newborns || 0,
        toddlers: application.experience?.ageGroupExperience?.toddlers || 0,
        preschool: application.experience?.ageGroupExperience?.preschool || 0,
        schoolAge: application.experience?.ageGroupExperience?.schoolAge || 0,
        teenagers: application.experience?.ageGroupExperience?.teenagers || 0,
      },
    },
    qualifications: {
      enhancedDBS: application.qualifications?.enhancedDBS,
      paediatricFirstAid: application.qualifications?.paediatricFirstAid,
    },
    workPreferences: {
      areasWillingToWork: application.workPreferences?.areasWillingToWork,
      maximumTravelDistance: application.workPreferences?.maximumTravelDistance,
    },
    vettingStatus: "Vetted",
    accountStatus: "Active",
    applicationRef: application._id,
  };
}

/**
 * Idempotently promote an approved Application into a Nanny account.
 * - If a Nanny already exists for this applicationRef, returns it unchanged
 *   (does NOT re-flip vettingStatus — never silently undoes a suspension).
 * - Otherwise creates a new Nanny and a fresh set-password token.
 *
 * @param {Object} application
 * @returns {Promise<{ nanny: import('mongoose').Document, setPasswordToken: string|null, alreadyPromoted: boolean }>}
 */
async function createNannyFromApplication(application) {
  const existing = await Nanny.findOne({ applicationRef: application._id });
  if (existing) {
    return { nanny: existing, setPasswordToken: null, alreadyPromoted: true };
  }

  const { token: setPasswordToken, tokenHash } = generateToken();
  const setPasswordTokenExpiresAt = new Date(
    Date.now() + ENV.NANNY_SET_PASSWORD_TOKEN_TTL_HOURS * 60 * 60 * 1000
  );

  try {
    const nanny = await Nanny.create({
      ...mapApplicationToNanny(application),
      setPasswordTokenHash: tokenHash,
      setPasswordTokenExpiresAt,
    });
    return { nanny, setPasswordToken, alreadyPromoted: false };
  } catch (err) {
    // Duplicate email race — another request created the Nanny between our
    // existence check and the create() call. Recover gracefully rather than
    // failing the admin's status-update request.
    if (err.code === 11000) {
      const nanny = await Nanny.findOne({ applicationRef: application._id });
      if (nanny) return { nanny, setPasswordToken: null, alreadyPromoted: true };
    }
    throw err;
  }
}

module.exports = { mapApplicationToNanny, createNannyFromApplication };
