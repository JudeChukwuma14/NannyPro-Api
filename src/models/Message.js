const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    to: {
      email: { type: String, trim: true, required: true },
      name: { type: String, trim: true },
    },
    subject: { type: String, trim: true, required: true },
    body: { type: String, required: true },

    relatedTo: {
      type: { type: String, enum: ["Application", "Enquiry", "Family", "Nanny"] },
      id: { type: mongoose.Schema.Types.ObjectId },
    },

    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },

    status: { type: String, enum: ["sent", "failed"], required: true },
    errorMessage: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
