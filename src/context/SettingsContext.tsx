import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface Settings {
  translation: string;
  setTranslation: (t: string) => void;
  interlinear: boolean;
  setInterlinear: (v: boolean) => void;
}

const SettingsContext = createContext<Settings | undefined>(undefined);

const STORE_KEY = "bs:settings";

function load(): { translation: string; interlinear: boolean } {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { translation: "BSB", interlinear: false, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { translation: "BSB", interlinear: false };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const initial = load();
  const [translation, setTranslation] = useState(initial.translation);
  const [interlinear, setInterlinear] = useState(initial.interlinear);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify({ translation, interlinear }));
  }, [translation, interlinear]);

  const value = useMemo(
    () => ({ translation, setTranslation, interlinear, setInterlinear }),
    [translation, interlinear]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
