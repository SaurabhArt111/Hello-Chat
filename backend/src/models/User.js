import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    bio: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    // Cloudinary public_id for the current avatar, so we can clean up the
    // old file when it's replaced or removed instead of leaking storage.
    avatarPublicId: {
      type: String,
      default: "",
    },
    preferredLanguage: {
      type: String,
      default: "en",
    },
    /**
     * End-to-end encryption public key (X25519, base64-encoded), used for
     * NaCl box encryption of 1:1 chat messages. Generated client-side on
     * first login/registration; the matching private key never leaves the
     * device (see frontend/src/utils/e2ee.js). Server only ever sees
     * ciphertext for E2EE conversations.
     */
    e2eePublicKey: {
      type: String,
      default: "",
    },
    /**
     * Web Push (VAPID) subscriptions, one per device/browser the user has
     * granted notification permission on. Used to ring/notify for incoming
     * and missed calls (and optionally new messages) even when the app
     * isn't in the foreground.
     */
    pushSubscriptions: [
      {
        endpoint: String,
        keys: {
          p256dh: String,
          auth: String,
        },
        deviceId: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    jwtVersion: {
      type: Number,
      default: 0,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);