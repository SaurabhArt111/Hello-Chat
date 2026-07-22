import mongoose from "mongoose";

const profilePhotoPrivacySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    profilePhoto: {
      type: String,
      enum: ["everyone", "contacts", "nobody"],
      default: "everyone",
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "ProfilePhotoPrivacy",
  profilePhotoPrivacySchema
);

