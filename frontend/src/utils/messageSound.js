// Notification sound preference: only the RECEIVE sound plays (a "sent"
// sound is chatty/annoying at scale and every major chat app has dropped
// it - WhatsApp, iMessage, Telegram all only sound on incoming messages).
let messageSoundEnabled = true;

export const setMessageSoundEnabled = (value) => {
  messageSoundEnabled = !!value;
};

const receiveAudio =
  typeof Audio !== "undefined" ? new Audio("/sounds/receive.mp3") : null;

/**
 * Intentionally a no-op: HelloChat no longer plays a sound when the local
 * user sends a message (matches WhatsApp/iMessage/Telegram - a "sent"
 * chime for your own action adds noise without information). Kept as an
 * exported function (rather than deleted) so call sites don't need to be
 * touched one-by-one; it simply does nothing.
 */
export const playSendSound = () => {};

/** Plays only when a message is RECEIVED from someone else. */
export const playReceiveSound = () => {
  if (!messageSoundEnabled || !receiveAudio) return;
  try {
    receiveAudio.currentTime = 0;
    receiveAudio.play().catch(() => {});
  } catch {
    // ignore - autoplay restrictions before first user interaction, etc.
  }
};
