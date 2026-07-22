import mongoose from "mongoose";

const friendSchema = new mongoose.Schema(
  {
    user1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    user2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure uniqueness regardless of order (user1,user2 are always sorted).
friendSchema.index({ user1: 1, user2: 1 }, { unique: true });

export default mongoose.model("Friend", friendSchema);

