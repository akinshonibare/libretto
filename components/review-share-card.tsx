import { BookOpen } from "lucide-react";

/**
 * "Greenroom" share card — pulled from the design system bundle.
 * One review rendered as a beautiful, shareable artifact:
 *   cover + title + stars · divider · featured italic quote + body · divider · author bottom row.
 */

type Props = {
  bookTitle: string;
  bookAuthor: string | null;
  bookYear: number | null;
  bookCoverUrl: string | null;
  rating: number | null;
  readingModeLabel: string;
  statusLabel: string;
  featuredQuote: string | null;
  body: string | null; // typically the "why"
  authorHandle: string;
  authorDisplayName: string | null;
  siteHost: string;
};

export function ReviewShareCard({
  bookTitle,
  bookAuthor,
  bookYear,
  bookCoverUrl,
  rating,
  readingModeLabel,
  statusLabel,
  featuredQuote,
  body,
  authorHandle,
  authorDisplayName,
  siteHost,
}: Props) {
  const initial = (authorDisplayName ?? authorHandle).slice(0, 1).toUpperCase();

  return (
    <article
      className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_6px_24px_-8px_rgba(0,0,0,0.1)] sm:p-8"
    >
      <header className="flex gap-5">
        {bookCoverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bookCoverUrl}
            alt=""
            className="h-28 w-20 shrink-0 rounded-sm border border-[var(--border)] object-cover sm:h-32 sm:w-24"
          />
        ) : (
          <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--muted)] sm:h-32 sm:w-24">
            <BookOpen className="size-6 text-[var(--muted-foreground)]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-2xl tracking-tight leading-[1.05] sm:text-3xl">
            {bookTitle}
          </h1>
          {bookAuthor && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {bookAuthor}
              {bookYear ? ` · ${bookYear}` : ""}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center rounded-full border border-[var(--border)] px-2.5 py-0.5">
              {statusLabel}
            </span>
            <span className="inline-flex items-center rounded-full bg-[var(--secondary)] px-2.5 py-0.5 text-[var(--secondary-foreground)]">
              {readingModeLabel}
            </span>
            {rating ? (
              <span className="text-[var(--accent)]" aria-label={`${rating} out of 5 stars`}>
                {"★".repeat(rating)}
                <span className="text-[var(--muted-foreground)]/40">{"★".repeat(5 - rating)}</span>
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {(featuredQuote || body) && (
        <>
          <hr className="my-6 border-[var(--border)]" />
          {featuredQuote && (
            <p className="prose-quote text-lg leading-snug sm:text-xl">
              &ldquo;{featuredQuote}&rdquo;
            </p>
          )}
          {body && (
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed">{body}</p>
          )}
        </>
      )}

      <hr className="my-6 border-[var(--border)]" />

      <footer className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-heading text-xs font-semibold">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">@{authorHandle}</p>
            <p className="truncate text-[11px] text-[var(--muted-foreground)]">
              {siteHost}/u/{authorHandle}
            </p>
          </div>
        </div>
        <span className="font-heading text-xs font-semibold tracking-[0.04em] text-[var(--muted-foreground)]">
          Libretto
        </span>
      </footer>
    </article>
  );
}
