"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Theme } from "@/lib/themes";

type Ctx = {
  theme: Theme;
  setTheme: (next: Partial<Theme>) => void;
};

const ThemeContext = createContext<Ctx | null>(null);

const COOKIE = "libretto_theme";

function setCookie(value: Theme) {
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

function applyToDom(theme: Theme) {
  const root = document.documentElement;
  root.dataset.palette = theme.palette;
  root.dataset.type = theme.type;
  const resolvedMode =
    theme.mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme.mode;
  root.classList.toggle("dark", resolvedMode === "dark");
  root.style.colorScheme = resolvedMode;
}

export function ThemeProvider({
  initial,
  children,
}: {
  initial: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initial);

  useEffect(() => {
    applyToDom(theme);
  }, [theme]);

  useEffect(() => {
    if (theme.mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyToDom(theme);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((next: Partial<Theme>) => {
    setThemeState((prev) => {
      const merged = { ...prev, ...next };
      setCookie(merged);
      return merged;
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
