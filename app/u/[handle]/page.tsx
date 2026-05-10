import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { FollowButton } from "@/components/follow-button";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth-helpers";
import type { Metadata } from "next";
import type { PublicProfileReviewRow } from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  reading: "Reading",
  finished: "Finished",
  dnf: "DNF",
};

type ProfileSummary = {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
};

type ProfileTab = "reviews" | "followers" | "following";

function parseTab(value: string | undefined): ProfileTab {
  return value === "followers" || value === "following" ? value : "reviews";
}

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
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { handle } = await params;
  const { tab: rawTab } = await searchParams;
  const activeTab = parseTab(rawTab);
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) notFound();

  const { user: viewer } = await getSessionContext();
  const isSelf = viewer?.id === profile.id;

  const [
    { data: reviews },
    { data: followCheck },
    { count: followerCount },
    { count: followingCount },
    { data: followerRows },
    { data: followingRows },
    { data: viewerFollows },
  ] = await Promise.all([
    activeTab === "reviews"
      ? supabase
          .from("reviews")
          .select("id, status, rating, books(title, author, cover_url, slug)")
          .eq("user_id", profile.id)
          .eq("is_public", true)
          .order("updated_at", { ascending: false })
          .returns<PublicProfileReviewRow[]>()
      : Promise.resolve({ data: null }),
    viewer && !isSelf
      ? supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", viewer.id)
          .eq("followee_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followee_id", profile.id),
    supabase
      .from("follows")
      .select("followee_id", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    activeTab === "followers"
      ? supabase
          .from("follows")
          .select("created_at, profiles!follows_follower_id_fkey(id, handle, display_name, bio)")
          .eq("followee_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(100)
          .returns<Array<{ created_at: string; profiles: ProfileSummary | null }>>()
      : Promise.resolve({ data: null }),
    activeTab === "following"
      ? supabase
          .from("follows")
          .select("created_at, profiles!follows_followee_id_fkey(id, handle, display_name, bio)")
          .eq("follower_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(100)
          .returns<Array<{ created_at: string; profiles: ProfileSummary | null }>>()
      : Promise.resolve({ data: null }),
    viewer && activeTab !== "reviews"
      ? supabase.from("follows").select("followee_id").eq("follower_id", viewer.id)
      : Promise.resolve({ data: null }),
  ]);

  const isFollowing = !!followCheck;
  const viewerFollowSet = new Set((viewerFollows ?? []).map((f) => f.followee_id));
  const followers = (followerRows ?? [])
    .map((row) => row.profiles)
    .filter((p): p is ProfileSummary => !!p);
  const following = (followingRows ?? [])
    .map((row) => row.profiles)
    .filter((p): p is ProfileSummary => !!p);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">@{profile.handle}</p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight">
              {profile.display_name ?? profile.handle}
            </h1>
            {profile.bio && <p className="mt-2 text-[var(--muted-foreground)]">{profile.bio}</p>}
            <p className="mt-3 flex gap-3 text-xs text-[var(--muted-foreground)]">
              <Link
                href={`/u/${profile.handle}?tab=followers`}
                className="hover:text-[var(--foreground)] hover:underline"
              >
                {followerCount ?? 0} follower{(followerCount ?? 0) === 1 ? "" : "s"}
              </Link>
              <span aria-hidden>·</span>
              <Link
                href={`/u/${profile.handle}?tab=following`}
                className="hover:text-[var(--foreground)] hover:underline"
              >
                {followingCount ?? 0} following
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSelf && (
              <Link href="/settings">
                <Button size="sm" variant="outline">
                  <Settings className="size-4" /> Edit profile
                </Button>
              </Link>
            )}
            {viewer && (
              <FollowButton
                targetUserId={profile.id}
                targetHandle={profile.handle}
                isFollowing={isFollowing}
                isSelf={isSelf}
              />
            )}
          </div>
        </header>

        <ProfileTabs
          handle={profile.handle}
          active={activeTab}
          followerCount={followerCount ?? 0}
          followingCount={followingCount ?? 0}
        />

        {activeTab === "reviews" && (
          <>
            {!reviews || reviews.length === 0 ? (
              <p className="mt-6 text-sm text-[var(--muted-foreground)]">No public reviews yet.</p>
            ) : (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </>
        )}

        {activeTab === "followers" && (
          <PeopleList
            people={followers}
            viewerId={viewer?.id ?? null}
            viewerFollowSet={viewerFollowSet}
            empty={
              isSelf
                ? "No one follows you yet."
                : `@${profile.handle} doesn't have any followers yet.`
            }
          />
        )}

        {activeTab === "following" && (
          <PeopleList
            people={following}
            viewerId={viewer?.id ?? null}
            viewerFollowSet={viewerFollowSet}
            empty={
              isSelf
                ? "You're not following anyone yet."
                : `@${profile.handle} isn't following anyone yet.`
            }
          />
        )}
      </main>
    </div>
  );
}

function ProfileTabs({
  handle,
  active,
  followerCount,
  followingCount,
}: {
  handle: string;
  active: ProfileTab;
  followerCount: number;
  followingCount: number;
}) {
  const tabs: Array<{ value: ProfileTab; label: string; href: string }> = [
    { value: "reviews", label: "Public reading", href: `/u/${handle}` },
    {
      value: "followers",
      label: `Followers (${followerCount})`,
      href: `/u/${handle}?tab=followers`,
    },
    {
      value: "following",
      label: `Following (${followingCount})`,
      href: `/u/${handle}?tab=following`,
    },
  ];

  return (
    <nav
      aria-label="Profile sections"
      className="mt-10 flex gap-1 border-b border-[var(--border)]"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors " +
              (isActive
                ? "border-[var(--foreground)] font-medium text-[var(--foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function PeopleList({
  people,
  viewerId,
  viewerFollowSet,
  empty,
}: {
  people: ProfileSummary[];
  viewerId: string | null;
  viewerFollowSet: Set<string>;
  empty: string;
}) {
  if (people.length === 0) {
    return <p className="mt-6 text-sm text-[var(--muted-foreground)]">{empty}</p>;
  }

  return (
    <ul className="mt-6 space-y-3">
      {people.map((p) => (
        <li key={p.id}>
          <Card>
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <Link href={`/u/${p.handle}`} className="font-medium hover:underline">
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
              {viewerId && (
                <FollowButton
                  targetUserId={p.id}
                  targetHandle={p.handle}
                  isFollowing={viewerFollowSet.has(p.id)}
                  isSelf={viewerId === p.id}
                />
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
