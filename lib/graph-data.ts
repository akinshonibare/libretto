/**
 * Build the per-user knowledge graph from concepts + highlight_concepts.
 * Edges are co-occurrence pairs (two concepts sharing at least one review),
 * with weight = number of reviews where they co-occur.
 */

import type { createClient } from "@/lib/supabase/server";

type SbServer = Awaited<ReturnType<typeof createClient>>;

export type GraphNode = {
  id: string;
  label: string;
  slug: string;
  highlightCount: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  weight: number;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

/**
 * Load the knowledge graph for a user, optionally scoped to a single book.
 *
 * When bookId is provided, both nodes and edges are restricted to the slice
 * of highlights that belong to reviews of that book. highlight_count is
 * recomputed against the filtered slice — the cached count on the concepts
 * table is the user-wide total, which would be wrong for a book view.
 */
export async function loadKnowledgeGraph(
  supabase: SbServer,
  userId: string,
  bookId?: string | null
): Promise<GraphData> {
  const [{ data: concepts }, { data: pairs }] = await Promise.all([
    supabase
      .from("concepts")
      .select("id, label, slug, highlight_count")
      .eq("user_id", userId)
      .order("highlight_count", { ascending: false }),
    supabase
      .from("highlight_concepts")
      .select(
        "concept_id, highlight_id, highlights!inner(review_id, reviews!inner(user_id, book_id))"
      )
      .returns<
        Array<{
          concept_id: string;
          highlight_id: string;
          highlights: {
            review_id: string;
            reviews: { user_id: string; book_id: string };
          };
        }>
      >(),
  ]);

  const labels = new Map<string, { label: string; slug: string }>();
  for (const c of concepts ?? []) labels.set(c.id, { label: c.label, slug: c.slug });

  // Filter pairs by book if a bookId is set. RLS already restricts to this
  // user, but the !inner join doesn't push our book filter into Postgres, so
  // we narrow client-side. Dataset is one user's tagged highlights — small.
  const filteredPairs = (pairs ?? []).filter((row) => {
    if (!row.highlights?.reviews) return false;
    if (bookId && row.highlights.reviews.book_id !== bookId) return false;
    return true;
  });

  // Group filtered pairs by review for co-occurrence. Same review = same book,
  // so this still encodes "ideas that show up together in a single read".
  const conceptsByReview = new Map<string, Set<string>>();
  // Track distinct (concept_id, highlight_id) so highlightCount is the count
  // of HIGHLIGHTS tagged with that concept in the filtered slice, not the
  // count of join rows (which can dupe if a concept tagged a highlight twice).
  const highlightsPerConcept = new Map<string, Set<string>>();
  for (const row of filteredPairs) {
    const review = row.highlights.review_id;
    if (!conceptsByReview.has(review)) conceptsByReview.set(review, new Set());
    conceptsByReview.get(review)!.add(row.concept_id);
    if (!highlightsPerConcept.has(row.concept_id))
      highlightsPerConcept.set(row.concept_id, new Set());
    highlightsPerConcept.get(row.concept_id)!.add(row.highlight_id);
  }

  // Nodes: only concepts that actually appear in the filtered slice, ordered
  // by highlight count (within scope), labels carried over from the concepts
  // table so we still get the canonical user-facing string.
  const nodes: GraphNode[] = Array.from(highlightsPerConcept.entries())
    .map(([conceptId, hSet]) => {
      const meta = labels.get(conceptId);
      if (!meta) return null;
      return {
        id: conceptId,
        label: meta.label,
        slug: meta.slug,
        highlightCount: hSet.size,
      };
    })
    .filter((n): n is GraphNode => n !== null)
    .sort((a, b) => b.highlightCount - a.highlightCount);

  const conceptIds = new Set(nodes.map((n) => n.id));
  const edgeWeights = new Map<string, number>();
  for (const conceptSet of conceptsByReview.values()) {
    const arr = Array.from(conceptSet).filter((id) => conceptIds.has(id));
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const [a, b] = arr[i] < arr[j] ? [arr[i], arr[j]] : [arr[j], arr[i]];
        const key = `${a}|${b}`;
        edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
      }
    }
  }

  const edges: GraphEdge[] = Array.from(edgeWeights.entries()).map(([key, weight]) => {
    const [source, target] = key.split("|");
    return { source, target, weight };
  });

  return { nodes, edges };
}

export type BookOption = {
  id: string;
  title: string;
  author: string | null;
};

/**
 * Return the books the user has any concept-tagged highlights for, ordered
 * by most-recently-highlighted first. Used to populate the graph's book
 * filter and to pick a default "most recent read" focus.
 */
export async function loadBooksWithConcepts(
  supabase: SbServer,
  userId: string
): Promise<BookOption[]> {
  type Row = {
    created_at: string;
    reviews: {
      user_id: string;
      books: { id: string; title: string; author: string | null } | null;
    } | null;
  };
  // We could query highlight_concepts and walk back to books, but a concept
  // exists for the book only if there's a tagged highlight — so highlights
  // joined to a non-empty highlight_concepts is the same set. Keep this as
  // the simpler "any highlight" query; books without concepts will just
  // produce an empty graph if picked, which is fine signal for the user.
  const { data } = await supabase
    .from("highlights")
    .select("created_at, reviews!inner(user_id, books!inner(id, title, author))")
    .eq("reviews.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<Row[]>();

  const seen = new Map<string, BookOption>();
  for (const row of data ?? []) {
    const b = row.reviews?.books;
    if (!b) continue;
    if (seen.has(b.id)) continue; // first occurrence wins; rows are date-desc
    seen.set(b.id, { id: b.id, title: b.title, author: b.author });
  }
  return Array.from(seen.values());
}

export type ConceptHighlight = {
  highlightId: string;
  body: string;
  page: number | null;
  reviewId: string;
  bookTitle: string;
  bookAuthor: string | null;
};

export async function loadHighlightsForConcept(
  supabase: SbServer,
  userId: string,
  conceptId: string
): Promise<ConceptHighlight[]> {
  type Row = {
    highlight_id: string;
    highlights: {
      id: string;
      body: string;
      page: number | null;
      review_id: string;
      reviews: {
        user_id: string;
        books: { title: string; author: string | null } | null;
      };
    } | null;
  };
  const { data } = await supabase
    .from("highlight_concepts")
    .select(
      "highlight_id, highlights!inner(id, body, page, review_id, reviews!inner(user_id, books(title, author)))"
    )
    .eq("concept_id", conceptId)
    .returns<Row[]>();

  return (data ?? [])
    .filter((r) => r.highlights && r.highlights.reviews.user_id === userId)
    .map((r) => ({
      highlightId: r.highlights!.id,
      body: r.highlights!.body,
      page: r.highlights!.page,
      reviewId: r.highlights!.review_id,
      bookTitle: r.highlights!.reviews.books?.title ?? "Untitled",
      bookAuthor: r.highlights!.reviews.books?.author ?? null,
    }));
}
