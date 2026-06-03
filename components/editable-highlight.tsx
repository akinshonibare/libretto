"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  deleteHighlightAction,
  updateHighlightAction,
} from "@/app/actions/highlights";

type Props = {
  id: string;
  reviewId: string;
  body: string;
  page: number | null;
  variant?: "marginalia" | "card";
};

export function EditableHighlight({ id, reviewId, body, page, variant = "marginalia" }: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateHighlightAction(fd);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function onDelete() {
    if (!confirm("Delete this highlight?")) return;
    startTransition(async () => {
      await deleteHighlightAction(id, reviewId);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3"
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="reviewId" value={reviewId} />
        <Textarea name="body" rows={3} defaultValue={body} required />
        <div className="flex items-end gap-3">
          <div className="w-24 space-y-1.5">
            <Label htmlFor={`page-${id}`}>Page</Label>
            <Input
              id={`page-${id}`}
              name="page"
              type="number"
              min={0}
              defaultValue={page ?? ""}
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
        {error && (
          <p className="text-sm text-[var(--destructive)]" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  }

  const display = (
    <div className="group relative">
      <p className="prose-quote text-base leading-relaxed">&ldquo;{body}&rdquo;</p>
      {page != null && (
        <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">p. {page}</p>
      )}
      <ItemActions
        onEdit={() => setEditing(true)}
        onDelete={onDelete}
        disabled={pending}
      />
    </div>
  );

  if (variant === "card") {
    return (
      <div className="group relative rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="prose-quote text-base">&ldquo;{body}&rdquo;</p>
        {page != null && (
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">p. {page}</p>
        )}
        <ItemActions
          onEdit={() => setEditing(true)}
          onDelete={onDelete}
          disabled={pending}
        />
      </div>
    );
  }

  return <div className="marginalia-highlight">{display}</div>;
}

function ItemActions({
  onEdit,
  onDelete,
  disabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <div className="absolute right-0 top-0 flex gap-1">
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        aria-label="Edit"
        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        aria-label="Delete"
        className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--destructive)] disabled:opacity-50"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
