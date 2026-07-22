let messageSoundEnabled = true;

export const setMessageSoundEnabled = (value) => {
  messageSoundEnabled = !!value;
};

const sendAudio =
  typeof Audio !== "undefined"
    ? new Audio("/sounds/send.mp3")
    : null;

// Keep a no-op receive handler for now to avoid double/queued sounds issues.
// You can later wire this up again once you're happy with browser autoplay behavior.
export const playSendSound = () => {
  if (!messageSoundEnabled || !sendAudio) return;
  try {
    sendAudio.currentTime = 0;
    sendAudio.play().catch(() => {});
  } catch {
    // ignore
  }
};

export const playReceiveSound = () => {
  // intentionally left blank (no receive sound)
};

