import webpush from "web-push";
import User from "../models/User.js";

/**
 * Web Push lets us ring/notify a user's device even when HelloChat isn't
 * open in the foreground (incoming calls, missed calls) - this is the
 * "PWA push notifications to notify/ring the recipient" requirement.
 *
 * Setup (one-time): generate a VAPID keypair with
 *   npx web-push generate-vapid-keys
 * and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 * (mailto:you@example.com) in backend/.env. Push silently no-ops (logged
 * once) if these aren't set, so the rest of the app keeps working without
 * them - just without background call/notification alerts.
 */
export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let warned = false;
if (isPushConfigured()) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} 

function warnOnce() {
  if (warned || isPushConfigured()) return;
  warned = true;
  console.warn(
    "[webPush] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not set - push " +
      "notifications (incoming/missed call alerts, background message " +
      "alerts) are disabled. Generate a keypair with " +
      "`npx web-push generate-vapid-keys` and add them to backend/.env."
  );
}

/**
 * Send a push payload to every device a user has subscribed on. Prunes
 * subscriptions the push service reports as gone (410/404) so they don't
 * pile up forever. Best-effort - never throws.
 */
export async function sendPushToUser(userId, payload) {
  if (!isPushConfigured()) {
    warnOnce();
    return;
  }
  try {
    const user = await User.findById(userId).select("pushSubscriptions").lean();
    const subs = user?.pushSubscriptions || [];
    if (!subs.length) return;

    const staleEndpoints = [];
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify(payload)
          );
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          } else {
            console.warn(`Push send failed for ${userId}:`, err.message);
          }
        }
      })
    );

    if (staleEndpoints.length) {
      await User.updateOne(
        { _id: userId },
        { $pull: { pushSubscriptions: { endpoint: { $in: staleEndpoints } } } }
      );
    }
  } catch (err) {
    console.error("sendPushToUser error:", err);
  }
}

/** Convenience wrapper for an incoming/missed call notification. */
export function sendCallPush(userId, { type, callerName, callType }) {
  const isMissed = type === "missed_call";
  return sendPushToUser(userId, {
    title: isMissed ? `Missed ${callType || "audio"} call` : `Incoming ${callType || "audio"} call`,
    body: isMissed
      ? `You missed a call from ${callerName || "someone"}`
      : `${callerName || "Someone"} is calling you`,
    tag: isMissed ? "missed-call" : "incoming-call",
    icon: "/pwa-icons/icon-192.png",
    data: { kind: isMissed ? "missed_call" : "incoming_call", url: "/home" },
    requireInteraction: !isMissed,
  });
}

/** Convenience wrapper for a new-message notification (sent only when the recipient is offline - see server.js). */
export function sendMessagePush(userId, { senderName, preview }) {
  return sendPushToUser(userId, {
    title: senderName || "New message",
    body: preview || "Sent you a message",
    tag: "new-message",
    icon: "/pwa-icons/icon-192.png",
    data: { kind: "new_message", url: "/home" },
  });
}
