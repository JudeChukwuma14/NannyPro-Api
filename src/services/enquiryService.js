/**
 * Maps the frontend's flat form data object (RequestNannyPage.jsx's
 * getValues()) to the nested Enquiry schema — mirrors
 * applicationService.js's mapFormDataToSchema for the sister flow.
 *
 * @param {Object} formData - Raw flat data from the frontend
 * @returns {Object} Nested object ready to pass to Enquiry.create(...)
 */
function mapFormDataToSchema(formData) {
  const children = Array.isArray(formData.children)
    ? formData.children.map((c) => ({
        name: c.name,
        age: Number(c.age),
        gender: c.gender,
        notes: c.notes,
      }))
    : [];

  return {
    serviceType: formData.serviceType,
    frequency: formData.frequency,
    isUrgent: formData.isUrgent === true || formData.isUrgent === "yes",
    preferredStartDate: formData.preferredStartDate,

    schedule: {
      daysNeeded: Array.isArray(formData.daysNeeded) ? formData.daysNeeded : [],
      hoursPerWeek: formData.hoursPerWeek,
      scheduleNotes: formData.scheduleNotes,
    },

    children,

    location: {
      postcode: formData.postcode,
      area: formData.area,
      locationType: formData.locationType,
      livingArrangement: formData.livingArrangement,
    },

    needs: {
      duties: Array.isArray(formData.duties) ? formData.duties : [],
      experienceRequired: formData.experienceRequired,
      qualifications: Array.isArray(formData.qualifications) ? formData.qualifications : [],
      specialRequirements: formData.specialRequirements,
    },

    parent: {
      firstName: formData.parentFirstName,
      lastName: formData.parentLastName,
      email: formData.email,
      phone: formData.phone,
      contactMethod: formData.contactMethod,
    },

    agreeToContact: formData.agreeToContact === true || formData.agreeToContact === "true",
  };
}

module.exports = { mapFormDataToSchema };
