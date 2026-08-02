/**
 * Shared translation using @vitalets/google-translate-api (unofficial,
 * keyless - no signup, no API key, no external account needed). No other
 * translation service is used.
 */

const CODE_ALIASES = {
  en: "en",
  hi: "hi",
  gu: "gu",
  es: "es",
  fr: "fr",
  de: "de",
  English: "en",
  Hindi: "hi",
  Gujarati: "gu",
  Spanish: "es",
  French: "fr",
  German: "de",
};

function normalizeTargetCode(targetLanguage) {
  return CODE_ALIASES[targetLanguage] || targetLanguage || "en";
}

/** Try @vitalets/google-translate-api (can be blocked by Google) */
async function translateWithGoogle(text, targetCode) {
  const { translate } = await import("@vitalets/google-translate-api");
  const result = await translate(text, { to: targetCode });
  // Package returns { text, raw } only - no "from". Do not use result.from.
  const translatedText = result?.text ?? text;
  const detectedLanguage =
    result?.raw?.src ?? result?.from?.language?.iso ?? "en";
  return { translatedText, detectedLanguage };
}

// Google's unofficial endpoint rate-limits by IP ("Too Many Requests"), and on
// a shared host like Render that limit gets hit fast once several users are
// translating at once. Retrying it on every message just floods the logs and
// adds latency for no benefit, since it will keep failing until the window
// clears. Trip a short circuit breaker on 429 so we skip straight to
// "return original text" for a cooldown period, and only log once per trip.
const GOOGLE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let googleBlockedUntil = 0;

/**
 * Translate text to target language. Auto-detects source.
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Code or name (e.g. "en", "Hindi")
 * @returns {{ translatedText: string, detectedLanguage: string }}
 */
export async function translateTo(text, targetLanguage) {
  const targetCode = normalizeTargetCode(targetLanguage);

  // Skip straight to original text if we're in a post-rate-limit cooldown.
  if (Date.now() < googleBlockedUntil) {
    return { translatedText: text, detectedLanguage: "en" };
  }

  try {
    return await translateWithGoogle(text, targetCode);
  } catch (googleErr) {
    const isRateLimited = /too many requests|429/i.test(
      googleErr.message || ""
    );
    if (isRateLimited) {
      googleBlockedUntil = Date.now() + GOOGLE_COOLDOWN_MS;
      console.warn(
        `Google translate rate-limited, pausing translation for ${
          GOOGLE_COOLDOWN_MS / 1000
        }s`
      );
    } else {
      console.warn("Google translate failed:", googleErr.message);
    }
  }

  // Failed: return original text
  return { translatedText: text, detectedLanguage: "en" };
}

export { normalizeTargetCode, CODE_ALIASES };
