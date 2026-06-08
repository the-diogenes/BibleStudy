import { useEffect, useState } from "react";
import { getTranslations, type Translation } from "../lib/bibleApi";
import { useSettings } from "../context/SettingsContext";

// A curated short list surfaced first; the rest remain selectable.
const PREFERRED = ["BSB", "WEB", "WEBBE", "ENGWEBP", "KJV", "ENGKJV", "NET"];

export default function TranslationPicker({ className = "" }: { className?: string }) {
  const { translation, setTranslation } = useSettings();
  const [translations, setTranslations] = useState<Translation[]>([]);

  useEffect(() => {
    getTranslations()
      .then(setTranslations)
      .catch(() => setTranslations([]));
  }, []);

  const sorted = [...translations].sort((a, b) => {
    const ai = PREFERRED.indexOf(a.id);
    const bi = PREFERRED.indexOf(b.id);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.englishName.localeCompare(b.englishName);
  });

  return (
    <select
      aria-label="Translation"
      className={`input max-w-[12rem] ${className}`}
      value={translation}
      onChange={(e) => setTranslation(e.target.value)}
    >
      {/* Ensure the current value is always present even before list loads */}
      {sorted.length === 0 && <option value={translation}>{translation}</option>}
      {sorted.map((t) => (
        <option key={t.id} value={t.id}>
          {t.shortName || t.id} - {t.englishName}
        </option>
      ))}
    </select>
  );
}
