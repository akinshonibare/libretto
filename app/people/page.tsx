import Link from "next/link";
import { Search, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/follow-button";
import { requireUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
};

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { profile } = await requireUser();
  const { q: rawQuery } = await searchParams;
  const query = (rawQuery ?? "").trim().slice(0, 64);
  const supabase = await createClient();

  // Pull who the viewer already follows so the result list shows accurate buttons.
  const { data: follows } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", profile.id);
  const followedSet = new Set((follows ?? []).map((f) => f.followee_id));

  let results: ProfileRow[] = [];
  if (query.length > 0) {
    // Search by handle prefix OR display name substring (case-insensitive).
    // Strip a leading "@" if the user typed it.
    const term = query.replace(/^@/, "");
    const { data } = await supabase
      .from("profiles")
      .select("id, handle, display_name, bio")
      .or(`handle.ilike.${term}%,display_name.ilike.%${term}%`)
      .neq("id", profile.id)
      .order("handle", { ascending: true })
      .limit(40)
      .returns<ProfileRow[]>();
    results = data ?? [];
  }

  // No-query state: surface the most recently active public reviewers as a
  // "people you might enjoy" list.
  const suggestions: ProfileRow[] = [];
  if (query.length === 0) {
    const { data } = await supabase
      .from("reviews")
      .select("user_id, profiles!reviews_user_id_fkey(id, handle, display_name, bio)")
      .eq("is_public", true)
      .neq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(40)
      .returns<
        Array<{
          user_id: string;
          profiles: ProfileRow | null;
        }>
      >();
    const seen = new Set<string>();
    for (const row of data ?? []) {
      if (!row.profiles) continue;
      if (seen.has(row.profiles.id)) continue;
      seen.add(row.profiles.id);
      suggestions.push(row.profiles);
      if (suggestions.length >= 12) break;
    }
  }

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-[var(--accent)]" />
          <h1 className="font-heading text-4xl tracking-tight">Find readers</h1>
        </div>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Search by handle or name. Follow someone to see their public reviews on your feed.
        </p>

        <form className="mt-6 flex gap-2" method="GET">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <Input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="@handle or name"
              className="pl-9"
              autoFocus
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        {query.length > 0 ? (
          <ResultList
            heading={`Results for "${query}"`}
            people={results}
            followedSet={followedSet}
            empty="No matches. Try a different handle or name."
          />
        ) : (
          <ResultList
            heading="Recently active readers"
            people={suggestions}
            followedSet={followedSet}
            empty="No public reviewers yet."
          />
        )}
      </div>
    </AppShell>
  );
}

function ResultList({
  heading,
  people,
  followedSet,
  empty,
}: {
  heading: string;
  people: ProfileRow[];
  followedSet: Set<string>;
  empty: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="label-eyebrow">{heading}</h2>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {people.map((p) => (
            <li key={p.id}>
              <Card>
                <CardContent className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${p.handle}`}
                      className="font-medium hover:underline"
                    >
                      @{p.handle}
                    </Link>
                    {p.display_name && p.display_name !== p.handle && (
                      <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                        {p.display_name}
                      </span>
                    )}
                    {p.bio && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">
                        {p.bio}
                      </p>
                    )}
                  </div>
                  <FollowButton
                    targetUserId={p.id}
                    targetHandle={p.handle}
                    isFollowing={followedSet.has(p.id)}
                    isSelf={false}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
