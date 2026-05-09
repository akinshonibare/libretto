import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { ReactionsBar } from "@/components/reactions-bar";
import { ReportButton } from "@/components/report-button";
import { ReviewShareCard } from "@/components/review-share-card";
import { CopyLinkButton } from "@/components/copy-link-button";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { getSessionContext } from "@/lib/auth-helpers";
import type { HighlightRow, PublicReviewRow } from "@/lib/queries";

type ReactionRow = { kind: "star" | "this_hit" | "bookmark"; user_id: string };

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

type ReviewForShareRow = {
  id: string;
  user_id: string;
  status: PublicReviewRow["status"];
  rating: number | null;
  liked: boolean | null;
  why: string | null;
  synopsis: string | null;
  reading_mode: PublicReviewRow["reading_mode"];
  is_public: boolean;
  updated_at: string;
  book_title: string | null;
  book_author: string | null;
  book_cover_url: string | null;
  book_year: number | null;
  book_slug: string | null;
  author_handle: string | null;
  author_display_name: string | null;
};

async function loadReview(reviewId: string, token?: string) {
  const supabase = await createClient();

  // SECURITY DEFINER RPC: returns the review only if it's public, the caller is
  // the owner, or the supplied token matches a share-token row. This is what
  // makes share-token links work for *private* reviews — the regular SELECT
  // policy on `reviews` would otherwise block them.
  const { data: rows } = await supabase.rpc("review_for_share", {
    p_review_id: reviewId,
    p_token: token ?? null,
  });
  const review = (rows as ReviewForShareRow[] | null)?.[0];
  if (!review) return null;

  const { data: highlights } = await supabase.rpc("highlights_for_share", {
    p_review_id: reviewId,
    p_token: token ?? null,
  });

  // Re-shape into the existing PublicReviewRow / HighlightRow contracts.
  const reshapedReview: PublicReviewRow = {
    id: review.id,
    user_id: review.user_id,
    status: review.status,
    rating: review.rating,
    liked: review.liked,
    why: review.why,
    synopsis: review.synopsis,
    reading_mode: review.reading_mode,
    is_public: review.is_public,
    updated_at: review.updated_at,
    books: review.book_title
      ? {
          title: review.book_title,
          author: review.book_author,
          cover_url: review.book_cover_url,
          year: review.book_year,
          slug: review.book_slug ?? "",
        }
      : null,
    profiles: review.author_handle
      ? {
          handle: review.author_handle,
          display_name: review.author_display_name,
        }
      : null,
  };

  return {
    review: reshapedReview,
    highlights: ((highlights as HighlightRow[] | null) ?? []) as HighlightRow[],
  };
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

  const supabase = await createClient();
  const { user: viewer } = await getSessionContext();

  const { data: reactionRows } = await supabase
    .from("reactions")
    .select("kind, user_id")
    .eq("target_type", "review")
    .eq("target_id", review.id)
    .returns<ReactionRow[]>();

  const counts = { star: 0, this_hit: 0, bookmark: 0 };
  const active = { star: false, this_hit: false, bookmark: false };
  for (const r of reactionRows ?? []) {
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    if (viewer && r.user_id === viewer.id) active[r.kind] = true;
  }
  const canonicalPath = `/r/${review.id}${t ? `?t=${t}` : ""}`;

  const siteUrl = getSiteUrl();
  let siteHost = siteUrl.replace(/^https?:\/\//, "");
  siteHost = siteHost.replace(/\/$/, "");

  // Pick the longest highlight as the featured quote — usually the most worth pulling.
  const featuredQuote =
    highlights.length > 0
      ? [...highlights].sort((a, b) => b.body.length - a.body.length)[0].body
      : null;
  const otherHighlights = featuredQuote
    ? highlights.filter((h) => h.body !== featuredQuote)
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="label-eyebrow">@{author?.handle}&rsquo;s review</p>

        {!review.is_public && (
          <Badge variant="outline" className="mt-3 gap-1">
            <Lock className="size-3" /> Unlisted — visible only via this link
          </Badge>
        )}

        <div className="mt-4">
          <ReviewShareCard
            bookTitle={book?.title ?? "Untitled"}
            bookAuthor={book?.author ?? null}
            bookYear={book?.year ?? null}
            bookCoverUrl={book?.cover_url ?? null}
            rating={review.rating}
            readingModeLabel={MODE_LABEL[review.reading_mode] ?? review.reading_mode}
            statusLabel={STATUS_LABEL[review.status] ?? review.status}
            featuredQuote={featuredQuote}
            body={review.why}
            authorHandle={author?.handle ?? "reader"}
            authorDisplayName={author?.display_name ?? null}
            siteHost={siteHost}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <CopyLinkButton url={`${siteUrl}${canonicalPath}`} />
          <Link
            href={`/u/${author?.handle ?? ""}`}
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline-offset-4 hover:underline"
          >
            More from @{author?.handle} →
          </Link>
        </div>

        <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">
          One review, one beautiful card. <span className="text-[var(--foreground)]">{siteHost}{canonicalPath}</span>
        </p>

        {viewer && (
          <section className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-6">
            <ReactionsBar
              targetType="review"
              targetId={review.id}
              counts={counts}
              active={active}
              redirectTo={canonicalPath}
            />
            <ReportButton targetType="review" targetId={review.id} redirectTo={canonicalPath} />
          </section>
        )}

        {review.synopsis && (
          <section className="mt-10">
            <p className="label-eyebrow">Synopsis</p>
            <p className="mt-2 whitespace-pre-wrap leading-relaxed">{review.synopsis}</p>
          </section>
        )}

        {otherHighlights.length > 0 && (
          <section className="mt-10">
            <p className="label-eyebrow">More highlights</p>
            <div className="mt-3 space-y-4">
              {otherHighlights.map((h) => (
                <div key={h.id} className="marginalia-highlight">
                  <p className="prose-quote text-base leading-relaxed">&ldquo;{h.body}&rdquo;</p>
                  {h.page != null && (
                    <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">p. {h.page}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
