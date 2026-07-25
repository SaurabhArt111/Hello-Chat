import User from "../models/User.js";
import { isPushConfigured } from "../utils/webPush.js";

export const getVapidPublicKey = (req, res) => {
  return res.json({ publicKey: isPushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
};

// POST /api/push/subscribe  { subscription: PushSubscriptionJSON, deviceId }
export const subscribe = async (req, res) => {
  try {
    const { subscription, deviceId } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ message: "A valid push subscription is required" });
    }

    // Replace any existing subscription for this endpoint or device so we
    // don't accumulate duplicates every time the app re-registers.
    await User.updateOne(
      { _id: req.user },
      {
        $pull: {
          pushSubscriptions: {
            $or: [{ endpoint: subscription.endpoint }, ...(deviceId ? [{ deviceId }] : [])],
          },
        },
      }
    );
    await User.updateOne(
      { _id: req.user },
      {
        $push: {
          pushSubscriptions: {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            deviceId: deviceId || undefined,
          },
        },
      }
    );

    return res.json({ message: "Subscribed" });
  } catch (err) {
    console.error("PUSH SUBSCRIBE ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// POST /api/push/unsubscribe  { endpoint }
export const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ message: "endpoint is required" });
    await User.updateOne({ _id: req.user }, { $pull: { pushSubscriptions: { endpoint } } });
    return res.json({ message: "Unsubscribed" });
  } catch (err) {
    console.error("PUSH UNSUBSCRIBE ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
