import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BookOpen, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-helpers";
import type { ChapterNoteRow, ReviewDetailRow } from "@/lib/queries";
import {
  addChapterNoteAction,
  deleteReviewAction,
} from "@/app/actions/reviews";

const STATUS_LABEL: Record<string, string> = {
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

const MODE_LABEL: Record<string, string> = {
  absorb: "Absorb",
  study: "Study",
  challenge: "Challenge",
  apply: "Apply",
  enjoy: "Enjoy",
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("reviews")
    .select(
      "id, user_id, status, rating, liked, why, synopsis, reading_mode, is_public, updated_at, books(title, author, cover_url, year, slug)"
    )
    .eq("id", reviewId)
    .returns<ReviewDetailRow[]>()
    .maybeSingle();

  if (!review || review.user_id !== profile.id) notFound();

  const book = review.books;

  const { data: notes } = await supabase
    .from("chapter_notes")
    .select("id, label, body, page, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true })
    .returns<ChapterNoteRow[]>();

  const deleteThis = deleteReviewAction.bind(null, reviewId);

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/library"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4" /> Library
        </Link>

        <header className="mt-6 flex gap-6">
          {book?.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt=""
              className="h-44 w-28 shrink-0 rounded-sm border border-[var(--border)] object-cover"
            />
          ) : (
            <div className="flex h-44 w-28 shrink-0 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--muted)]">
              <BookOpen className="size-6 text-[var(--muted-foreground)]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Badge variant="outline">{STATUS_LABEL[review.status] ?? review.status}</Badge>
              {review.rating && <Badge variant="accent">{"★".repeat(review.rating)}</Badge>}
              <Badge variant="secondary">{MODE_LABEL[review.reading_mode]}</Badge>
              {!review.is_public && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="size-3" /> Private
                </Badge>
              )}
            </div>
            <h1 className="mt-2 font-heading text-3xl tracking-tight">{book?.title ?? "Untitled"}</h1>
            {book?.author && (
              <p className="text-[var(--muted-foreground)]">
                {book.author}
                {book.year ? ` · ${book.year}` : ""}
              </p>
            )}
          </div>
        </header>

        {review.why && (
          <Section title="Why">
            <p className="whitespace-pre-wrap leading-relaxed">{review.why}</p>
          </Section>
        )}
        {review.synopsis && (
          <Section title="Synopsis">
            <p className="whitespace-pre-wrap leading-relaxed">{review.synopsis}</p>
          </Section>
        )}

        <Section title="Chapter notes">
          {notes && notes.length > 0 ? (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">{n.label || "Note"}</p>
                        {n.page != null && (
                          <p className="text-xs text-[var(--muted-foreground)]">p. {n.page}</p>
                        )}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">No notes yet — add the first one below.</p>
          )}

          <form action={addChapterNoteAction} className="mt-4 space-y-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
            <input type="hidden" name="reviewId" value={review.id} />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="label">Chapter / heading</Label>
                <Input id="label" name="label" placeholder="e.g. Ch. 4 — The Halls" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="page">Page</Label>
                <Input id="page" name="page" type="number" min={0} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Note</Label>
              <Textarea id="body" name="body" rows={3} placeholder="What stood out, a quote, a thought" required />
            </div>
            <Button type="submit" size="sm">
              Add note
            </Button>
          </form>
        </Section>

        <div className="mt-12 flex items-center justify-between border-t border-[var(--border)] pt-6">
          <p className="text-xs text-[var(--muted-foreground)]">
            Last updated {new Date(review.updated_at).toLocaleDateString()}
          </p>
          <form action={deleteThis}>
            <Button type="submit" variant="ghost" size="sm" className="text-[var(--destructive)]">
              Delete review
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-xl mb-3">{title}</h2>
      {children}
    </section>
  );
}
