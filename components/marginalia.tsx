import type { ChapterNoteRow, HighlightRow } from "@/lib/queries";

/**
 * The marginalia layout — pulled from the design system bundle.
 * Interleaves highlights and chapter notes in a single chronological feed,
 * grouped by chapter (when a chapter_note has a label) and ordered by page.
 *
 * Visual rules:
 *   - chapter divider: italic display label + horizontal rule
 *   - highlight: 2px accent left-border + italic ink-quote text + page meta
 *   - note: plain prose, indented to match
 */
type Props = {
  highlights: HighlightRow[];
  notes: ChapterNoteRow[];
  emptyMessage?: string;
};

type Item =
  | { kind: "highlight"; entry: HighlightRow; sortKey: [number, string] }
  | { kind: "note"; entry: ChapterNoteRow; sortKey: [number, string] };

export function Marginalia({ highlights, notes, emptyMessage }: Props) {
  const items: Item[] = [
    ...highlights.map<Item>((h) => ({
      kind: "highlight",
      entry: h,
      sortKey: [h.page ?? Number.MAX_SAFE_INTEGER, h.created_at],
    })),
    ...notes.map<Item>((n) => ({
      kind: "note",
      entry: n,
      sortKey: [n.page ?? Number.MAX_SAFE_INTEGER, n.created_at],
    })),
  ];
  items.sort((a, b) => {
    const [aP, aT] = a.sortKey;
    const [bP, bT] = b.sortKey;
    if (aP !== bP) return aP - bP;
    return aT.localeCompare(bT);
  });

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        {emptyMessage ?? "No marginalia yet — capture a highlight or jot a chapter note."}
      </p>
    );
  }

  let lastChapterLabel: string | null = null;
  return (
    <div className="space-y-4">
      {items.map((item, idx) => {
        let chapterDivider: React.ReactNode = null;
        if (item.kind === "note") {
          const label = item.entry.label?.trim();
          if (label && label !== lastChapterLabel) {
            chapterDivider = (
              <div className="marginalia-chapter">
                <span className="marginalia-chapter-label">{label}</span>
                <span className="marginalia-chapter-rule" />
              </div>
            );
            lastChapterLabel = label;
          }
        }

        if (item.kind === "highlight") {
          const h = item.entry;
          return (
            <div key={`h-${h.id}`}>
              {chapterDivider}
              <div className="marginalia-highlight">
                <p className="prose-quote text-base leading-relaxed">&ldquo;{h.body}&rdquo;</p>
                {h.page != null && (
                  <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">p. {h.page}</p>
                )}
              </div>
            </div>
          );
        }

        const n = item.entry;
        return (
          <div key={`n-${n.id}-${idx}`}>
            {chapterDivider}
            <div className="pl-3.5">
              {n.label && !chapterDivider && (
                <p className="text-xs font-medium text-[var(--muted-foreground)]">{n.label}</p>
              )}
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
              {n.page != null && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">p. {n.page}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
