import { Network, Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConceptMap } from "@/components/concept-map";
import { BookFilter } from "@/components/book-filter";
import { requireUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { loadBooksWithConcepts, loadKnowledgeGraph } from "@/lib/graph-data";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { rebuildConceptGraphAction } from "@/app/actions/concepts";

export const dynamic = "force-dynamic";

type GraphPageProps = {
  searchParams: Promise<{ book?: string }>;
};

export default async function GraphPage({ searchParams }: GraphPageProps) {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const { book: bookParam } = await searchParams;

  const books = await loadBooksWithConcepts(supabase, profile.id);
  const bookIds = new Set(books.map((b) => b.id));

  // Resolve the active book id:
  //   - explicit ?book=<id> wins (when valid)
  //   - ?book=all → cross-book view
  //   - no param → default to most recently highlighted book (books[0])
  let selectedBookId: string | null = null;
  if (bookParam === "all") {
    selectedBookId = null;
  } else if (bookParam && bookIds.has(bookParam)) {
    selectedBookId = bookParam;
  } else if (books.length > 0) {
    selectedBookId = books[0].id;
  }

  const data = await loadKnowledgeGraph(supabase, profile.id, selectedBookId);
  const selectedBook = books.find((b) => b.id === selectedBookId) ?? null;

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Network className="size-5 text-[var(--accent)]" />
              <h1 className="font-heading text-4xl tracking-tight">Your mind, mapped</h1>
            </div>
            <p className="mt-2 text-[var(--muted-foreground)]">
              {selectedBook
                ? `Concepts from ${selectedBook.title}. Tap any chip to follow a thread.`
                : "Concepts across every book in your library. Tap any chip to follow a thread."}
            </p>
          </div>
          <form action={rebuildAndReturn}>
            <Button type="submit" variant="outline" size="sm">
              <Sparkles className="size-4" /> Rebuild / refresh
            </Button>
          </form>
        </div>

        {books.length > 1 && (
          <div className="mt-6">
            <BookFilter
              basePath="/graph"
              allHref="/graph?book=all"
              options={books}
              selectedId={selectedBookId}
              label="Scope"
            />
          </div>
        )}

        {!isAnthropicConfigured() ? (
          <Card className="mt-8">
            <CardContent className="p-6 text-sm text-[var(--muted-foreground)]">
              The graph relies on Claude to extract concepts. Set <code>ANTHROPIC_API_KEY</code> in your env to turn it on.
            </CardContent>
          </Card>
        ) : data.nodes.length === 0 ? (
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Loader2 className="size-6 text-[var(--muted-foreground)]" />
              <h2 className="font-heading text-2xl">
                {selectedBook ? "No concepts here yet" : "No graph yet"}
              </h2>
              <p className="max-w-md text-sm text-[var(--muted-foreground)]">
                {selectedBook ? (
                  <>
                    Nothing&apos;s been tagged from{" "}
                    <em>{selectedBook.title}</em> yet. Capture a few highlights, or click{" "}
                    <em>Rebuild / refresh</em> to backfill older ones.
                  </>
                ) : (
                  <>
                    Capture a few highlights — concepts are tagged in the background. Click <em>Rebuild / refresh</em> above to backfill any older highlights.
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8">
            <ConceptMap data={data} />
            <p className="mt-6 text-xs text-[var(--muted-foreground)]">
              {data.nodes.length} concept{data.nodes.length === 1 ? "" : "s"} ·{" "}
              {data.edges.length} connection{data.edges.length === 1 ? "" : "s"}.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

async function rebuildAndReturn() {
  "use server";
  await rebuildConceptGraphAction();
}
