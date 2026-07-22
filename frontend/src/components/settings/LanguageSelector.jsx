import React, { useState, useEffect } from "react";
import axios from "../../api/axios";
import { useLanguage } from "../../context/LanguageContext";

export default function LanguageSelector() {
  const { preferredLanguage, setPreferredLanguage, refreshLanguage } =
    useLanguage();

  const [languages, setLanguages] = useState([]);
  const [selected, setSelected] = useState(preferredLanguage || "en");
  const [saving, setSaving] = useState(false);

  // Load available languages from backend
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const res = await axios.get("/user/languages");
        setLanguages(res.data.languages);
      } catch (err) {
        console.error("Failed to fetch languages:", err);
      }
    };

    fetchLanguages();
  }, []);

  // Sync selected with context
  useEffect(() => {
    setSelected(preferredLanguage || "en");
  }, [preferredLanguage]);

  const handleChange = async (e) => {
    const code = e.target.value;

    setSelected(code);
    setSaving(true);

    try {
      await axios.post("/user/language", {
        preferredLanguage: code,
      });

      setPreferredLanguage(code);
      await refreshLanguage();
    } catch (err) {
      console.error("Failed to save language:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-900 dark:text-neutral-100">
        Translation language
      </h3>

      <p className="text-sm text-gray-500 dark:text-neutral-400">
        Incoming messages will be auto-translated to this language.
      </p>

      <select
        value={selected}
        onChange={handleChange}
        disabled={saving}
        className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100 border border-gray-300 dark:border-neutral-600 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>

      {saving && (
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          Saving...
        </p>
      )}
    </div>
  );
}