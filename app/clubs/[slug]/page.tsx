import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, BookOpen, Lock, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ClubBookPicker } from "@/components/club-book-picker";
import {
  joinClubAction,
  leaveClubAction,
  postClubMessageAction,
} from "@/app/actions/community";
import { requireUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ClubRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_private: boolean;
  current_book_id: string | null;
  books: { title: string; author: string | null; cover_url: string | null; slug: string } | null;
};

type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { handle: string; display_name: string | null } | null;
};

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: club } = await supabase
    .from("clubs")
    .select(
      "id, slug, name, description, owner_id, is_private, current_book_id, books(title, author, cover_url, slug)"
    )
    .eq("slug", slug)
    .returns<ClubRow[]>()
    .maybeSingle();

  if (!club) notFound();

  const [{ data: members }, { data: messages }, { data: ownLibrary }] = await Promise.all([
    supabase
      .from("club_members")
      .select("user_id, role, profiles!club_members_user_id_fkey(handle, display_name)")
      .eq("club_id", club.id)
      .order("joined_at", { ascending: true })
      .returns<
        Array<{
          user_id: string;
          role: "owner" | "member";
          profiles: { handle: string; display_name: string | null } | null;
        }>
      >(),
    supabase
      .from("club_messages")
      .select("id, body, created_at, user_id, profiles!club_messages_user_id_fkey(handle, display_name)")
      .eq("club_id", club.id)
      .order("created_at", { ascending: true })
      .limit(200)
      .returns<MessageRow[]>(),
    supabase
      .from("books")
      .select("id, title, author")
      .in(
        "id",
        (
          await supabase.from("reviews").select("book_id").eq("user_id", profile.id)
        ).data?.map((r) => r.book_id) ?? ["00000000-0000-0000-0000-000000000000"]
      )
      .order("title")
      .returns<Array<{ id: string; title: string; author: string | null }>>(),
  ]);

  const isMember = (members ?? []).some((m) => m.user_id === profile.id);
  const isOwner = club.owner_id === profile.id;
  const book = club.books;

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
                <Button type="submit" size="sm">
                  Join
                </Button>
              </form>
            )}
          </div>
        </header>

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
                  <Link href={`/b/${book.slug}`}>
                    <p className="font-heading text-xl">{book.title}</p>
                  </Link>
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
              books={ownLibrary ?? []}
            />
          )}
        </Section>

        <Section title="Discussion">
          {messages && messages.length > 0 ? (
            <ul className="max-h-[480px] space-y-3 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
              {messages.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="font-medium">@{m.profiles?.handle}</span>
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
                  href={`/u/${m.profiles?.handle ?? ""}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-3 py-1 text-sm hover:border-[var(--ring)]"
                >
                  @{m.profiles?.handle}
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
