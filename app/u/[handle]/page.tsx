import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import type { PublicProfileReviewRow } from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  reading: "Reading",
  finished: "Finished",
  dnf: "DNF",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle}`,
    description: `${handle}'s reading on Libretto`,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) notFound();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, status, rating, books(title, author, cover_url, slug)")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("updated_at", { ascending: false })
    .returns<PublicProfileReviewRow[]>();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <header>
          <p className="text-sm text-[var(--muted-foreground)]">@{profile.handle}</p>
          <h1 className="mt-1 font-heading text-4xl tracking-tight">
            {profile.display_name ?? profile.handle}
          </h1>
          {profile.bio && <p className="mt-2 text-[var(--muted-foreground)]">{profile.bio}</p>}
        </header>

      <h2 className="mt-10 font-heading text-xl">Public reading</h2>
      {!reviews || reviews.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">No public reviews yet.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => {
            const book = r.books;
            return (
              <li key={r.id}>
                <Link href={book?.slug ? `/b/${book.slug}` : "#"}>
                  <Card className="h-full transition-colors hover:border-[var(--ring)]">
                    <CardContent className="flex gap-4 p-4">
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
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                          {r.rating && <span>{"★".repeat(r.rating)}</span>}
                        </div>
                        <p className="mt-1.5 line-clamp-2 font-heading text-lg leading-tight">
                          {book?.title ?? "Untitled"}
                        </p>
                        {book?.author && (
                          <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{book.author}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
        )}
      </main>
    </div>
  );
}
