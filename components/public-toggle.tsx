"use client";

import { useState, useTransition } from "react";
import { Globe, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toggleReviewPublicAction } from "@/app/actions/share";

export function PublicToggle({
  reviewId,
  initialIsPublic,
}: {
  reviewId: string;
  initialIsPublic: boolean;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [pending, startTransition] = useTransition();

  function onToggle(next: boolean) {
    setIsPublic(next);
    startTransition(async () => {
      await toggleReviewPublicAction(reviewId, next);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />}
        <Label htmlFor={`public-${reviewId}`} className="cursor-pointer">
          {isPublic ? "Public — anyone with the link" : "Private — only you, unless you share a link"}
        </Label>
      </div>
      <button
        id={`public-${reviewId}`}
        type="button"
        role="switch"
        aria-checked={isPublic}
        onClick={() => onToggle(!isPublic)}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          isPublic ? "bg-[var(--primary)]" : "bg-[var(--muted)]"
        } ${pending ? "opacity-60" : ""}`}
      >
        <span
          className={`inline-block size-5 transform rounded-full bg-white transition-transform ${
            isPublic ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
