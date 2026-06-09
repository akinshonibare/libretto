import Link from "next/link";
import { Sparkles, Clock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BookFilter, type BookFilterOption } from "@/components/book-filter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-helpers";
import { gradeHighlightAction } from "@/app/actions/retention";

type ScheduleRow = {
  highlight_id: string;
  next_due_at: string;
  interval_days: number;
  ease: number;
  highlights: {
    id: string;
    body: string;
    page: number | null;
    review_id: string;
    reviews: {
      id: string;
      book_id: string;
      books: { id: string; title: string; author: string | null } | null;
    } | null;
  } | null;
};

type BookGroup = {
  book: { id: string; title: string; author: string | null };
  rows: ScheduleRow[];
};

/**
 * Group an ordered list of schedule rows by the book they belong to.
 * Order of first appearance is preserved — rows are already sorted by
 * due-soonest-first, so the group with the soonest highlight rises to the top.
 * Untitled / orphan books bucket under a synthetic "Untitled" group.
 */
function groupByBook(rows: ScheduleRow[]): BookGroup[] {
  const order: string[] = [];
  const groups = new Map<string, BookGroup>();
  for (const row of rows) {
    const b = row.highlights?.reviews?.books;
    const id = b?.id ?? "untitled";
    const title = b?.title ?? "Untitled";
    const author = b?.author ?? null;
    if (!groups.has(id)) {
      order.push(id);
      groups.set(id, { book: { id, title, author }, rows: [] });
    }
    groups.get(id)!.rows.push(row);
  }
  return order.map((id) => groups.get(id)!);
}

export const dynamic = "force-dynamic";

function formatDueRelative(dateIso: string): string {
  const now = Date.now();
  const due = new Date(dateIso).getTime();
  const diffMs = due - now;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `in ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days}d`;
}

