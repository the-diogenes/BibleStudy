export type ThemeId =
  | "system"
  | "light"
  | "dark"
  | "cherry"
  | "forest"
  | "desert"
  | "ocean";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  /** Swatch background for the picker preview. */
  bg: string;
  /** Swatch foreground (text) for the picker preview. */
  fg: string;
  /** Whether this theme uses a dark surface palette. */
  dark: boolean;
}

export const THEMES: ThemeOption[] = [
  { id: "system", label: "System", bg: "#9aa0a6", fg: "#ffffff", dark: false },
  { id: "light", label: "Light", bg: "#faf9f7", fg: "#1c1917", dark: false },
  { id: "dark", label: "Dark", bg: "#1b1714", fg: "#ece7e0", dark: true },
  { id: "cherry", label: "Cherry Blossom", bg: "#fdf2f6", fg: "#9f1239", dark: false },
  { id: "forest", label: "Forest", bg: "#12201a", fg: "#e2e9df", dark: true },
  { id: "desert", label: "Desert", bg: "#f3e9d2", fg: "#3c2f21", dark: false },
  { id: "ocean", label: "Ocean", bg: "#0d1a28", fg: "#e0eef7", dark: true },
];

/** Themes whose surfaces are dark (used for resolvedDark + color-scheme). */
const DARK_THEMES = new Set<ThemeId>(["dark", "forest", "ocean"]);

export function isDarkTheme(id: ThemeId): boolean {
  return DARK_THEMES.has(id);
}

/** All theme classes we may add to <html>, so we can clear them before applying one. */
export const THEME_CLASSES = ["dark", "theme-cherry", "theme-forest", "theme-desert", "theme-ocean"];

/** The class to apply on <html> for a resolved (non-system) theme. "" = default light. */
export function themeClass(id: Exclude<ThemeId, "system">): string {
  if (id === "light") return "";
  if (id === "dark") return "dark";
  return `theme-${id}`;
}
