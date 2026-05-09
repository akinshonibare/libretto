import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/library";
  const sent = params.sent === "1";
  const error = params.error;

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ChevronLeft className="size-4" /> Back
      </Link>
      <h1 className="mt-6 font-heading text-4xl tracking-tight">Sign in</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        We&rsquo;ll email a magic link. No password to remember.
      </p>

      {sent ? (
        <div className="mt-8 rounded-md border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
          <p className="font-medium">Check your inbox.</p>
          <p className="mt-1 text-[var(--muted-foreground)]">
            We sent a sign-in link. Open it on this device to continue.
          </p>
        </div>
      ) : (
        <SignInForm next={next} initialError={error} />
      )}
    </div>
  );
}
