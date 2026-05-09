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

export async function loadKnowledgeGraph(
  supabase: SbServer,
  userId: string
): Promise<GraphData> {
  const [{ data: concepts }, { data: pairs }] = await Promise.all([
    supabase
      .from("concepts")
      .select("id, label, slug, highlight_count")
      .eq("user_id", userId)
      .order("highlight_count", { ascending: false }),
    supabase
      .from("highlight_concepts")
      .select("concept_id, highlights!inner(review_id, reviews!inner(user_id))")
      .returns<
        Array<{
          concept_id: string;
          highlights: { review_id: string; reviews: { user_id: string } };
        }>
      >(),
  ]);

  const nodes: GraphNode[] = (concepts ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    slug: c.slug,
    highlightCount: c.highlight_count,
  }));

  // Group concepts by review for co-occurrence.
  const conceptsByReview = new Map<string, Set<string>>();
  for (const row of pairs ?? []) {
    const review = row.highlights?.review_id;
    if (!review) continue;
    if (!conceptsByReview.has(review)) conceptsByReview.set(review, new Set());
    conceptsByReview.get(review)!.add(row.concept_id);
  }

  const edgeWeights = new Map<string, number>();
  const conceptIds = new Set(nodes.map((n) => n.id));

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
