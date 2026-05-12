"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createReviewAction } from "@/app/actions/reviews";
import type { OpenLibraryBook } from "@/lib/openlibrary";

const READING_MODES = [
  { id: "absorb", label: "Absorb", hint: "Soak it in." },
  { id: "study", label: "Study", hint: "Exam-style probing." },
  { id: "challenge", label: "Challenge", hint: "Push back." },
  { id: "apply", label: "Apply", hint: "Use it." },
  { id: "enjoy", label: "Enjoy", hint: "For fun." },
] as const;

export function ReviewForm() {
  const router = useRouter();
  const formId = useId();
  const [book, setBook] = useState<Partial<OpenLibraryBook> | null>(null);
  const [manual, setManual] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPickBook(b: OpenLibraryBook) {
    setBook(b);
    setManual(false);
  }

  function reset() {
    setBook(null);
    setManual(false);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const fd = new FormData(event.currentTarget);
    if (book?.openlibraryId) fd.set("bookOpenLibraryId", book.openlibraryId);
    if (book?.coverUrl) fd.set("bookCoverUrl", book.coverUrl);
    if (book?.year != null) fd.set("bookYear", String(book.year));
    if (book?.isbn) fd.set("bookIsbn", book.isbn);

    startTransition(async () => {
      const result = await createReviewAction(fd);
      if (result.ok) {
        router.push(`/library/${result.reviewId}`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-3">
        <Label>Book</Label>
        {book && !manual ? (
          <PickedBook book={book} onClear={reset} onEdit={() => setManual(true)} />
        ) : manual ? (
          <ManualBookFields
            initial={book ?? undefined}
            onPick={(b) => {
              setBook(b);
              setManual(false);
            }}
            onCancel={reset}
          />
        ) : (
          <BookSearch onPick={onPickBook} onManual={() => setManual(true)} />
        )}
      </section>

      <section className="space-y-3">
        <Label>Reading mode</Label>
        <p className="text-sm text-[var(--muted-foreground)]">
          How do you want to read this? You can change this later.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {READING_MODES.map((m) => (
            <label
              key={m.id}
              className="cursor-pointer rounded-md border border-[var(--border)] p-3 text-center text-sm has-[:checked]:border-[var(--ring)] has-[:checked]:bg-[var(--accent)]/30"
            >
              <input type="radio" name="readingMode" value={m.id} defaultChecked={m.id === "enjoy"} className="sr-only" />
              <div className="font-medium">{m.label}</div>
              <div className="text-xs text-[var(--muted-foreground)]">{m.hint}</div>
            </label>
          ))}
        </div>
      </section>

      <section className="flex items-center gap-2">
        <input type="checkbox" name="isPublic" id="isPublic" defaultChecked value="on" />
        <Label htmlFor="isPublic" className="cursor-pointer">
          Make this book public on your profile
        </Label>
      </section>

      {error && (
        <p className="text-sm text-[var(--destructive)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !(book || manual)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Add to library
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PickedBook({
  book,
  onClear,
  onEdit,
}: {
  book: Partial<OpenLibraryBook>;
  onClear: () => void;
  onEdit: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverUrl}
            alt=""
            className="h-20 w-14 shrink-0 rounded-sm border border-[var(--border)] object-cover"
          />
        ) : (
          <div className="h-20 w-14 shrink-0 rounded-sm border border-[var(--border)] bg-[var(--muted)]" />
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-heading text-lg leading-tight">{book.title}</p>
          {book.author && <p className="text-sm text-[var(--muted-foreground)]">{book.author}</p>}
          {book.year && <p className="text-xs text-[var(--muted-foreground)]">{book.year}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label="Edit details">
            <Pencil className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear} aria-label="Clear">
            <X className="size-4" />
          </Button>
        </div>
        <input type="hidden" name="bookTitle" value={book.title ?? ""} />
        <input type="hidden" name="bookAuthor" value={book.author ?? ""} />
      </CardContent>
    </Card>
  );
}

function BookSearch({
  onPick,
  onManual,
}: {
  onPick: (b: OpenLibraryBook) => void;
  onManual: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OpenLibraryBook[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search-failed");
        const data = (await res.json()) as { results: OpenLibraryBook[] };
        setResults(data.results);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or author"
          className="pl-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-[var(--muted-foreground)]" />
        )}
      </div>
      {results.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)] bg-[var(--card)]">
          {results.map((b) => (
            <li key={b.openlibraryId}>
              <button
                type="button"
                onClick={() => onPick(b)}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-[var(--muted)]"
              >
                {b.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverUrl} alt="" className="h-12 w-8 rounded-sm object-cover" />
                ) : (
                  <div className="h-12 w-8 rounded-sm bg-[var(--muted)]" />
                )}
                <div className="min-w-0">
                  <p className="line-clamp-1 font-medium">{b.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {b.author ?? "Unknown author"}
                    {b.year ? ` · ${b.year}` : ""}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onManual}
        className="text-sm text-[var(--muted-foreground)] underline-offset-4 hover:underline"
      >
        Can&rsquo;t find it? Add manually
      </button>
    </div>
  );
}

function ManualBookFields({
  initial,
  onPick,
  onCancel,
}: {
  initial?: Partial<OpenLibraryBook>;
  onPick: (b: OpenLibraryBook) => void;
  onCancel: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <ManualField name="bookTitle" label="Title" required defaultValue={initial?.title ?? ""} />
        <ManualField name="bookAuthor" label="Author" defaultValue={initial?.author ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <ManualField
            name="bookYear"
            label="Year"
            type="number"
            defaultValue={initial?.year ? String(initial.year) : ""}
          />
          <ManualField name="bookIsbn" label="ISBN" defaultValue={initial?.isbn ?? ""} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              const root = document.getElementById("manual-fields");
              const inputs = root?.querySelectorAll<HTMLInputElement>("input[name]") ?? [];
              const data: Record<string, string> = {};
              inputs.forEach((i) => (data[i.name] = i.value));
              if (data.bookTitle) {
                onPick({
                  openlibraryId: "",
                  title: data.bookTitle,
                  author: data.bookAuthor || null,
                  coverUrl: null,
                  year: data.bookYear ? Number(data.bookYear) : null,
                  isbn: data.bookIsbn || null,
                });
              }
            }}
          >
            Use these details
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Back to search
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ManualField({
  name,
  label,
  type = "text",
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const id = `manual-${name}`;
  return (
    <div id="manual-fields" className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}

