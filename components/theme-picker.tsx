"use client";

import { Check } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { PALETTES, TYPES, type ThemeMode, type ThemePalette, type ThemeType } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTransition } from "react";
import { updateThemeAction } from "@/app/actions/theme";

const MODES: Array<{ id: ThemeMode; label: string }> = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [, startTransition] = useTransition();

  function persist(next: { palette?: ThemePalette; mode?: ThemeMode; type?: ThemeType }) {
    setTheme(next);
    const merged = { ...theme, ...next };
    startTransition(async () => {
      const fd = new FormData();
      fd.set("palette", merged.palette);
      fd.set("mode", merged.mode);
      fd.set("type", merged.type);
      await updateThemeAction(fd);
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-heading text-xl mb-3">Palette</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PALETTES.map((p) => {
            const selected = theme.palette === p.id;
            return (
              <button
                key={p.id}
                onClick={() => persist({ palette: p.id })}
                className={cn(
                  "group relative rounded-xl border p-4 text-left transition-colors",
                  selected
                    ? "border-[var(--ring)] ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--background)]"
                    : "border-[var(--border)] hover:border-[var(--ring)]"
                )}
              >
                <PaletteSwatch palette={p.id} />
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <p className="text-xs text-[var(--muted-foreground)]">{p.vibe}</p>
                  </div>
                  {selected && <Check className="size-4 text-[var(--primary)]" />}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-xl mb-3">Mode</h2>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <Button
              key={m.id}
              variant={theme.mode === m.id ? "default" : "outline"}
              size="sm"
              onClick={() => persist({ mode: m.id })}
            >
              {m.label}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-xl mb-3">Type pairing</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => persist({ type: t.id })}
              className={cn(
                "rounded-md border p-3 text-left text-sm transition-colors",
                theme.type === t.id
                  ? "border-[var(--ring)] ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-[var(--background)]"
                  : "border-[var(--border)] hover:border-[var(--ring)]"
              )}
            >
              <div className="font-medium">{t.name}</div>
              <p className="text-xs text-[var(--muted-foreground)]">{t.description}</p>
            </button>
          ))}
        </div>
      </section>

      <ThemePreview />
    </div>
  );
}

function PaletteSwatch({ palette }: { palette: ThemePalette }) {
  return (
    <div
      data-palette={palette}
      className="flex h-16 overflow-hidden rounded-md border border-[var(--border)]"
    >
      <div className="flex-1" style={{ background: "var(--paper)" }} />
      <div className="flex-1" style={{ background: "var(--primary)" }} />
      <div className="flex-1" style={{ background: "var(--accent)" }} />
      <div className="flex-1" style={{ background: "var(--highlight)" }} />
      <div className="flex-1" style={{ background: "var(--ink-quote)" }} />
    </div>
  );
}

function ThemePreview() {
  return (
    <section>
      <h2 className="font-heading text-xl mb-3">Live preview</h2>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Reading 路 finished
        </p>
        <h3 className="mt-1 font-heading text-2xl">Piranesi</h3>
        <p className="text-sm text-[var(--muted-foreground)]">Susanna Clarke</p>
        <p className="prose-quote mt-4 text-base">
          &ldquo;The Beauty of the House is immeasurable; its Kindness infinite.&rdquo;
        </p>
        <p className="mt-3 text-sm">
          A small, strange book that <mark>changed how I think about solitude</mark>. The interior
          architecture is the plot.
        </p>
      </div>
    </section>
  );
}
