import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ReviewForm } from "@/components/review-form";
import { requireUser } from "@/lib/auth-helpers";

export default async function NewReviewPage() {
  const { profile } = await requireUser();

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/library"
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4" /> Back to library
        </Link>
        <h1 className="mt-6 font-heading text-4xl tracking-tight">Add a book</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Search OpenLibrary or enter the details by hand.
        </p>
        <div className="mt-8">
          <ReviewForm />
        </div>
      </div>
    </AppShell>
  );
}
