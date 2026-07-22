import UserLanguage from "../models/UserLanguage.js";
import User from "../models/User.js";

const LANGUAGES = {
  en: "English",
  hi: "Hindi",
  gu: "Gujarati",
  or: "Odia",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  bn: "Bengali",
  mr: "Marathi",
  pa: "Punjabi",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese",
  ja: "Japanese",
  ar: "Arabic",
  ru: "Russian",
  pt: "Portuguese",
  it: "Italian",
};

const VALID_CODES = Object.keys(LANGUAGES);

/** POST /api/user/language */
export const saveLanguage = async (req, res) => {
  try {
    const userId = req.user;
    const { preferredLanguage } = req.body;

    if (!preferredLanguage) {
      return res.status(400).json({
        success: false,
        message: "preferredLanguage is required",
      });
    }

    // We now accept ONLY language codes
    if (!VALID_CODES.includes(preferredLanguage)) {
      return res.status(400).json({
        success: false,
        message: "Invalid language code",
      });
    }

    // Save in UserLanguage
    const doc = await UserLanguage.findOneAndUpdate(
      { userId },
      { preferredLanguage },
      { new: true, upsert: true }
    );

    // Mirror in User (store CODE, not display name)
    await User.findByIdAndUpdate(userId, {
      preferredLanguage,
    });

    return res.json({
      success: true,
      preferredLanguage: doc.preferredLanguage,
      displayName: LANGUAGES[doc.preferredLanguage],
    });

  } catch (err) {
    console.error("saveLanguage error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/** GET /api/user/language/:userId */
export const getLanguage = async (req, res) => {
  try {
    const { userId } = req.params;

    const doc = await UserLanguage.findOne({ userId }).lean();

    if (doc && VALID_CODES.includes(doc.preferredLanguage)) {
      return res.json({
        success: true,
        preferredLanguage: doc.preferredLanguage,
        displayName: LANGUAGES[doc.preferredLanguage],
      });
    }

    // Fallback to User model
    const user = await User.findById(userId)
      .select("preferredLanguage")
      .lean();

    const code = VALID_CODES.includes(user?.preferredLanguage)
      ? user.preferredLanguage
      : "en";

    return res.json({
      success: true,
      preferredLanguage: code,
      displayName: LANGUAGES[code],
    });

  } catch (err) {
    console.error("getLanguage error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAvailableLanguages = (req, res) => {
  const languageList = Object.entries(LANGUAGES).map(
    ([code, name]) => ({ code, name })
  );

  return res.json({
    success: true,
    languages: languageList,
  });
};