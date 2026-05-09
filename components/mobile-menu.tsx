"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, User, Settings, LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * Single-trigger mobile menu. Replaces the inline nav row on small screens
 * (the 6 nav buttons + UserMenu was overflowing the viewport on phones).
 *
 * Lists all primary destinations + the user-level actions in one tray.
 * Closes on outside click, Escape, and on route change.
 */

type Props = {
  handle: string;
  displayName: string | null;
};

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: "/library", label: "Library" },
  { href: "/today", label: "Today" },
  { href: "/feed", label: "Feed" },
  { href: "/clubs", label: "Clubs" },
  { href: "/discover", label: "Discover" },
  { href: "/graph", label: "Graph" },
];

export function MobileMenu({ handle, displayName }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-lg"
        >
          <div className="border-b border-[var(--border)] px-3 py-2.5">
            <p className="font-medium leading-tight">{displayName ?? handle}</p>
            <p className="text-xs text-[var(--muted-foreground)]">@{handle}</p>
          </div>
          <nav className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <MenuLink key={item.href} href={item.href} active={pathname === item.href}>
                {item.label}
              </MenuLink>
            ))}
          </nav>
          <div className="border-t border-[var(--border)]">
            <MenuLink href={`/u/${handle}`} icon={<User className="size-4" />}>
              View profile
            </MenuLink>
            <MenuLink href="/settings" icon={<Settings className="size-4" />}>
              Settings
            </MenuLink>
            <form action={signOutAction} className="border-t border-[var(--border)]">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--muted)]"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      prefetch
      className={`flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--muted)] ${
        active ? "bg-[var(--muted)] font-medium" : ""
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
