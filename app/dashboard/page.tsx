import Link from "next/link";
import { Flame, BookOpen, Heart, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth-helpers";
import { recomputeLibraryHeart, BADGE_ICONS } from "@/lib/retention";

export const dynamic = "force-dynamic";

type RecentReview = {
  id: string;
  updated_at: string;
  status: string;
  books: { title: string; author: string | null; cover_url: string | null } | null;
};

type BadgeWithMeta = {
  badge_id: string;
  awarded_at: string;
  badges: {
    id: string;
    name: string;
    description: string;
    icon: string;
  } | null;
};

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const heart = await recomputeLibraryHeart(supabase, profile.id);

  const nowIso = new Date().toISOString();
  const [
    { data: streak },
    { count: dueCount },
    { data: recent },
    { data: badgesEarned },
  ] = await Promise.all([
    supabase.from("streaks").select("current, longest, last_logged_date").eq("user_id", profile.id).maybeSingle(),
    supabase
      .from("resurface_schedule")
      .select("highlight_id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .lte("next_due_at", nowIso),
    supabase
      .from("reviews")
      .select("id, updated_at, status, books(title, author, cover_url)")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(5)
      .returns<RecentReview[]>(),
    supabase
      .from("user_badges")
      .select("badge_id, awarded_at, badges(id, name, description, icon)")
      .eq("user_id", profile.id)
      .order("awarded_at", { ascending: false })
      .limit(8)
      .returns<BadgeWithMeta[]>(),
  ]);

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="prose-quote text-base leading-snug">
          A small, humble place for the books you read.
        </p>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted-foreground)]">@{profile.handle}</p>
            <h1 className="mt-1 font-heading text-4xl tracking-tight">Welcome back</h1>
          </div>
          <Link href="/today" className="text-sm hover:underline underline-offset-4">
            Today&rsquo;s resurface →
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Flame className="size-5" />}
            label="Current streak"
            value={`${streak?.current ?? 0} day${(streak?.current ?? 0) === 1 ? "" : "s"}`}
            sub={`Longest: ${streak?.longest ?? 0}`}
          />
          <StatCard
            icon={<Heart className="size-5" />}
            label="Library Heart"
            value={`${heart.score} / 100`}
            sub={Object.entries(heart.components)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
          />
          <StatCard
            icon={<Sparkles className="size-5" />}
            label="Due today"
            value={`${dueCount ?? 0}`}
            sub={(dueCount ?? 0) > 0 ? "Open /today to resurface" : "Caught up"}
          />
        </div>

        <section className="mt-10">
          <h2 className="font-heading text-xl mb-3">Recent reading</h2>
          {recent && recent.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {recent.map((r) => {
                const book = r.books;
                return (
                  <li key={r.id}>
                    <Link href={`/library/${r.id}`}>
                      <Card className="transition-colors hover:border-[var(--ring)]">
                        <CardContent className="flex gap-3 p-3">
                          {book?.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={book.cover_url}
                              alt=""
                              className="h-16 w-11 shrink-0 rounded-sm border border-[var(--border)] object-cover"
                            />
                          ) : (
                            <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--muted)]">
                              <BookOpen className="size-4 text-[var(--muted-foreground)]" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <Badge variant="outline" className="text-[10px]">
                              {r.status}
                            </Badge>
                            <p className="mt-1 line-clamp-2 font-medium">{book?.title ?? "Untitled"}</p>
                            {book?.author && (
                              <p className="text-xs text-[var(--muted-foreground)]">{book.author}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">No books yet — head to /library to add one.</p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-heading text-xl mb-3">Badges</h2>
          {badgesEarned && badgesEarned.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {badgesEarned.map((b) => {
                const meta = b.badges;
                if (!meta) return null;
                const icon = BADGE_ICONS[meta.icon] ?? "✨";
                return (
                  <li key={b.badge_id} className="h-full">
                    <Card className="flex h-full">
                      <CardContent className="flex w-full flex-col gap-1 p-4">
                        <div className="text-2xl leading-none">{icon}</div>
                        <p className="mt-1 font-medium">{meta.name}</p>
                        <p className="text-xs text-[var(--muted-foreground)] line-clamp-3">
                          {meta.description}
                        </p>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              Earn your first badge — log a book, capture a highlight, finish a session.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          {icon} {label}
        </div>
        <p className="mt-2 font-heading text-3xl tracking-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-[var(--muted-foreground)] truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}
