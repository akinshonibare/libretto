import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import type { BookPageReviewRow } from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  reading: "Reading",
  finished: "Finished",
  dnf: "DNF",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: book } = await supabase.from("books").select("title, author").eq("slug", slug).maybeSingle();
  if (!book) return { title: "Book" };
  return {
    title: book.title,
    description: book.author ? `Reviews of ${book.title} by ${book.author}` : undefined,
  };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: book } = await supabase
    .from("books")
    .select("id, title, author, cover_url, year, synopsis")
    .eq("slug", slug)
    .maybeSingle();

  if (!book) notFound();

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      "id, status, rating, why, reading_mode, profiles!reviews_user_id_fkey(handle, display_name)"
    )
    .eq("book_id", book.id)
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .returns<BookPageReviewRow[]>();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <header className="flex gap-6">
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_url}
            alt=""
            className="h-48 w-32 shrink-0 rounded-sm border border-[var(--border)] object-cover"
          />
        ) : (
          <div className="flex h-48 w-32 shrink-0 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--muted)]">
            <BookOpen className="size-6 text-[var(--muted-foreground)]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-4xl tracking-tight">{book.title}</h1>
          {book.author && (
            <p className="mt-1 text-[var(--muted-foreground)]">
              {book.author}
              {book.year ? ` · ${book.year}` : ""}
            </p>
          )}
          {book.synopsis && <p className="mt-4 leading-relaxed">{book.synopsis}</p>}
        </div>
        </header>

        <h2 className="mt-10 font-heading text-xl">Reviews</h2>
        {!reviews || reviews.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">No public reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reviews.map((r) => {
              const author = r.profiles;
              return (
                <li key={r.id}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <Link
                          href={`/u/${author?.handle ?? ""}`}
                          className="font-medium hover:underline"
                        >
                          @{author?.handle}
                        </Link>
                        <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                        {r.rating && <Badge variant="accent">{"★".repeat(r.rating)}</Badge>}
                      </div>
                      {r.why && <p className="mt-3 whitespace-pre-wrap leading-relaxed">{r.why}</p>}
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
