import axios from "../api/axios";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function getDeviceId() {
  let id = localStorage.getItem("hellochat_device_id");
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("hellochat_device_id", id);
  }
  return id;
}

/**
 * Requests notification permission (if not already decided) and
 * subscribes this device to Web Push, so incoming/missed call alerts (and
 * background message alerts) can reach the user even when HelloChat isn't
 * open. Safe to call on every login - it's a cheap no-op if already
 * subscribed with the same key, and does nothing at all if the browser
 * doesn't support push or the user has denied permission.
 */
export async function setupPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    if (Notification.permission === "denied") return;
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      if (result !== "granted") return;
    }

    const registration = await navigator.serviceWorker.ready;

    const { data } = await axios.get("/push/vapid-public-key");
    if (!data?.publicKey) return; // push not configured server-side yet

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    await axios.post("/push/subscribe", {
      subscription: subscription.toJSON(),
      deviceId: getDeviceId(),
    });
  } catch (err) {
    console.warn("Push notification setup skipped:", err.message);
  }
}
