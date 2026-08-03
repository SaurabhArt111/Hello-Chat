/**
 * Thin wrapper around the browser Notification API. Centralized here so
 * permission is requested once and every notification call (messages,
 * calls, etc.) behaves consistently.
 */
import { getActiveChatId } from "../realtime/activeChatTracker";

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
 * Show a browser/OS notification if permitted, unless the user is already
 * looking at this exact conversation (tab visible AND that chat is open).
 * Previously this suppressed on tab-visible alone, so a message arriving
 * for a *different* conversation than the one currently open produced no
 * signal at all while the app was in the foreground - a background push
 * would eventually reach a closed tab, but an open tab on the wrong chat
 * got silence in both directions.
 */
export function showBackgroundNotification(title, options = {}, conversationId = null) {
  if (!isNotificationSupported()) return null;
  if (Notification.permission !== "granted") return null;

  const isTabVisible = typeof document !== "undefined" && document.visibilityState === "visible";
  const isViewingThisChat =
    conversationId != null && getActiveChatId() != null && String(conversationId) === getActiveChatId();
  if (isTabVisible && isViewingThisChat) return null;

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
