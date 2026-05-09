import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BookOpen, Lock, PlayCircle, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShareMenu } from "@/components/share-menu";
import { PublicToggle } from "@/components/public-toggle";
import { SocraticChat } from "@/components/socratic-chat";
import { Marginalia } from "@/components/marginalia";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-helpers";
import { getSiteUrl } from "@/lib/site";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import type { ChapterNoteRow, HighlightRow, ReviewDetailRow } from "@/lib/queries";
import {
  addChapterNoteAction,
  deleteReviewAction,
} from "@/app/actions/reviews";
import { startSessionAction } from "@/app/actions/sessions";

const STATUS_LABEL: Record<string, string> = {
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

const MODES = [
  { id: "absorb", label: "Absorb" },
  { id: "study", label: "Study" },
  { id: "challenge", label: "Challenge" },
  { id: "apply", label: "Apply" },
  { id: "enjoy", label: "Enjoy" },
] as const;

const MODE_LABEL: Record<string, string> = Object.fromEntries(MODES.map((m) => [m.id, m.label]));

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: review }, { data: notes }, { data: highlights }, { data: chatHistory }] = await Promise.all([
    supabase
      .from("reviews")
      .select(
        "id, user_id, status, rating, liked, why, synopsis, reading_mode, is_public, updated_at, books(title, author, cover_url, year, slug)"
      )
      .eq("id", reviewId)
      .returns<ReviewDetailRow[]>()
      .maybeSingle(),
    supabase
      .from("chapter_notes")
      .select("id, label, body, page, created_at")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true })
      .returns<ChapterNoteRow[]>(),
    supabase
      .from("highlights")
      .select("id, body, page, source, created_at")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true })
      .returns<HighlightRow[]>(),
    supabase
      .from("chat_messages")
      .select("role, content")
      .eq("review_id", reviewId)
      .eq("user_id", profile.id)
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  if (!review || review.user_id !== profile.id) notFound();

  const book = review.books;
  const deleteThis = deleteReviewAction.bind(null, reviewId);
  const siteUrl = getSiteUrl();

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
            <div className="mt-4">
              <Link
                href={`/r/${review.id}`}
                className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Public view <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>
        </header>

        <Section title="Reading session">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-[var(--muted-foreground)]">
                Pick a mode and capture highlights as you read.
              </p>
              <form action={startSessionAction} className="mt-3 space-y-3">
                <input type="hidden" name="reviewId" value={review.id} />
                <div className="flex flex-wrap gap-2">
                  {MODES.map((m) => (
                    <label
                      key={m.id}
                      className="cursor-pointer rounded-full border border-[var(--border)] px-3 py-1 text-sm has-[:checked]:border-[var(--ring)] has-[:checked]:bg-[var(--accent)]/30"
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={m.id}
                        defaultChecked={review.reading_mode === m.id}
                        className="sr-only"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
                <Button type="submit">
                  <PlayCircle className="size-4" /> Start session
                </Button>
              </form>
            </CardContent>
          </Card>
        </Section>

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

        <Section title="Marginalia">
          <Marginalia
            highlights={highlights ?? []}
            notes={notes ?? []}
            emptyMessage="No marginalia yet — start a session above to capture highlights, or add a chapter note below."
          />

          <form action={addChapterNoteAction} className="mt-6 space-y-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
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

        <Section title="Socratic chat">
          <SocraticChat
            reviewId={review.id}
            initialMode={review.reading_mode}
            configured={isAnthropicConfigured()}
            initialMessages={(chatHistory ?? [])
              .filter((m): m is { role: "user" | "assistant"; content: string } =>
                m.role === "user" || m.role === "assistant"
              )
              .map((m) => ({ role: m.role, content: m.content }))}
          />
        </Section>

        <Section title="Share">
          <div className="space-y-4 rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
            <PublicToggle reviewId={review.id} initialIsPublic={review.is_public} />
            <ShareMenu
              reviewId={review.id}
              isPublic={review.is_public}
              siteUrl={siteUrl}
              bookTitle={book?.title ?? "Untitled"}
              authorHandle={profile.handle}
            />
          </div>
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
