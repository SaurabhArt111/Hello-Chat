import mongoose from "mongoose";

const userLanguageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    preferredLanguage: {
      type: String,
      default: "en",
    },
  },
  { timestamps: true }
);

export default mongoose.model("UserLanguage", userLanguageSchema);
