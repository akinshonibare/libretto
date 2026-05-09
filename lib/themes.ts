export type ThemePalette =
  | "foxed-page"
  | "linen-indigo"
  | "marginalia"
  | "velluto"
  | "risograph"
  | "greenroom";

export type ThemeMode = "light" | "dark" | "system";

export type ThemeType = "serif" | "sans" | "mixed";

export type Theme = {
  palette: ThemePalette;
  mode: ThemeMode;
  type: ThemeType;
};

export const DEFAULT_THEME: Theme = {
  palette: "foxed-page",
  mode: "light",
  type: "mixed",
};

export const PALETTES: Array<{
  id: ThemePalette;
  name: string;
  vibe: string;
}> = [
  {
    id: "foxed-page",
    name: "Foxed Page",
    vibe: "Warm cream paperback with ink-brown text and faded marigold.",
  },
  {
    id: "linen-indigo",
    name: "Linen & Indigo",
    vibe: "Crisp editorial linen with deep indigo and brick highlights.",
  },
  {
    id: "marginalia",
    name: "Marginalia",
    vibe: "Notebook sage and terracotta with pencil grays.",
  },
  {
    id: "velluto",
    name: "Velluto",
    vibe: "Late-evening reading lamp — warm black and brass.",
  },
  {
    id: "risograph",
    name: "Risograph",
    vibe: "Bone white with riso pink, cobalt, and mustard.",
  },
  {
    id: "greenroom",
    name: "Greenroom",
    vibe: "Library-lamp green with oxblood and ivory paper.",
  },
];

export const TYPES: Array<{ id: ThemeType; name: string; description: string }> = [
  { id: "mixed", name: "Mixed", description: "Serif headlines, sans body — default." },
  { id: "serif", name: "Serif", description: "Editorial feel throughout." },
  { id: "sans", name: "Sans", description: "Modern, neutral throughout." },
];

export function isPalette(value: string | null | undefined): value is ThemePalette {
  return PALETTES.some((p) => p.id === value);
}

export function isMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function isType(value: string | null | undefined): value is ThemeType {
  return value === "serif" || value === "sans" || value === "mixed";
}
