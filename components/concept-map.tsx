"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { GraphData, GraphNode, ConceptHighlight } from "@/lib/graph-data";

/**
 * Focused traversal map. Replaces the force-directed canvas with a layout
 * that's identical on mobile and desktop:
 *
 *  - One concept is in focus at the top (big serif title + highlight count)
 *  - Below it: chips for every concept that co-occurs in the same review,
 *    SIZED BY edge weight (the same signal the force graph encoded as link
 *    distance). Tap a chip → it becomes the new focus, the old one slides
 *    into a breadcrumb trail.
 *  - Highlights for the current concept render below the chips.
 *
 * Why this beats the canvas: predictable layout, tap targets that fingers
 * can actually hit, the breadcrumb makes "where did I come from" obvious,
 * and the connection signal (edge weight) is preserved in chip size.
 */

type Props = { data: GraphData };

type Neighbor = {
  node: GraphNode;
  weight: number;
};

export function ConceptMap({ data }: Props) {
  // Pre-compute an adjacency map: concept id → neighbors w/ edge weight, sorted desc.
  const adjacency = useMemo(() => {
    const map = new Map<string, Neighbor[]>();
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    for (const e of data.edges) {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) continue;
      if (!map.has(e.source)) map.set(e.source, []);
      if (!map.has(e.target)) map.set(e.target, []);
      map.get(e.source)!.push({ node: t, weight: e.weight });
      map.get(e.target)!.push({ node: s, weight: e.weight });
    }
    for (const list of map.values()) list.sort((a, b) => b.weight - a.weight);
    return map;
  }, [data]);

  // Start focused on the most-highlighted concept — it's the natural entry point.
  const seedId = data.nodes[0]?.id ?? null;
  const [focusId, setFocusId] = useState<string | null>(seedId);
  const [trail, setTrail] = useState<GraphNode[]>([]);

  // Derive the effective focus from props + state. If the underlying graph
  // changes and the focused node disappears, fall back to the seed without
  // an effect/setState round trip.
  const focusNode = useMemo(() => {
    const byId = data.nodes.find((n) => n.id === focusId);
    if (byId) return byId;
    return data.nodes[0] ?? null;
  }, [data, focusId]);
  const effectiveFocusId = focusNode?.id ?? null;
  const neighbors = effectiveFocusId ? adjacency.get(effectiveFocusId) ?? [] : [];

  // Per-focus highlights cache so revisiting a concept doesn't re-fetch.
  const cacheRef = useRef(new Map<string, ConceptHighlight[]>());
  const [highlights, setHighlights] = useState<ConceptHighlight[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The component early-returns when there are no nodes, so by the time
    // this effect runs there's always an effective focus.
    if (!effectiveFocusId) return;
    const cache = cacheRef.current;
    const cached = cache.get(effectiveFocusId);
    if (cached) {
      setHighlights(cached);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setHighlights(null);
    (async () => {
      try {
        const res = await fetch(`/api/concepts/${effectiveFocusId}/highlights`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { highlights: ConceptHighlight[] };
        if (cancelled) return;
        cache.set(effectiveFocusId, body.highlights);
        setHighlights(body.highlights);
      } catch {
        if (!cancelled) setHighlights([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveFocusId]);

  function focusOn(node: GraphNode) {
    if (node.id === effectiveFocusId) return;
    if (focusNode) setTrail((prev) => [...prev, focusNode]);
    setFocusId(node.id);
  }

  function goBack() {
    const prev = trail[trail.length - 1];
    if (!prev) return;
    setTrail((t) => t.slice(0, -1));
    setFocusId(prev.id);
  }

  function jumpTo(node: GraphNode, idx: number) {
    setTrail((t) => t.slice(0, idx));
    setFocusId(node.id);
  }

  if (data.nodes.length === 0 || !focusNode) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-[var(--muted-foreground)]">
          No concepts yet — capture a few highlights to start mapping.
        </CardContent>
      </Card>
    );
  }

  // Scale chip size by edge weight. We normalise against the strongest
  // neighbor of the current focus so the relative pecking order is obvious.
  const maxWeight = neighbors[0]?.weight ?? 1;

  return (
    <div className="space-y-6">
      {/* Breadcrumb trail */}
      {trail.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 hover:text-[var(--foreground)]"
            aria-label="Go back to previous concept"
          >
            <ChevronLeft className="size-3" /> Back
          </button>
          {trail.map((n, i) => (
            <span key={`${n.id}-${i}`} className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => jumpTo(n, i)}
                className="underline-offset-4 hover:underline hover:text-[var(--foreground)]"
              >
                {n.label}
              </button>
              <span aria-hidden>·</span>
            </span>
          ))}
          <span className="text-[var(--foreground)]">{focusNode.label}</span>
        </div>
      )}

      {/* Focused concept header */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          Now exploring
        </p>
        <h2 className="mt-1 font-heading text-3xl tracking-tight sm:text-4xl">
          {focusNode.label}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {focusNode.highlightCount} highlight
          {focusNode.highlightCount === 1 ? "" : "s"}
          {neighbors.length > 0 && (
            <>
              {" · "}
              {neighbors.length} connection{neighbors.length === 1 ? "" : "s"}
            </>
          )}
        </p>

        {/* Connection chips */}
        {neighbors.length > 0 ? (
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Often appears with
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {neighbors.map(({ node, weight }) => {
                const rel = weight / maxWeight; // 0..1
                // Tap-target floor of 32px height regardless of weight.
                const fontPx = 13 + Math.round(rel * 6); // 13–19px
                const padY = 6 + Math.round(rel * 2);
                const padX = 10 + Math.round(rel * 4);
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => focusOn(node)}
                    className="rounded-full border border-[var(--border)] bg-[var(--background)] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    style={{
                      fontSize: `${fontPx}px`,
                      padding: `${padY}px ${padX}px`,
                    }}
                    aria-label={`Focus on ${node.label}, ${weight} shared review${
                      weight === 1 ? "" : "s"
                    }`}
                  >
                    {node.label}
                    <span className="ml-1.5 text-[var(--muted-foreground)]">
                      ·{weight}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm text-[var(--muted-foreground)]">
            No connections yet — this concept stands alone in your reading.
          </p>
        )}
      </div>

      {/* Highlights for the focused concept */}
      <section aria-label="Highlights for this concept" className="space-y-3">
        <h3 className="font-heading text-xl tracking-tight">Highlights</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Loader2 className="size-4 animate-spin" /> Loading highlights…
          </div>
        ) : !highlights || highlights.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No highlights tagged with this concept.
          </p>
        ) : (
          <ul className="space-y-3">
            {highlights.map((h) => (
              <li key={h.highlightId}>
                <Card>
                  <CardContent className="p-4">
                    <p className="prose-quote text-base leading-relaxed">
                      &ldquo;{h.body}&rdquo;
                    </p>
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      {h.bookTitle}
                      {h.bookAuthor ? ` · ${h.bookAuthor}` : ""}
                      {h.page != null ? ` · p. ${h.page}` : ""}
                    </p>
                    <Link
                      href={`/library/${h.reviewId}`}
                      className="mt-2 inline-block text-xs underline-offset-4 hover:underline"
                    >
                      Open review →
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick-jump: top concepts in your library, always one tap away. */}
      <section
        aria-label="Top concepts in your library"
        className="rounded-xl border border-dashed border-[var(--border)] p-4"
      >
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
          <Sparkles className="size-3.5" /> Jump to a top concept
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {data.nodes.slice(0, 12).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => focusOn(n)}
              disabled={n.id === effectiveFocusId}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--muted)] disabled:cursor-default disabled:opacity-40"
            >
              {n.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
