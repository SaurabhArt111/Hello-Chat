import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  { timestamps: true }
);

// Unique conversation per unordered pair of participants (for 1-1 chats).
conversationSchema.index({ participants: 1 }, { unique: true });

export default mongoose.model("Conversation", conversationSchema);

