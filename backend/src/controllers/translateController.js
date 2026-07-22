import { translateTo } from "../utils/translate.js";

/**
 * POST /api/translate
 * Body: { text, targetLanguage }
 * targetLanguage: ISO code (en, hi, gu, es, fr, de) or display name
 */
export const translateText = async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ message: "text is required" });
    }

    const { translatedText, detectedLanguage } = await translateTo(
      text,
      targetLanguage
    );

    return res.json({
      originalText: text,
      translatedText,
      detectedLanguage,
    });
  } catch (err) {
    console.error("translateText error:", err);
    return res.status(500).json({
      error: "Translation failed",
      message: err.message,
    });
  }
};
