"use client";

import { useState, useTransition } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reportAction } from "@/app/actions/community";

type Props = {
  targetType: "review" | "highlight" | "club" | "club_message" | "user";
  targetId: string;
  redirectTo?: string;
};

export function ReportButton({ targetType, targetId, redirectTo }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (reason.trim().length < 3) {
      setError("Tell us briefly what's wrong.");
      return;
    }
    const fd = new FormData();
    fd.set("targetType", targetType);
    fd.set("targetId", targetId);
    fd.set("reason", reason.trim());
    if (redirectTo) fd.set("redirectTo", redirectTo);
    startTransition(async () => {
      const result = await reportAction(fd);
      if (result.ok) {
        setDone(true);
        setReason("");
        setTimeout(() => {
          setOpen(false);
          setDone(false);
        }, 1500);
      } else {
        setError(result.error ?? "Could not file report.");
      }
    });
  }

  return (
    <div className="inline-block">
      {!open ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label="Report"
          className="text-[var(--muted-foreground)]"
        >
          <Flag className="size-3.5" /> Report
        </Button>
      ) : (
        <div className="space-y-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
          {done ? (
            <p className="text-sm">Thanks — we&rsquo;ll take a look.</p>
          ) : (
            <>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="What's wrong with this?"
                maxLength={500}
              />
              {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={submit} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null} Submit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    setReason("");
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
