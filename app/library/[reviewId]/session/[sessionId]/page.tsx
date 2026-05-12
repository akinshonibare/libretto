import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BookOpen, StopCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EditableHighlight } from "@/components/editable-highlight";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-helpers";
import { addHighlightAction } from "@/app/actions/highlights";
import { addChapterNoteAction } from "@/app/actions/reviews";
import { endSessionAction } from "@/app/actions/sessions";
import type { HighlightRow, ReviewDetailRow, SessionRow } from "@/lib/queries";

const MODE_LABEL: Record<string, { label: string; hint: string }> = {
  absorb: { label: "Absorb", hint: "Soak it in." },
  study: { label: "Study", hint: "Exam-style probing." },
  challenge: { label: "Challenge", hint: "Push back." },
  apply: { label: "Apply", hint: "Use it." },
  enjoy: { label: "Enjoy", hint: "For fun." },
};

export default async function SessionPage({
  params,
}: {
  params: Promise<{ reviewId: string; sessionId: string }>;
}) {
  const { reviewId, sessionId } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: review }, { data: session }, { data: highlights }] = await Promise.all([
    supabase
      .from("reviews")
      .select(
        "id, user_id, status, rating, liked, why, synopsis, reading_mode, is_public, updated_at, books(title, author, cover_url, year, slug)"
      )
      .eq("id", reviewId)
      .returns<ReviewDetailRow[]>()
      .maybeSingle(),
    supabase
      .from("reading_sessions")
      .select("id, mode, started_at, ended_at, duration_seconds")
      .eq("id", sessionId)
      .returns<SessionRow[]>()
      .maybeSingle(),
    supabase
      .from("highlights")
      .select("id, body, page, source, created_at")
      .eq("review_id", reviewId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .returns<HighlightRow[]>(),
  ]);

  if (!review || review.user_id !== profile.id || !session) notFound();
  const book = review.books;
  const mode = MODE_LABEL[session.mode] ?? MODE_LABEL.enjoy;
  const isLive = !session.ended_at;

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href={`/library/${reviewId}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4" /> Back to review
        </Link>

        <header className="mt-6 flex items-start gap-4">
          {book?.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt=""
              className="h-20 w-14 shrink-0 rounded-sm border border-[var(--border)] object-cover"
            />
          ) : (
            <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--muted)]">
              <BookOpen className="size-5 text-[var(--muted-foreground)]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Badge variant={isLive ? "accent" : "secondary"}>{mode.label}</Badge>
              <span className="text-xs text-[var(--muted-foreground)]">{mode.hint}</span>
              {!isLive && <Badge variant="outline">Ended</Badge>}
            </div>
            <h1 className="mt-1 font-heading text-2xl tracking-tight">{book?.title ?? "Untitled"}</h1>
            {book?.author && (
              <p className="text-sm text-[var(--muted-foreground)]">{book.author}</p>
            )}
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Started {new Date(session.started_at).toLocaleString()}
            </p>
          </div>
        </header>

        {isLive && (
          <>
            <section className="mt-8 space-y-3">
              <h2 className="font-heading text-xl">Capture a highlight</h2>
              <form action={addHighlightAction} className="space-y-3">
                <input type="hidden" name="reviewId" value={reviewId} />
                <input type="hidden" name="sessionId" value={sessionId} />
                <Textarea
                  name="body"
                  rows={3}
                  placeholder="A passage, a quote, an idea…"
                  required
                />
                <div className="flex items-center gap-3">
                  <div className="w-24 space-y-1.5">
                    <Label htmlFor="page">Page</Label>
                    <Input id="page" name="page" type="number" min={0} />
                  </div>
                  <div className="ml-auto">
                    <Button type="submit">Save</Button>
                  </div>
                </div>
              </form>
            </section>

            <section className="mt-8 space-y-3">
              <h2 className="font-heading text-xl">Add a chapter note</h2>
              <form action={addChapterNoteAction} className="space-y-3">
                <input type="hidden" name="reviewId" value={reviewId} />
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
                <Textarea name="body" rows={3} placeholder="What stood out, a thought" required />
                <Button type="submit">Save note</Button>
              </form>
            </section>
          </>
        )}

        <section className="mt-10">
          <h2 className="font-heading text-xl mb-3">
            Highlights this session ({highlights?.length ?? 0})
          </h2>
          {highlights && highlights.length > 0 ? (
            <ul className="space-y-3">
              {highlights.map((h) => (
                <li key={h.id}>
                  <EditableHighlight
                    id={h.id}
                    reviewId={reviewId}
                    body={h.body}
                    page={h.page}
                    variant="card"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">Nothing yet — add the first one.</p>
          )}
        </section>

        {isLive && (
          <form action={endSessionAction} className="mt-10 border-t border-[var(--border)] pt-6">
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <Button type="submit" variant="outline">
              <StopCircle className="size-4" /> End session
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