type TodayPageProps = {
  searchParams: Promise<{ book?: string }>;
};

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const { book: bookParam } = await searchParams;

  const nowIso = new Date().toISOString();

  // Two queries: what's due now, and what's coming up next. Pull book_id on
  // reviews so we can filter and group below without a second join.
  const [{ data: dueRaw }, { data: upcomingRaw }] = await Promise.all([
    supabase
      .from("resurface_schedule")
      .select(
        "highlight_id, next_due_at, interval_days, ease, highlights(id, body, page, review_id, reviews(id, book_id, books(id, title, author)))"
      )
      .eq("user_id", profile.id)
      .lte("next_due_at", nowIso)
      .order("next_due_at", { ascending: true })
      .limit(60)
      .returns<ScheduleRow[]>(),
    supabase
      .from("resurface_schedule")
      .select(
        "highlight_id, next_due_at, interval_days, ease, highlights(id, body, page, review_id, reviews(id, book_id, books(id, title, author)))"
      )
      .eq("user_id", profile.id)
      .gt("next_due_at", nowIso)
      .order("next_due_at", { ascending: true })
      .limit(20)
      .returns<ScheduleRow[]>(),
  ]);

  const dueAll = (dueRaw ?? []).filter((r) => r.highlights);
  const upcomingAll = (upcomingRaw ?? []).filter((r) => r.highlights);

  // Books that appear in either list — the filter shows only books Paola
  // actually has something scheduled for, so it doesn't dump her whole
  // library in front of her every morning.
  const booksMap = new Map<string, BookFilterOption>();
  for (const row of [...dueAll, ...upcomingAll]) {
    const b = row.highlights?.reviews?.books;
    if (!b) continue;
    if (!booksMap.has(b.id))
      booksMap.set(b.id, { id: b.id, title: b.title, author: b.author });
  }
  const books = Array.from(booksMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  // No-param OR ?book=all → cross-book view.
  // Specific id → narrow to that book. Unknown id falls through to all.
  const selectedBookId =
    bookParam && bookParam !== "all" && booksMap.has(bookParam) ? bookParam : null;

  const matchesBook = (row: ScheduleRow) =>
    selectedBookId === null ||
    row.highlights?.reviews?.book_id === selectedBookId;

  const due = dueAll.filter(matchesBook);
  const upcoming = upcomingAll.filter(matchesBook);
  const dueGroups = groupByBook(due);
  const upcomingGroups = groupByBook(upcoming);
  const isFiltered = selectedBookId !== null;

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-[var(--accent)]" />
          <h1 className="font-heading text-3xl tracking-tight">Today&rsquo;s resurface</h1>
        </div>
        <p className="mt-2 text-[var(--muted-foreground)]">
          {due.length > 0
            ? `${due.length} ${due.length === 1 ? "highlight" : "highlights"} due${
                isFiltered ? "" : ""
              } — read, decide, move on.`
            : upcoming.length > 0
              ? "Nothing due yet — here's what's coming up."
              : isFiltered
                ? "Nothing scheduled for this book yet."
                : "Capture some highlights and they'll resurface here on a spaced-repetition schedule."}
        </p>

        {books.length > 1 && (
          <div className="mt-6">
            <BookFilter
              basePath="/today"
              options={books}
              selectedId={selectedBookId}
              label="Filter by book"
            />
          </div>
        )}

        {dueGroups.length > 0 && (
          <div className="mt-8 space-y-8">
            {dueGroups.map((group) => (
              <section key={`due-${group.book.id}`} aria-labelledby={`due-${group.book.id}-h`}>
                {/* Hide the per-book heading when filtered to a single book —
                    the page title + filter chip already say "this book". */}
                {!isFiltered && (
                  <header className="mb-3 flex items-baseline justify-between gap-3">
                    <h2
                      id={`due-${group.book.id}-h`}
                      className="font-heading text-xl tracking-tight"
                    >
                      {group.book.title}
                    </h2>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {group.book.author ?? ""}
                      {group.book.author && " · "}
                      {group.rows.length} due
                    </p>
                  </header>
                )}
                <ul className="space-y-4">
                  {group.rows.map((row) => {
                    const h = row.highlights!;
                    const review = h.reviews;
                    return (
                      <li key={row.highlight_id}>
                        <Card>
                          <CardContent className="space-y-4 p-5">
                            <p className="prose-quote text-lg leading-snug">
                              &ldquo;{h.body}&rdquo;
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              {h.page != null ? `p. ${h.page}` : "no page"}
                              <span className="mx-2">·</span>
                              Last interval {row.interval_days}d (ease{" "}
                              {row.ease.toFixed(2)})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {(["forgot", "familiar", "mastered"] as const).map(
                                (g) => (
                                  <form key={g} action={gradeHighlightAction}>
                                    <input
                                      type="hidden"
                                      name="highlightId"
                                      value={row.highlight_id}
                                    />
                                    <input type="hidden" name="grade" value={g} />
                                    <Button
                                      type="submit"
                                      size="sm"
                                      variant={g === "mastered" ? "default" : "outline"}
                                    >
                                      {g === "forgot"
                                        ? "Forgot"
                                        : g === "familiar"
                                          ? "Familiar"
                                          : "Mastered"}
                                    </Button>
                                  </form>
                                )
                              )}
                              {review && (
                                <Link
                                  href={`/library/${review.id}`}
                                  className="ml-auto self-center text-xs text-[var(--muted-foreground)] underline-offset-4 hover:underline"
                                >
                                  See review
                                </Link>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {upcomingGroups.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Clock className="size-4" />
              <h2 className="label-eyebrow">Coming up next</h2>
            </div>
            <div className="mt-3 space-y-6">
              {upcomingGroups.map((group) => (
                <div key={`up-${group.book.id}`}>
                  {!isFiltered && (
                    <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
                      {group.book.title}
                      {group.book.author ? ` · ${group.book.author}` : ""}
                    </p>
                  )}
                  <ul className="space-y-3">
                    {group.rows.map((row) => {
                      const h = row.highlights!;
                      return (
                        <li key={row.highlight_id}>
                          <Card>
                            <CardContent className="space-y-1 p-4">
                              <p className="prose-quote text-sm leading-snug line-clamp-2">
                                &ldquo;{h.body}&rdquo;
                              </p>
                              <p className="text-xs text-[var(--muted-foreground)]">
                                {h.page != null ? `p. ${h.page}` : "no page"}
                                <span className="mx-2">·</span>
                                Resurfaces {formatDueRelative(row.next_due_at)}
                              </p>
                            </CardContent>
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {due.length === 0 && upcoming.length === 0 && isFiltered && (
          <Card className="mt-8">
            <CardContent className="p-6 text-sm text-[var(--muted-foreground)]">
              Nothing due or upcoming for this book.{" "}
              <Link href="/today" className="underline-offset-4 hover:underline">
                See all books →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
