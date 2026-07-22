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

const LIBRETRANSLATE_URL =
  process.env.LIBRETRANSLATE_URL || "https://libretranslate.com/translate";

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

/**
 * Translate text to target language. Auto-detects source.
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Code or name (e.g. "en", "Hindi")
 * @returns {{ translatedText: string, detectedLanguage: string }}
 */
export async function translateTo(text, targetLanguage) {
  const targetCode = normalizeTargetCode(targetLanguage);

  // Try LibreTranslate first (usually more reliable than unofficial Google)
  try {
    return await translateWithLibreTranslate(text, targetCode);
  } catch (libreErr) {
    console.warn("LibreTranslate failed:", libreErr.message);
  }

  // Fallback to Google
  try {
    return await translateWithGoogle(text, targetCode);
  } catch (googleErr) {
    console.warn("Google translate failed:", googleErr.message);
  }

  // Both failed: return original text
  return { translatedText: text, detectedLanguage: "en" };
}

export { normalizeTargetCode, CODE_ALIASES };
