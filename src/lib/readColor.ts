// Color used to mark chapters you've already read. Stored as a hex so we can
// render a translucent tint that looks right in both light and dark themes.
export interface ReadColor {
  id: string;
  label: string;
  hex: string;
}

export const READ_COLORS: ReadColor[] = [
  { id: "green", label: "Green", hex: "#10b981" },
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "amber", label: "Amber", hex: "#f59e0b" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
  { id: "rose", label: "Rose", hex: "#f43f5e" },
  { id: "teal", label: "Teal", hex: "#14b8a6" },
];

export const DEFAULT_READ_COLOR = "green";

export function readHex(id: string): string {
  return (READ_COLORS.find((c) => c.id === id) || READ_COLORS[0]).hex;
}

// Translucent surface + border tint for a "read" chapter chip.
export function readTintStyle(id: string): React.CSSProperties {
  const hex = readHex(id);
  return { backgroundColor: `${hex}2e`, borderColor: `${hex}80` };
}
