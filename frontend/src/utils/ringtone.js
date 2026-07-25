/**
 * Foreground incoming-call ringtone, synthesized with the Web Audio API
 * instead of loading an external MP3.
 *
 * Why synthesized instead of a hosted audio file: the previous
 * implementation pointed <audio src> at a third-party CDN
 * (assets.mixkit.co) - a single point of failure with no offline/PWA
 * caching, no attribution/licensing control, and a dependency on a
 * domain this app doesn't own staying up forever. A synthesized tone has
 * none of those problems and is essentially the same technique real
 * phones use for a classic dual-tone ring (~440Hz + ~480Hz).
 *
 * For BACKGROUND ringing (app closed/minimized), the actual device/system
 * notification sound is used instead via the Push API + service worker
 * (see public/sw.js) - that's the appropriate place for a "system
 * ringtone", since a page that isn't running can't play audio itself.
 */

let audioCtx = null;
let ringLoopHandle = null;
let activeOscillators = [];

function getContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function playRingBurst(ctx, startTime) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.35, startTime + 0.05);
  gain.gain.setValueAtTime(0.35, startTime + 1.9);
  gain.gain.linearRampToValueAtTime(0, startTime + 2.0);
  gain.connect(ctx.destination);

  [440, 480].forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(startTime);
    osc.stop(startTime + 2.0);
    activeOscillators.push(osc);
  });
}

/** Starts looping the ring pattern (2s ring, 4s pause) until stopRingtone() is called. */
export function startRingtone() {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  stopRingtone(); // avoid overlapping loops if called twice

  const cycle = () => {
    playRingBurst(ctx, ctx.currentTime);
    ringLoopHandle = setTimeout(cycle, 6000); // 2s ring + 4s pause
  };
  cycle();
}

export function stopRingtone() {
  if (ringLoopHandle) {
    clearTimeout(ringLoopHandle);
    ringLoopHandle = null;
  }
  activeOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
  });
  activeOscillators = [];
}
