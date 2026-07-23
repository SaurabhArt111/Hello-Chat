/**
 * Thin wrapper around the browser Notification API. Centralized here so
 * permission is requested once and every notification call (messages,
 * calls, etc.) behaves consistently.
 */

export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Show a browser/OS notification if permitted and the tab isn't already
 * focused (no point interrupting someone actively looking at the chat).
 */
export function showBackgroundNotification(title, options = {}) {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== "granted") return null;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return null;

  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return notification;
  } catch (err) {
    console.warn("Failed to show notification:", err);
    return null;
  }
}
