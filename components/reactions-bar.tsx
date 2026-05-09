"use client";

import { Star, Sparkles, Bookmark } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleReactionAction } from "@/app/actions/community";
import { cn } from "@/lib/utils";

type Kind = "star" | "this_hit" | "bookmark";

export function ReactionsBar({
  targetType,
  targetId,
  counts,
  active,
  redirectTo,
}: {
  targetType: "review" | "highlight";
  targetId: string;
  counts: Record<Kind, number>;
  active: Record<Kind, boolean>;
  redirectTo: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(kind: Kind) {
    const fd = new FormData();
    fd.set("targetType", targetType);
    fd.set("targetId", targetId);
    fd.set("kind", kind);
    fd.set("on", active[kind] ? "false" : "true");
    fd.set("redirectTo", redirectTo);
    startTransition(async () => {
      await toggleReactionAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <ReactionPill
        icon={<Star className="size-3.5" />}
        label="Star"
        count={counts.star}
        on={active.star}
        disabled={pending}
        onClick={() => toggle("star")}
      />
      <ReactionPill
        icon={<Sparkles className="size-3.5" />}
        label="This hit"
        count={counts.this_hit}
        on={active.this_hit}
        disabled={pending}
        onClick={() => toggle("this_hit")}
      />
      <ReactionPill
        icon={<Bookmark className="size-3.5" />}
        label="Bookmark"
        count={counts.bookmark}
        on={active.bookmark}
        disabled={pending}
        onClick={() => toggle("bookmark")}
      />
    </div>
  );
}

function ReactionPill({
  icon,
  label,
  count,
  on,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
        on
          ? "border-[var(--ring)] bg-[var(--accent)]/40 text-[var(--accent-foreground)]"
          : "border-[var(--border)] hover:border-[var(--ring)]"
      )}
    >
      {icon}
      <span>{label}</span>
      {count > 0 && (
        <span className="ml-1 text-[var(--muted-foreground)]">{count}</span>
      )}
    </button>
  );
}
