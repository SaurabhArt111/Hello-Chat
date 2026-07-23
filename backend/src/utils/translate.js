/**
 * Shared translation: tries LibreTranslate first, then Google as fallback.
 * Set LIBRETRANSLATE_URL in .env to use your own instance (optional).
 * LibreTranslate public API may require API key for libretranslate.com.
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

// Only use LibreTranslate if the operator has explicitly pointed this at a
// real instance (self-hosted, or a paid libretranslate.com key). The public
// https://libretranslate.com/translate endpoint rejects unauthenticated
// requests with a 400, so defaulting to it just produces a failed request +
// console spam on every single translation before falling back to Google.
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || null;
const LIBRETRANSLATE_ENABLED = Boolean(LIBRETRANSLATE_URL);

function normalizeTargetCode(targetLanguage) {
  return CODE_ALIASES[targetLanguage] || targetLanguage || "en";
}

/** Try LibreTranslate (public instance; add api_key in body if required) */
async function translateWithLibreTranslate(text, targetCode) {
  const body = {
    q: text,
    source: "auto",
    target: targetCode,
    format: "text",
  };
  if (process.env.LIBRETRANSLATE_API_KEY) {
    body.api_key = process.env.LIBRETRANSLATE_API_KEY;
  }

  const res = await fetch(LIBRETRANSLATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LibreTranslate ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const translatedText =
    data.translatedText ?? data.translation ?? text;
  const detected =
    data.detectedLanguage?.language ??
    data.detectedLanguage?.code ??
    (typeof data.detectedLanguage === "string" ? data.detectedLanguage : null);
  const detectedLanguage = detected || "en";

  return { translatedText, detectedLanguage };
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

  // Try LibreTranslate first (usually more reliable than unofficial Google),
  // but only if a real instance/key has been configured.
  if (LIBRETRANSLATE_ENABLED) {
    try {
      return await translateWithLibreTranslate(text, targetCode);
    } catch (libreErr) {
      console.warn("LibreTranslate failed:", libreErr.message);
    }
  }

  // Fallback to Google, unless we recently got rate-limited and are still
  // in the cooldown window - in that case skip straight to original text.
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

  // Both failed: return original text
  return { translatedText: text, detectedLanguage: "en" };
}

export { normalizeTargetCode, CODE_ALIASES };
