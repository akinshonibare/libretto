"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updateReviewAction } from "@/app/actions/reviews";
import type { ReadingMode, ReadingStatus } from "@/lib/supabase/types";

const READING_MODES: Array<{ id: ReadingMode; label: string; hint: string }> = [
  { id: "absorb", label: "Absorb", hint: "Soak it in." },
  { id: "study", label: "Study", hint: "Exam-style probing." },
  { id: "challenge", label: "Challenge", hint: "Push back." },
  { id: "apply", label: "Apply", hint: "Use it." },
  { id: "enjoy", label: "Enjoy", hint: "For fun." },
];

const STATUS_LABEL: Record<ReadingStatus, string> = {
  reading: "Reading",
  finished: "Finished",
  dnf: "DNF",
};

type Props = {
  reviewId: string;
  status: ReadingStatus;
  rating: number | null;
  liked: boolean | null;
  why: string | null;
  synopsis: string | null;
  readingMode: ReadingMode;
  isPublic: boolean;
};

export function ReviewEditor(props: Props) {
  const hasAnyContent =
    props.rating != null || props.liked != null || !!props.why || !!props.synopsis;
  const [editing, setEditing] = useState(!hasAnyContent);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!editing) {
    return (
      <div className="space-y-4 rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-start justify-between gap-3">
          <ReviewSummary {...props} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit
          </Button>
        </div>
      </div>
    );
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateReviewAction(fd);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-6 rounded-md border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <input type="hidden" name="reviewId" value={props.reviewId} />

      <div className="space-y-3">
        <Label>Status</Label>
        <RadioRow
          name="status"
          options={(Object.keys(STATUS_LABEL) as ReadingStatus[]).map((v) => ({
            value: v,
            label: STATUS_LABEL[v],
          }))}
          defaultValue={props.status}
        />
      </div>

      <div className="space-y-3">
        <Label>Rating</Label>
        <RadioRow
          name="rating"
          options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: "★".repeat(n) }))}
          defaultValue={props.rating ? String(props.rating) : undefined}
          allowEmpty="No rating"
        />
      </div>

      <div className="space-y-3">
        <Label>Did you like it?</Label>
        <RadioRow
          name="liked"
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "unset", label: "Unsure" },
          ]}
          defaultValue={props.liked === true ? "yes" : props.liked === false ? "no" : "unset"}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="why">Why?</Label>
        <Textarea
          id="why"
          name="why"
          rows={3}
          defaultValue={props.why ?? ""}
          placeholder="What stuck with you, what didn't"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="synopsis">Your synopsis</Label>
        <Textarea
          id="synopsis"
          name="synopsis"
          rows={5}
          defaultValue={props.synopsis ?? ""}
          placeholder="The book in your own words"
        />
      </div>

      <div className="space-y-3">
        <Label>Reading mode</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {READING_MODES.map((m) => (
            <label
              key={m.id}
              className="cursor-pointer rounded-md border border-[var(--border)] p-3 text-center text-sm has-[:checked]:border-[var(--ring)] has-[:checked]:bg-[var(--accent)]/30"
            >
              <input
                type="radio"
                name="readingMode"
                value={m.id}
                defaultChecked={m.id === props.readingMode}
                className="sr-only"
              />
              <div className="font-medium">{m.label}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{m.hint}</div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isPublic"
          id="isPublic"
          defaultChecked={props.isPublic}
          value="on"
        />
        <Label htmlFor="isPublic" className="cursor-pointer">
          Make this review public
        </Label>
      </div>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save review
        </Button>
        {hasAnyContent && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError(null);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function ReviewSummary({
  rating,
  liked,
  why,
  synopsis,
}: Pick<Props, "rating" | "liked" | "why" | "synopsis">) {
  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span aria-label={rating ? `Rated ${rating} out of 5` : "Not rated"}>
          <span className="text-[var(--foreground)]">{"★".repeat(rating ?? 0)}</span>
          <span className="opacity-40">{"★".repeat(5 - (rating ?? 0))}</span>
        </span>
        {liked != null && (
          <span className="text-[var(--muted-foreground)]">
            {liked ? "Liked it" : "Didn't like it"}
          </span>
        )}
      </div>
      {why && (
        <div>
          <p className="label-eyebrow text-[var(--muted-foreground)]">Why</p>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{why}</p>
        </div>
      )}
      {synopsis && (
        <div>
          <p className="label-eyebrow text-[var(--muted-foreground)]">Synopsis</p>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{synopsis}</p>
        </div>
      )}
      {!why && !synopsis && rating == null && liked == null && (
        <p className="text-sm text-[var(--muted-foreground)]">
          You haven&rsquo;t written a review yet.
        </p>
      )}
    </div>
  );
}

function RadioRow({
  name,
  options,
  defaultValue,
  allowEmpty,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  allowEmpty?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {allowEmpty && (
        <label className={cn(pillClasses, "has-[:checked]:border-[var(--ring)] has-[:checked]:bg-[var(--accent)]/30")}>
          <input type="radio" name={name} value="" defaultChecked={!defaultValue} className="sr-only" />
          {allowEmpty}
        </label>
      )}
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(pillClasses, "has-[:checked]:border-[var(--ring)] has-[:checked]:bg-[var(--accent)]/30")}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            defaultChecked={defaultValue === o.value}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

const pillClasses =
  "cursor-pointer rounded-full border border-[var(--border)] px-3 py-1 text-sm";
