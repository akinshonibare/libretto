import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/auth-helpers";

/**
 * One header for all public + authed routes. Adapts based on whether the
 * viewer is signed in:
 *   - Signed in: full nav (Home / Library / Today / Discover / @handle / Theme / Sign out)
 *   - Signed out: minimal nav (Theme / Sign in)
 *
 * This is a server component — uses the React-cached getSessionContext so
 * multiple renders in one request don't re-hit Supabase.
 */
export async function SiteHeader() {
  const { profile } = await getSessionContext();

  return (
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href={profile ? "/dashboard" : "/"} className="font-heading text-2xl tracking-tight">
          Libretto
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {profile ? (
            <>
              <NavLink href="/dashboard">Home</NavLink>
              <NavLink href="/library">Library</NavLink>
              <NavLink href="/today">Today</NavLink>
              <NavLink href="/discover">Discover</NavLink>
              <NavLink href="/graph">Graph</NavLink>
              <NavLink href={`/u/${profile.handle}`}>@{profile.handle}</NavLink>
              <NavLink href="/settings">Theme</NavLink>
              <form action={signOutAction}>
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <NavLink href="/settings">Theme</NavLink>
              <Link href="/auth/sign-in" prefetch>
                <Button size="sm">Sign in</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch>
      <Button variant="ghost" size="sm">
        {children}
      </Button>
    </Link>
  );
}
