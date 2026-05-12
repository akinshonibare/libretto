"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  deleteChapterNoteAction,
  updateChapterNoteAction,
} from "@/app/actions/reviews";

type Props = {
  id: string;
  reviewId: string;
  body: string;
  label: string | null;
  page: number | null;
  showLabel: boolean;
};

export function EditableNote({ id, reviewId, body, label, page, showLabel }: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateChapterNoteAction(fd);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function onDelete() {
    if (!confirm("Delete this note?")) return;
    startTransition(async () => {
      await deleteChapterNoteAction(id, reviewId);
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
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor={`label-${id}`}>Chapter / heading</Label>
            <Input
              id={`label-${id}`}
              name="label"
              defaultValue={label ?? ""}
              placeholder="e.g. Ch. 4 — The Halls"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`page-${id}`}>Page</Label>
            <Input
              id={`page-${id}`}
              name="page"
              type="number"
              min={0}
              defaultValue={page ?? ""}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`body-${id}`}>Note</Label>
          <Textarea
            id={`body-${id}`}
            name="body"
            rows={3}
            defaultValue={body}
            required
          />
        </div>
        <div className="flex items-center gap-2">
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
        {error && (
          <p className="text-sm text-[var(--destructive)]" role="alert">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="group relative pl-3.5">
      {showLabel && label && (
        <p className="text-xs font-medium text-[var(--muted-foreground)]">{label}</p>
      )}
      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
      {page != null && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">p. {page}</p>
      )}
      <div className="absolute right-0 top-0 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          aria-label="Edit"
          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          aria-label="Delete"
          className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--destructive)] disabled:opacity-50"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
