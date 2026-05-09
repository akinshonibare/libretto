import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function AppShell({
  handle,
  children,
}: {
  handle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/library" className="font-heading text-2xl tracking-tight">
            Libretto
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/library">
              <Button variant="ghost" size="sm">
                Library
              </Button>
            </Link>
            <Link href={`/u/${handle}`}>
              <Button variant="ghost" size="sm">
                @{handle}
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                Theme
              </Button>
            </Link>
            <form action={signOutAction}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
