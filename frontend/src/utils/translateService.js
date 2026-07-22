import axios from "../api/axios";

const TRANSLATE_API = "/translate";

/**
 * Translate text to target language. API detects source language automatically.
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - ISO code (en, hi, gu, es, fr, de) or display name
 * @returns {Promise<{ originalText, translatedText, detectedLanguage }>}
 */
export async function translateText(text, targetLanguage) {
  const { data } = await axios.post(TRANSLATE_API, {
    text,
    targetLanguage,
  });
  return data;
}
