const DEVICE_ID_KEY = "deviceId";

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: reasonably unique for client-side use
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function getDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && typeof existing === "string") return existing;
    const next = generateId();
    localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    return generateId();
  }
}

