import Link from "next/link";
import { Plus, Users, Lock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ClubRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_at: string;
};

export default async function ClubsPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  // Clubs the user is a member of.
  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id, role")
    .eq("user_id", profile.id);
  const memberClubIds = (memberships ?? []).map((m) => m.club_id);

  const [{ data: yourClubs }, { data: discover }] = await Promise.all([
    memberClubIds.length === 0
      ? { data: [] as ClubRow[] }
      : supabase
          .from("clubs")
          .select("id, slug, name, description, is_private, created_at")
          .in("id", memberClubIds)
          .order("created_at", { ascending: false })
          .returns<ClubRow[]>(),
    supabase
      .from("clubs")
      .select("id, slug, name, description, is_private, created_at")
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<ClubRow[]>(),
  ]);

  const memberSet = new Set(memberClubIds);
  const discoverFiltered = (discover ?? []).filter((c) => !memberSet.has(c.id));

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="size-5 text-[var(--accent)]" />
              <h1 className="font-heading text-4xl tracking-tight">Book clubs</h1>
            </div>
            <p className="mt-2 text-[var(--muted-foreground)]">
              Read together, talk afterwards.
            </p>
          </div>
          <Link href="/clubs/new">
            <Button>
              <Plus className="size-4" /> Start a club
            </Button>
          </Link>
        </div>

        <Section title="Your clubs">
          {yourClubs && yourClubs.length > 0 ? (
            <ClubGrid clubs={yourClubs} />
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              You haven&rsquo;t joined any clubs yet.
            </p>
          )}
        </Section>

        <Section title="Discover clubs">
          {discoverFiltered.length > 0 ? (
            <ClubGrid clubs={discoverFiltered} />
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              No public clubs yet — be the first to start one.
            </p>
          )}
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-2xl mb-3">{title}</h2>
      {children}
    </section>
  );
}

function ClubGrid({ clubs }: { clubs: ClubRow[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {clubs.map((c) => (
        <li key={c.id}>
          <Link href={`/clubs/${c.slug}`}>
            <Card className="h-full transition-colors hover:border-[var(--ring)]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-xl">{c.name}</h3>
                  {c.is_private && (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="size-3" /> Private
                    </Badge>
                  )}
                </div>
                {c.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-[var(--muted-foreground)]">
                    {c.description}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
