const { uploadFile } = require("./cloudinaryService");

/**
 * Maps the frontend's flat form data object to the nested Application schema.
 *
 * The frontend sends a flat object where day availability is represented as
 * individual boolean fields (day_Monday, day_Tuesday, etc).
 * We normalise these into a daysAvailable array.
 *
 * @param {Object} formData - Raw flat data from the frontend
 * @returns {Object} Nested object ready to pass to new Application(...)
 */
const mapFormDataToSchema = (formData) => {
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Collect which days are selected
  const daysAvailable = DAYS.filter((day) => formData[`day_${day}`] === true || formData[`day_${day}`] === "true");

  return {
    personalDetails: {
      fullName: formData.fullName,
      preferredName: formData.preferredName,
      dateOfBirth: formData.dateOfBirth,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      postcode: formData.postcode,
      nationality: formData.nationality,
      languages: formData.languages,
    },

    experience: {
      yearsChildcareExp: formData.yearsChildcareExp,
      yearsNannyExp: formData.yearsNannyExp,
      ageGroups: Array.isArray(formData.ageGroups) ? formData.ageGroups : [],
      previousRoles: formData.previousRoles,
      newbornExp: formData.newbornExp,
      toddlerExp: formData.toddlerExp,
      schoolAgeExp: formData.schoolAgeExp,
      multipleChildrenExp: formData.multipleChildrenExp,
      additionalNeedsExp: formData.additionalNeedsExp,
      additionalNeedsDetail: formData.additionalNeedsDetail,
      otherExp: formData.otherExp,
    },

    qualifications: {
      childcareQualifications: formData.childcareQualifications,
      otherQualifications: formData.otherQualifications,
      paediatricFirstAid: formData.paediatricFirstAid,
      otherFirstAid: formData.otherFirstAid,
      otherCertificates: formData.otherCertificates,
    },

    dbs: {
      hasCurrentDBS: formData.hasCurrentDBS,
      dbsType: formData.dbsType,
      dbsDate: formData.dbsDate,
      dbsUpdateService: formData.dbsUpdateService,
      dbsCertNumber: formData.dbsCertNumber,
      dbsAdditionalInfo: formData.dbsAdditionalInfo,
    },

    rightToWork: {
      rightToWork: formData.rightToWork,
      rightToWorkType: formData.rightToWorkType,
      rightToWorkDetails: formData.rightToWorkDetails,
    },

    availability: {
      startDate: formData.startDate,
      workType: formData.workType,
      liveInOut: formData.liveInOut,
      hoursAvailable: formData.hoursAvailable,
      weekendAvailability: formData.weekendAvailability,
      eveningAvailability: formData.eveningAvailability,
      preferredHours: formData.preferredHours,
      areasWillingToWork: formData.areasWillingToWork,
      maxDistance: formData.maxDistance,
      daysAvailable,
    },

    skills: {
      skillDriving: !!formData.skillDriving,
      skillCar: !!formData.skillCar,
      skillNewborn: !!formData.skillNewborn,
      skillCooking: !!formData.skillCooking,
      skillHomework: !!formData.skillHomework,
      skillSwimming: !!formData.skillSwimming,
      skillLanguages: !!formData.skillLanguages,
      skillSEN: !!formData.skillSEN,
      skillSleep: !!formData.skillSleep,
      skillSchoolRuns: !!formData.skillSchoolRuns,
      skillOther: !!formData.skillOther,
      otherSkillsDetail: formData.otherSkillsDetail,
    },

    about: {
      aboutYourself: formData.aboutYourself,
      whyNanny: formData.whyNanny,
      enjoyAboutChildcare: formData.enjoyAboutChildcare,
      familyType: formData.familyType,
    },

    declaration: {
      declarationAccurate: formData.declarationAccurate === true || formData.declarationAccurate === "true",
      consentReview: formData.consentReview === true || formData.consentReview === "true",
      consentReferences: formData.consentReferences === true || formData.consentReferences === "true",
      agreePrivacy: formData.agreePrivacy === true || formData.agreePrivacy === "true",
      agreeTerms: formData.agreeTerms === true || formData.agreeTerms === "true",
      declarationName: formData.declarationName,
      declarationDate: formData.declarationDate,
    },

    references: Array.isArray(formData.references)
      ? formData.references
          .filter((r) => r && r.employerName)
          .map((r) => ({
            employerName: r.employerName,
            email: r.email,
            phone: r.phone,
            role: r.role,
            relationship: r.relationship,
            startDate: r.startDate,
            endDate: r.endDate,
          }))
      : [],
  };
};

/**
 * Field name → document type mapping.
 * Maps Multer field names to the Document type enum in the Application model.
 */
const FIELD_TO_DOC_TYPE = {
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

  const folder = `nanny-applications/${applicationReference}`;
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
