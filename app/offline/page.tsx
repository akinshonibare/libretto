import Link from "next/link";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-4xl tracking-tight">You&rsquo;re offline</h1>
      <p className="mt-2 text-[var(--muted-foreground)]">
        Libretto needs the network to load this page. Reconnect and try again.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm underline-offset-4 hover:underline"
      >
        Try again
      </Link>
    </div>
  );
}
