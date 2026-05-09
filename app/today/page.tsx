import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-helpers";
import { gradeHighlightAction } from "@/app/actions/retention";

type DueRow = {
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
      books: { title: string; author: string | null } | null;
    } | null;
  } | null;
};

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("resurface_schedule")
    .select(
      "highlight_id, next_due_at, interval_days, ease, highlights(id, body, page, review_id, reviews(id, books(title, author)))"
    )
    .eq("user_id", profile.id)
    .lte("next_due_at", nowIso)
    .order("next_due_at", { ascending: true })
    .limit(20)
    .returns<DueRow[]>();

  const due = (data ?? []).filter((r) => r.highlights);

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-[var(--accent)]" />
          <h1 className="font-heading text-3xl tracking-tight">Today&rsquo;s resurface</h1>
        </div>
        <p className="mt-2 text-[var(--muted-foreground)]">
          {due.length === 0
            ? "All caught up. New highlights resurface as you capture them."
            : `${due.length} ${due.length === 1 ? "highlight" : "highlights"} due — read, decide, move on.`}
        </p>

        {due.length > 0 ? (
          <ul className="mt-8 space-y-4">
            {due.map((row) => {
              const h = row.highlights!;
              const review = h.reviews;
              const book = review?.books;
              return (
                <li key={row.highlight_id}>
                  <Card>
                    <CardContent className="space-y-4 p-5">
                      <p className="prose-quote text-lg leading-snug">&ldquo;{h.body}&rdquo;</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {book?.title ?? "Untitled"}
                        {book?.author ? ` · ${book.author}` : ""}
                        {h.page != null ? ` · p. ${h.page}` : ""}
                        <span className="mx-2">·</span>
                        Last interval {row.interval_days}d (ease {row.ease.toFixed(2)})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(["forgot", "familiar", "mastered"] as const).map((g) => (
                          <form key={g} action={gradeHighlightAction}>
                            <input type="hidden" name="highlightId" value={row.highlight_id} />
                            <input type="hidden" name="grade" value={g} />
                            <Button
                              type="submit"
                              size="sm"
                              variant={g === "mastered" ? "default" : "outline"}
                            >
                              {g === "forgot" ? "Forgot" : g === "familiar" ? "Familiar" : "Mastered"}
                            </Button>
                          </form>
                        ))}
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
        ) : null}
      </div>
    </AppShell>
  );
}
