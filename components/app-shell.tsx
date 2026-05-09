import { SiteHeader } from "@/components/site-header";

/**
 * Authed-route wrapper. Identical to the public layout — both share the same
 * SiteHeader; the header itself adapts to auth state (so an authed user lands
 * on /u/[handle] and still sees their nav).
 *
 * Kept as a thin wrapper so existing call sites (`<AppShell handle={…}>`) don't
 * need to change. The `handle` prop is now optional and unused.
 */
export function AppShell({ children }: { handle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
