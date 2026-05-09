"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, User, Settings, LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

/**
 * User menu — single trigger anchored on @handle. Replaces the long ladder of
 * header tabs that used to include Settings + Sign out. Closes on outside
 * click, Escape, and on route change.
 */
export function UserMenu({
  handle,
  displayName,
}: {
  handle: string;
  displayName: string | null;
}) {
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

  const initial = (displayName ?? handle).slice(0, 1).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="gap-2"
      >
        <span
          className="flex size-6 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-heading text-[11px] font-semibold"
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="hidden sm:inline">@{handle}</span>
        <ChevronDown className="size-3.5" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--popover)] text-[var(--popover-foreground)] shadow-lg"
        >
          <div className="border-b border-[var(--border)] px-3 py-2.5">
            <p className="font-medium leading-tight">{displayName ?? handle}</p>
            <p className="text-xs text-[var(--muted-foreground)]">@{handle}</p>
          </div>
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
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--muted)] cursor-pointer"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      prefetch
      className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[var(--muted)]"
    >
      {icon}
      {children}
    </Link>
  );
}
