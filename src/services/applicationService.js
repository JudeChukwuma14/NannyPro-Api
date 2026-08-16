const { uploadFile } = require("./cloudinaryService");

/**
 * Maps the frontend's flat form data object to the nested Application schema.
 *
 * @param {Object} formData - Raw flat data from the frontend
 * @returns {Object} Nested object ready to pass to new Application(...)
 */
const mapFormDataToSchema = (formData) => {
  // Handle skills array parsing if it comes as a stringified array from FormData
  let parsedSkills = [];
  try {
    if (formData.skills) {
      parsedSkills = typeof formData.skills === 'string' ? JSON.parse(formData.skills) : formData.skills;
    }
  } catch (e) {
    if (typeof formData.skills === 'string') {
      parsedSkills = formData.skills.split(',').map(s => s.trim());
    }
  }

  // Handle workTypes
  let parsedWorkTypes = [];
  try {
    if (formData.workTypes) {
      parsedWorkTypes = typeof formData.workTypes === 'string' ? JSON.parse(formData.workTypes) : formData.workTypes;
    }
  } catch (e) {
    if (typeof formData.workTypes === 'string') {
      parsedWorkTypes = formData.workTypes.split(',').map(s => s.trim());
    }
  }

  // Helper to parse numbers safely
  const parseNum = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  return {
    personalDetails: {
      firstName: formData.firstName,
      lastName: formData.lastName,
      dateOfBirth: formData.dateOfBirth,
      email: formData.email,
      phone: formData.phone,
      address1: formData.address1,
      address2: formData.address2,
      city: formData.city,
      postcode: formData.postcode,
      area: formData.area,
    },

    workPreferences: {
      workTypes: parsedWorkTypes,
      employmentType: formData.employmentType,
      workingArrangement: formData.workingArrangement,
      preferredWorkingHours: formData.preferredWorkingHours,
      areasWillingToWork: formData.areasWillingToWork,
      maximumTravelDistance: formData.maximumTravelDistance,
      startDate: formData.startDate,
    },

    experience: {
      professionalChildcareExperienceYears: parseNum(formData.professionalChildcareExperienceYears),
      ageGroupExperience: {
        newborns: parseNum(formData.newborns),
        toddlers: parseNum(formData.toddlers),
        preschool: parseNum(formData.preschool),
        schoolAge: parseNum(formData.schoolAge),
        teenagers: parseNum(formData.teenagers),
      },
      previousChildcareExperience: formData.previousChildcareExperience,
      multipleChildrenExperience: formData.multipleChildrenExperience,
      additionalNeedsExperience: formData.additionalNeedsExperience,
    },

    skills: {
      skills: Array.isArray(parsedSkills) ? parsedSkills : [],
      languages: formData.languages,
      otherSkillsInterests: formData.otherSkillsInterests,
      drivingLicence: formData.drivingLicence === true || formData.drivingLicence === "true",
      carAccess: formData.carAccess === true || formData.carAccess === "true",
    },

    qualifications: {
      enhancedDBS: formData.enhancedDBS,
      paediatricFirstAid: formData.paediatricFirstAid,
      childcareQualifications: formData.childcareQualifications,
      otherQualifications: formData.otherQualifications,
    },

    additionalInfo: {
      swimming: formData.swimming,
      animalAllergy: formData.animalAllergy,
    },

    declaration: {
      informationAccurate: formData.informationAccurate === true || formData.informationAccurate === "true",
      applicationReviewConsent: formData.applicationReviewConsent === true || formData.applicationReviewConsent === "true",
      referenceConsent: formData.referenceConsent === true || formData.referenceConsent === "true",
      privacyPolicyConsent: formData.privacyPolicyConsent === true || formData.privacyPolicyConsent === "true",
      termsConsent: formData.termsConsent === true || formData.termsConsent === "true",
    }
  };
};

/**
 * Field name → document type mapping.
 * Maps Multer field names to the Document type enum in the Application model.
 */
const FIELD_TO_DOC_TYPE = {
  cv: "CV",
  docId: "ID",
  docDBS: "DBS",
  dbsCertFiles: "DBS",
  docPFA: "PAEDIATRIC_FIRST_AID",
  docQual: "CHILDCARE_QUALIFICATION",
  docRTW: "RIGHT_TO_WORK",
  rtwFiles: "RIGHT_TO_WORK",
  docOther: "OTHER",
};

/**
 * Process uploaded files and upload them to Cloudinary.
 * Returns an array of document metadata objects ready to push into Application.documents.
 *
 * @param {Object} files - req.files from multer (keyed by field name)
 * @param {string} applicationReference - Used to organise files in Cloudinary
 * @returns {Promise<Array>}
 */
const processUploadedFiles = async (files, applicationReference) => {
  if (!files || Object.keys(files).length === 0) return [];

  const folder = \`nanny-applications/\${applicationReference}\`;
  const documentMeta = [];

  for (const [fieldName, fileArray] of Object.entries(files)) {
    const docType = FIELD_TO_DOC_TYPE[fieldName] || "OTHER";

    for (const file of fileArray) {
      const result = await uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        folder
      );

      documentMeta.push({
        type: docType,
        originalName: file.originalname,
        publicId: result.publicId,
        resourceType: result.resourceType,
        format: result.format,
        bytes: result.bytes,
        uploadedAt: new Date(),
      });
    }
  }

  return documentMeta;
};

module.exports = { mapFormDataToSchema, processUploadedFiles, FIELD_TO_DOC_TYPE };
