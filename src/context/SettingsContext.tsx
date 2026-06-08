import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_READ_COLOR } from "../lib/readColor";

export type ThemePref = "light" | "dark" | "system";

interface Settings {
  translation: string;
  setTranslation: (t: string) => void;
  interlinear: boolean;
  setInterlinear: (v: boolean) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  resolvedDark: boolean;
  readColor: string;
  setReadColor: (c: string) => void;
}

const SettingsContext = createContext<Settings | undefined>(undefined);

const STORE_KEY = "bs:settings";
const DEFAULT_TRANSLATION = "eng_kjv"; // King James Version

interface Stored {
  translation: string;
  interlinear: boolean;
  theme: ThemePref;
  readColor: string;
}

function load(): Stored {
  const defaults: Stored = {
    translation: DEFAULT_TRANSLATION,
    interlinear: false,
    theme: "system",
    readColor: DEFAULT_READ_COLOR,
  };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<Stored>) };
  } catch {
    /* ignore */
  }
  return defaults;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const initial = load();
  const [translation, setTranslation] = useState(initial.translation);
  const [interlinear, setInterlinear] = useState(initial.interlinear);
  const [theme, setTheme] = useState<ThemePref>(initial.theme);
  const [readColor, setReadColor] = useState(initial.readColor);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ translation, interlinear, theme, readColor })
    );
  }, [translation, interlinear, theme, readColor]);

  // Track the OS preference so "system" stays in sync.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedDark = theme === "dark" || (theme === "system" && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedDark);
  }, [resolvedDark]);

  const value = useMemo(
    () => ({
      translation,
      setTranslation,
      interlinear,
      setInterlinear,
      theme,
      setTheme,
      resolvedDark,
      readColor,
      setReadColor,
    }),
    [translation, interlinear, theme, resolvedDark, readColor]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
