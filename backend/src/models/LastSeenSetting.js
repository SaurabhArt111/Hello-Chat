import mongoose from "mongoose";

const lastSeenSettingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    lastSeen: {
      type: String,
      enum: ["everyone", "contacts", "nobody"],
      default: "everyone",
    },
  },
  { timestamps: true }
);

export default mongoose.model("LastSeenSetting", lastSeenSettingSchema);

