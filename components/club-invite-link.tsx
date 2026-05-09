"use client";

import { useState, useTransition } from "react";
import { Check, Link as LinkIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrCreateClubInviteTokenAction } from "@/app/actions/community";

type Props = {
  clubId: string;
  clubSlug: string;
  siteUrl: string;
  initialToken: string | null;
};

export function ClubInviteLink({ clubId, clubSlug, siteUrl, initialToken }: Props) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function buildLink(t: string): string {
    return `${siteUrl}/clubs/${clubSlug}?t=${t}`;
  }

  function handleCopy() {
    if (token) {
      void copy(buildLink(token));
      return;
    }
    startTransition(async () => {
      const fresh = await getOrCreateClubInviteTokenAction(clubId);
      if (fresh) {
        setToken(fresh);
        await copy(buildLink(fresh));
      }
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn("[club-invite] copy failed", err);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
      <LinkIcon className="size-4 text-[var(--muted-foreground)]" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Invite link</p>
        <p className="truncate text-xs text-[var(--muted-foreground)]">
          {token ? buildLink(token) : "Anyone with this link can read & join."}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={handleCopy} disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : copied ? (
          <Check className="size-4" />
        ) : (
          <LinkIcon className="size-4" />
        )}
        {copied ? "Copied" : token ? "Copy" : "Mint & copy"}
      </Button>
    </div>
  );
}
