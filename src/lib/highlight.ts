// Highlight colors: an ordered list used by the picker, a Tailwind tint class
// applied to the verse text, and a solid swatch for the picker buttons.
export const HIGHLIGHT_ORDER = ["yellow", "green", "blue", "pink", "orange"] as const;
export type HighlightColor = (typeof HIGHLIGHT_ORDER)[number];

export const HIGHLIGHT_TINT: Record<string, string> = {
  yellow: "bg-yellow-200/50",
  green: "bg-green-200/50",
  blue: "bg-sky-200/50",
  pink: "bg-pink-200/50",
  orange: "bg-orange-200/50",
};

export const HIGHLIGHT_SWATCH: Record<HighlightColor, string> = {
  yellow: "#fde047",
  green: "#86efac",
  blue: "#7dd3fc",
  pink: "#f9a8d4",
  orange: "#fdba74",
};
