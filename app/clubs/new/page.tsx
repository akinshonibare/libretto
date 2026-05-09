import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CreateClubForm } from "@/components/create-club-form";
import { requireUser } from "@/lib/auth-helpers";

export default async function NewClubPage() {
  const { profile } = await requireUser();
  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/clubs"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4" /> Clubs
        </Link>
        <h1 className="mt-6 font-heading text-4xl tracking-tight">Start a club</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          You&rsquo;ll be the owner. Anyone can join a public club; private clubs are invite-by-link.
        </p>
        <div className="mt-8">
          <CreateClubForm />
        </div>
      </div>
    </AppShell>
  );
}
