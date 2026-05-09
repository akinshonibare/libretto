import Link from "next/link";
import { Plus, BookOpen, Flame } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-helpers";
import type { LibraryHighlightTeaser, LibraryReviewRow } from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  reading: "Reading",
  finished: "Finished",
  dnf: "DNF",
};

const MODE_LABEL: Record<string, string> = {
  absorb: "Absorb",
  study: "Study",
  challenge: "Challenge",
  apply: "Apply",
  enjoy: "Enjoy",
};

const TODAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export default async function LibraryPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      "id, status, rating, liked, reading_mode, is_public, updated_at, books(title, author, cover_url, slug)"
    )
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false })
    .returns<LibraryReviewRow[]>();

  // Pull the streak + a single recent highlight per review for the teaser.
  const reviewIds = (reviews ?? []).map((r) => r.id);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: streak }, { data: latestHighlights }, { count: highlightsThisWeek }] = await Promise.all([
    supabase.from("streaks").select("current").eq("user_id", profile.id).maybeSingle(),
    reviewIds.length === 0
      ? { data: [] as LibraryHighlightTeaser[] }
      : supabase
          .from("highlights")
          .select("review_id, body, created_at")
          .in("review_id", reviewIds)
          .order("created_at", { ascending: false })
          .returns<LibraryHighlightTeaser[]>(),
    reviewIds.length === 0
      ? { count: 0 }
      : supabase
          .from("highlights")
          .select("id", { count: "exact", head: true })
          .in("review_id", reviewIds)
          .gte("created_at", sevenDaysAgo),
  ]);

  // Map review_id -> first/most-recent highlight body.
  const teaserByReview = new Map<string, string>();
  for (const h of latestHighlights ?? []) {
    if (!teaserByReview.has(h.review_id)) teaserByReview.set(h.review_id, h.body);
  }

  const today = TODAY_FORMATTER.format(new Date());
  const streakCount = streak?.current ?? 0;

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-eyebrow">{today}</p>
            <h1 className="mt-2 font-heading text-4xl tracking-tight">Currently reading</h1>
          </div>
          <Link href="/library/new">
            <Button>
              <Plus className="size-4" /> Add a book
            </Button>
          </Link>
        </div>

        {(streakCount > 0 || (highlightsThisWeek ?? 0) > 0) && (
          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Flame className="size-3.5" />
            <span>
              {streakCount > 0 && (
                <strong className="font-semibold text-[var(--foreground)]">
                  {streakCount}-day streak
                </strong>
              )}
              {streakCount > 0 && (highlightsThisWeek ?? 0) > 0 && " · "}
              {(highlightsThisWeek ?? 0) > 0 &&
                `${highlightsThisWeek} highlight${highlightsThisWeek === 1 ? "" : "s"} this week`}
            </span>
          </div>
        )}

        {!reviews || reviews.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => {
              const book = r.books;
              const teaser = teaserByReview.get(r.id);
              return (
                <li key={r.id} className="h-full">
                  <Link
                    href={`/library/${r.id}`}
                    className="block h-full focus:outline-none"
                  >
                    <Card className="flex h-full transition-colors hover:border-[var(--ring)]">
                      <CardContent className="flex w-full gap-4 p-4">
                        {book?.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={book.cover_url}
                            alt=""
                            className="h-24 w-16 shrink-0 rounded-sm border border-[var(--border)] object-cover"
                          />
                        ) : (
                          <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--muted)]">
                            <BookOpen className="size-5 text-[var(--muted-foreground)]" />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                            <Badge variant="secondary">{MODE_LABEL[r.reading_mode]}</Badge>
                            {r.rating && (
                              <span className="text-[var(--muted-foreground)]">
                                {"★".repeat(r.rating)}
                              </span>
                            )}
                            {!r.is_public && <Badge variant="outline">Private</Badge>}
                          </div>
                          <p className="mt-1.5 line-clamp-2 font-heading text-lg leading-tight">
                            {book?.title ?? "Untitled"}
                          </p>
                          {book?.author && (
                            <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{book.author}</p>
                          )}
                          <div className="mt-auto pt-2">
                            {teaser ? (
                              <p className="prose-quote line-clamp-2 text-sm leading-snug">
                                &ldquo;{teaser}&rdquo;
                              </p>
                            ) : (
                              <p className="text-xs text-[var(--muted-foreground)] italic">
                                No highlights yet.
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState() {
  return (
    <Card className="mt-8">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <BookOpen className="size-8 text-[var(--muted-foreground)]" />
        <h2 className="font-heading text-2xl">Your library is empty</h2>
        <p className="max-w-sm text-sm text-[var(--muted-foreground)]">
          Add your first book — search OpenLibrary or enter the details by hand.
        </p>
        <Link href="/library/new">
          <Button>
            <Plus className="size-4" /> Add a book
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
