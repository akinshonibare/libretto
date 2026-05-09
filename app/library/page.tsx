import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-helpers";
import type { LibraryReviewRow } from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  reading: "Reading",
  finished: "Finished",
  dnf: "Did not finish",
};

export default async function LibraryPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, status, rating, liked, reading_mode, is_public, updated_at, books(title, author, cover_url, slug)")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false })
    .returns<LibraryReviewRow[]>();

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-4xl tracking-tight">Your library</h1>
            <p className="mt-1 text-[var(--muted-foreground)]">
              Books you&rsquo;re reading, finished, or filed away.
            </p>
          </div>
          <Link href="/library/new">
            <Button>
              <Plus className="size-4" /> Add a book
            </Button>
          </Link>
        </div>

        {!reviews || reviews.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => {
              const book = r.books;
              return (
                <li key={r.id}>
                  <Link href={`/library/${r.id}`} className="block focus:outline-none">
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
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                            <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                            {r.rating && <span>{"★".repeat(r.rating)}</span>}
                            {!r.is_public && <Badge variant="secondary">Private</Badge>}
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
