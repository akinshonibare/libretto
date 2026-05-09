import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/logo-mark";
import { UserMenu } from "@/components/user-menu";
import { MobileMenu } from "@/components/mobile-menu";
import { getSessionContext } from "@/lib/auth-helpers";

/**
 * One header for all public + authed routes. Adapts based on whether the
 * viewer is signed in. Server component — uses the React-cached
 * getSessionContext so the layout, page, and nested components share one
 * session lookup per request.
 *
 * Responsive:
 *   - md+:   inline NavLinks (Library / Today / Feed / Clubs / Discover /
 *            Graph) + UserMenu dropdown anchored on @handle.
 *   - <md:   single MobileMenu trigger holds all of the above (the inline
 *            row was overflowing on phones).
 */
export async function SiteHeader() {
  const { profile } = await getSessionContext();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href={profile ? "/dashboard" : "/"}
          className="inline-flex min-w-0 items-center gap-2 font-heading text-xl tracking-tight sm:text-2xl"
        >
          <LogoMark size={28} className="shrink-0 text-[var(--foreground)]" />
          <span className="truncate">Libretto</span>
        </Link>

        {profile ? (
          <>
            <nav className="hidden items-center gap-1 text-sm md:flex">
              <NavLink href="/library">Library</NavLink>
              <NavLink href="/today">Today</NavLink>
              <NavLink href="/feed">Feed</NavLink>
              <NavLink href="/clubs">Clubs</NavLink>
              <NavLink href="/discover">Discover</NavLink>
              <NavLink href="/graph">Graph</NavLink>
              <UserMenu handle={profile.handle} displayName={profile.display_name} />
            </nav>
            <div className="md:hidden">
              <MobileMenu handle={profile.handle} displayName={profile.display_name} />
            </div>
          </>
        ) : (
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/settings">Theme</NavLink>
            <Link href="/auth/sign-in" prefetch>
              <Button size="sm">Sign in</Button>
            </Link>
          </nav>
        )}
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
