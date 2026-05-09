import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BookOpen, Lock, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ClubBookPicker } from "@/components/club-book-picker";
import { ClubInviteLink } from "@/components/club-invite-link";
import {
  joinClubAction,
  leaveClubAction,
  postClubMessageAction,
} from "@/app/actions/community";
import { requireUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type ClubInviteRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_private: boolean;
  current_book_id: string | null;
  created_at: string;
  book_title: string | null;
  book_author: string | null;
  book_cover_url: string | null;
  book_slug: string | null;
};

type ClubMemberInviteRow = {
  user_id: string;
  role: "owner" | "member";
  handle: string | null;
  display_name: string | null;
  joined_at: string;
};

type ClubMessageInviteRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  handle: string | null;
  display_name: string | null;
};

export default async function ClubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t: token } = await searchParams;
  const { profile } = await requireUser();
  const supabase = await createClient();

  // Resolve the club, honoring an invite token for private clubs.
  // RPC bypasses base RLS only when the token is valid (or you'd already
  // have read access via membership/ownership).
  const { data: clubs } = await supabase
    .rpc("club_for_invite", { p_slug: slug, p_token: token ?? null })
    .returns<ClubInviteRow[]>();
  const club = clubs?.[0];
  if (!club) notFound();

  const [
    { data: members },
    { data: messages },
    { data: ownLibraryRows },
    { data: existingInvite },
  ] = await Promise.all([
    supabase
      .rpc("club_members_for_invite", { p_club_id: club.id, p_token: token ?? null })
      .returns<ClubMemberInviteRow[]>(),
    supabase
      .rpc("club_messages_for_invite", { p_club_id: club.id, p_token: token ?? null })
      .returns<ClubMessageInviteRow[]>(),
    // Owner-only book picker — non-owners don't need this.
    supabase
      .from("reviews")
      .select("book_id")
      .eq("user_id", profile.id),
    // Try to read an existing invite token (owner-only via RLS; returns null otherwise).
    club.is_private
      ? supabase
          .from("club_invite_tokens")
          .select("token")
          .eq("club_id", club.id)
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null as { token: string } | null },
  ]);

  const ownLibrary = ownLibraryRows
    ? (
        await supabase
          .from("books")
          .select("id, title, author")
          .in(
            "id",
            ownLibraryRows.length
              ? ownLibraryRows.map((r) => r.book_id)
              : ["00000000-0000-0000-0000-000000000000"]
          )
          .order("title")
      ).data ?? []
    : [];

  const isMember = (members ?? []).some((m) => m.user_id === profile.id);
  const isOwner = club.owner_id === profile.id;
  const hasInviteAccess = !!token && club.is_private && !isMember && !isOwner;

  const book = club.book_title
    ? {
        title: club.book_title,
        author: club.book_author,
        cover_url: club.book_cover_url,
        slug: club.book_slug,
      }
    : null;

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/clubs"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4" /> Clubs
        </Link>

        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              {club.is_private && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="size-3" /> Private
                </Badge>
              )}
              <Badge variant="secondary" className="gap-1">
                <Users className="size-3" /> {members?.length ?? 0}
              </Badge>
            </div>
            <h1 className="mt-2 font-heading text-4xl tracking-tight">{club.name}</h1>
            {club.description && (
              <p className="mt-2 max-w-xl text-[var(--muted-foreground)]">{club.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {isOwner ? (
              <Badge variant="accent">Owner</Badge>
            ) : isMember ? (
              <form action={leaveClubAction}>
                <input type="hidden" name="clubId" value={club.id} />
                <input type="hidden" name="slug" value={club.slug} />
                <Button type="submit" variant="outline" size="sm">
                  Leave
                </Button>
              </form>
            ) : (
              <form action={joinClubAction}>
                <input type="hidden" name="clubId" value={club.id} />
                <input type="hidden" name="slug" value={club.slug} />
                {token && <input type="hidden" name="token" value={token} />}
                <Button type="submit" size="sm">
                  Join
                </Button>
              </form>
            )}
          </div>
        </header>

        {hasInviteAccess && (
          <p className="mt-4 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--muted-foreground)]">
            You&rsquo;re viewing this private club via an invite link. Hit Join to participate, or
            just read along.
          </p>
        )}

        {isOwner && club.is_private && (
          <div className="mt-4">
            <ClubInviteLink
              clubId={club.id}
              clubSlug={club.slug}
              siteUrl={getSiteUrl()}
              initialToken={existingInvite?.token ?? null}
            />
          </div>
        )}

        <Section title="Currently reading">
          {book ? (
            <Card>
              <CardContent className="flex gap-4 p-4">
                {book.cover_url ? (
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
                  {book.slug ? (
                    <Link href={`/b/${book.slug}`}>
                      <p className="font-heading text-xl">{book.title}</p>
                    </Link>
                  ) : (
                    <p className="font-heading text-xl">{book.title}</p>
                  )}
                  {book.author && (
                    <p className="text-sm text-[var(--muted-foreground)]">{book.author}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              No book picked yet.{isOwner ? " Pick one below." : ""}
            </p>
          )}
          {isOwner && (
            <ClubBookPicker
              clubId={club.id}
              slug={club.slug}
              currentBookId={club.current_book_id}
              books={ownLibrary}
            />
          )}
        </Section>

        <Section title="Discussion">
          {messages && messages.length > 0 ? (
            <ul className="max-h-[480px] space-y-3 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
              {messages.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="font-medium">@{m.handle}</span>
                  <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              No messages yet — say something.
            </p>
          )}

          {isMember && (
            <form action={postClubMessageAction} className="mt-3 space-y-2">
              <input type="hidden" name="clubId" value={club.id} />
              <input type="hidden" name="slug" value={club.slug} />
              <Textarea name="body" rows={2} placeholder="Share a thought…" required maxLength={2000} />
              <Button type="submit" size="sm">
                Post
              </Button>
            </form>
          )}
        </Section>

        <Section title="Members">
          <ul className="flex flex-wrap gap-2">
            {(members ?? []).map((m) => (
              <li key={m.user_id}>
                <Link
                  href={`/u/${m.handle ?? ""}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-sm hover:border-[var(--ring)]"
                >
                  @{m.handle}
                  {m.role === "owner" && <Badge variant="accent">Owner</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
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
