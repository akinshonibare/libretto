import { cookies } from "next/headers";
import { DEFAULT_THEME, isMode, isPalette, isType, type Theme } from "./themes";

export const THEME_COOKIE = "libretto_theme";

export async function readThemeCookie(): Promise<Theme> {
  const store = await cookies();
  const raw = store.get(THEME_COOKIE)?.value;
  if (!raw) return DEFAULT_THEME;
  try {
    const parsed = JSON.parse(raw);
    return {
      palette: isPalette(parsed.palette) ? parsed.palette : DEFAULT_THEME.palette,
      mode: isMode(parsed.mode) ? parsed.mode : DEFAULT_THEME.mode,
      type: isType(parsed.type) ? parsed.type : DEFAULT_THEME.type,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

export async function writeThemeCookie(theme: Theme): Promise<void> {
  const store = await cookies();
  store.set(THEME_COOKIE, JSON.stringify(theme), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
