import Link from "next/link";

/**
 * Server-rendered chip strip for filtering a page by book.
 *
 * Renders an "All books" pill followed by one chip per book the user has
 * relevant content for. Selection is encoded in the URL via ?book=<id> so
 * the surrounding page stays a server component and shareable links survive.
 *
 * `basePath` is the page path the chips link to ("/today", "/graph", etc).
 * `selectedId` is the currently active book id, or null for "All books".
 */
export type BookFilterOption = {
  id: string;
  title: string;
  author: string | null;
};

type Props = {
  basePath: string;
  options: BookFilterOption[];
  selectedId: string | null;
  /** Optional label rendered above the strip (e.g. "Filter by book"). */
  label?: string;
  /**
   * Href the "All books" chip points to. Defaults to basePath. Override
   * when the page treats "no query param" as something other than "all" —
   * e.g. /graph defaults to the most recent book, so its All chip needs
   * an explicit `?book=all` to opt into the cross-book view.
   */
  allHref?: string;
};

export function BookFilter({ basePath, options, selectedId, label, allHref }: Props) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-2">
      {label && (
        <p className="label-eyebrow text-xs text-[var(--muted-foreground)]">{label}</p>
      )}
      <div className="-mx-1 flex flex-wrap gap-2">
        <Chip href={allHref ?? basePath} active={selectedId === null}>
          All books
        </Chip>
        {options.map((b) => (
          <Chip
            key={b.id}
            href={`${basePath}?book=${b.id}`}
            active={selectedId === b.id}
            title={b.author ? `${b.title} · ${b.author}` : b.title}
          >
            {b.title}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
  title,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "rounded-full border border-[var(--accent)] bg-[var(--accent)]/15 px-3 py-1 text-xs font-medium text-[var(--foreground)]"
          : "rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
      }
    >
      {children}
    </Link>
  );
}
