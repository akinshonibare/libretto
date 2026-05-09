import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import type { HighlightRow, PublicReviewRow } from "@/lib/queries";

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

async function loadReview(reviewId: string, token?: string) {
  const supabase = await createClient();
  const { data: review } = await supabase
    .from("reviews")
    .select(
      "id, user_id, status, rating, liked, why, synopsis, reading_mode, is_public, updated_at, books(title, author, cover_url, year, slug), profiles!reviews_user_id_fkey(handle, display_name)"
    )
    .eq("id", reviewId)
    .returns<PublicReviewRow[]>()
    .maybeSingle();

  if (!review) return null;

  // If public, allow. If private, allow only when a valid share token is provided.
  if (!review.is_public) {
    if (!token) return null;
    const { data: t } = await supabase
      .from("review_share_tokens")
      .select("token")
      .eq("token", token)
      .eq("review_id", reviewId)
      .maybeSingle();
    if (!t) return null;
  }

  const { data: highlights } = await supabase
    .from("highlights")
    .select("id, body, page, source, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true })
    .returns<HighlightRow[]>();

  return { review, highlights: highlights ?? [] };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { t } = await searchParams;
  const data = await loadReview(id, t);
  if (!data) return { title: "Review" };

  const { review } = data;
  const book = review.books;
  const author = review.profiles;
  const site = getSiteUrl();
  const title = book?.title ? `${book.title} — by @${author?.handle}` : "Review";
  const description = review.why
    ? review.why.slice(0, 200)
    : `Reading notes by @${author?.handle ?? ""}`;
  const ogUrl = `${site}/api/og/review/${review.id}${t ? `?t=${t}` : ""}`;
  const canonical = `${site}/r/${review.id}${t ? `?t=${t}` : ""}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
    alternates: { canonical },
  };
}

export default async function PublicReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  const data = await loadReview(id, t);
  if (!data) notFound();
  const { review, highlights } = data;
  const book = review.books;
  const author = review.profiles;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="font-heading text-2xl tracking-tight">
        Libretto
      </Link>

      <header className="mt-10 flex gap-6">
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
                <Lock className="size-3" /> Unlisted
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
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Notes by{" "}
            <Link href={`/u/${author?.handle ?? ""}`} className="font-medium hover:underline">
              @{author?.handle}
            </Link>
          </p>
        </div>
      </header>

      {review.why && (
        <section className="mt-8">
          <h2 className="font-heading text-xl mb-3">Why</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{review.why}</p>
        </section>
      )}
      {review.synopsis && (
        <section className="mt-8">
          <h2 className="font-heading text-xl mb-3">Synopsis</h2>
          <p className="whitespace-pre-wrap leading-relaxed">{review.synopsis}</p>
        </section>
      )}

      {highlights.length > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-xl mb-3">Highlights</h2>
          <ul className="space-y-3">
            {highlights.map((h) => (
              <li key={h.id}>
                <Card>
                  <CardContent className="p-4">
                    <p className="prose-quote text-base">&ldquo;{h.body}&rdquo;</p>
                    {h.page != null && (
                      <p className="mt-2 text-xs text-[var(--muted-foreground)]">p. {h.page}</p>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
