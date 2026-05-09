import Link from "next/link";
import { BookOpen, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  reading: "Reading",
  finished: "Finished",
  dnf: "DNF",
};

type FeedRow = {
  id: string;
  status: string;
  rating: number | null;
  why: string | null;
  updated_at: string;
  reading_mode: string;
  books: { title: string; author: string | null; cover_url: string | null; slug: string } | null;
  profiles: { handle: string; display_name: string | null } | null;
};

export default async function FeedPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: follows } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", profile.id);

  const followeeIds = (follows ?? []).map((f) => f.followee_id);

  const { data: reviews } =
    followeeIds.length === 0
      ? { data: [] }
      : await supabase
          .from("reviews")
          .select(
            "id, status, rating, why, reading_mode, updated_at, books(title, author, cover_url, slug), profiles!reviews_user_id_fkey(handle, display_name)"
          )
          .in("user_id", followeeIds)
          .eq("is_public", true)
          .order("updated_at", { ascending: false })
          .limit(40)
          .returns<FeedRow[]>();

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-[var(--accent)]" />
          <h1 className="font-heading text-4xl tracking-tight">Feed</h1>
        </div>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Public reviews from the readers you follow.
        </p>

        {followeeIds.length === 0 ? (
          <EmptyState
            title="You're not following anyone yet"
            body="Find a reader, hit follow, and their public reviews will surface here."
            cta={
              <Link href="/clubs">
                <Button variant="outline" size="sm">
                  Browse clubs
                </Button>
              </Link>
            }
          />
        ) : !reviews || reviews.length === 0 ? (
          <EmptyState
            title="Quiet on the feed"
            body="The people you follow haven't published anything new yet."
          />
        ) : (
          <ul className="mt-8 space-y-4">
            {reviews.map((r) => {
              const book = r.books;
              const author = r.profiles;
              return (
                <li key={r.id}>
                  <Card>
                    <CardContent className="flex gap-4 p-4">
                      {book?.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.cover_url}
                          alt=""
                          className="h-28 w-20 shrink-0 rounded-sm border border-[var(--border)] object-cover"
                        />
                      ) : (
                        <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--muted)]">
                          <BookOpen className="size-5 text-[var(--muted-foreground)]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2 text-xs">
                          <Link
                            href={`/u/${author?.handle ?? ""}`}
                            className="font-medium hover:underline"
                          >
                            @{author?.handle}
                          </Link>
                          <Badge variant="outline">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                          {r.rating && <Badge variant="accent">{"★".repeat(r.rating)}</Badge>}
                          <span className="text-[var(--muted-foreground)]">
                            {new Date(r.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                        <Link href={`/r/${r.id}`} className="mt-1.5 block">
                          <p className="font-heading text-xl leading-tight line-clamp-2">
                            {book?.title ?? "Untitled"}
                          </p>
                        </Link>
                        {book?.author && (
                          <p className="text-sm text-[var(--muted-foreground)]">{book.author}</p>
                        )}
                        {r.why && (
                          <p className="mt-2 line-clamp-3 text-sm leading-relaxed">{r.why}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <Card className="mt-10">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <h2 className="font-heading text-2xl">{title}</h2>
        <p className="max-w-sm text-sm text-[var(--muted-foreground)]">{body}</p>
        {cta}
      </CardContent>
    </Card>
  );
}
