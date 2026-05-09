import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo-mark";
import { UserMenu } from "@/components/user-menu";
import { getSessionContext } from "@/lib/auth-helpers";

/**
 * One header for all public + authed routes. Adapts based on whether the
 * viewer is signed in. Server component — uses the React-cached
 * getSessionContext so the layout, page, and nested components share one
 * session lookup per request.
 *
 * Authed nav is intentionally lean: six primary destinations + a single
 * user-menu trigger (anchored on @handle) that owns Profile / Settings /
 * Sign out. Avoids the 10-tab ladder we had before.
 */
export async function SiteHeader() {
  const { profile } = await getSessionContext();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href={profile ? "/dashboard" : "/"}
          className="inline-flex items-center gap-2 font-heading text-2xl tracking-tight"
        >
          <LogoMark size={28} className="text-[var(--foreground)]" />
          <span>Libretto</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {profile ? (
            <>
              <NavLink href="/library">Library</NavLink>
              <NavLink href="/today">Today</NavLink>
              <NavLink href="/feed">Feed</NavLink>
              <NavLink href="/clubs">Clubs</NavLink>
              <NavLink href="/discover">Discover</NavLink>
              <NavLink href="/graph">Graph</NavLink>
              <UserMenu handle={profile.handle} displayName={profile.display_name} />
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
