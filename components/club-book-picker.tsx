"use client";

import { useState, useTransition } from "react";
import { setClubBookAction } from "@/app/actions/community";
import { Button } from "@/components/ui/button";

type Book = { id: string; title: string; author: string | null };

export function ClubBookPicker({
  clubId,
  slug,
  currentBookId,
  books,
}: {
  clubId: string;
  slug: string;
  currentBookId: string | null;
  books: Book[];
}) {
  const [pending, startTransition] = useTransition();
  const [bookId, setBookId] = useState(currentBookId ?? "");

  if (books.length === 0) {
    return (
      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        Add a book to your library before picking one for this club.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("clubId", clubId);
        fd.set("slug", slug);
        if (bookId) fd.set("bookId", bookId);
        startTransition(async () => {
          await setClubBookAction(fd);
        });
      }}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <select
        value={bookId}
        onChange={(e) => setBookId(e.target.value)}
        className="w-full min-w-0 max-w-full rounded-md border border-[var(--input)] bg-[var(--card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--background)] sm:w-auto sm:flex-1"
      >
        <option value="">— Pick a book —</option>
        {books.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
            {b.author ? ` — ${b.author}` : ""}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Set as current
      </Button>
    </form>
  );
}
