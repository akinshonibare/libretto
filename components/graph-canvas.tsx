"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GraphData, GraphNode, ConceptHighlight } from "@/lib/graph-data";

// react-force-graph-2d is canvas-based and can only render in the browser.
// Cast to a permissive type — the lib's generics fight with our concrete types
// once they pass through next/dynamic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d") as any, {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-[var(--muted-foreground)]">
      <Loader2 className="size-4 animate-spin" /> &nbsp;Loading graph…
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

type Props = { data: GraphData };

export function GraphCanvas({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [highlights, setHighlights] = useState<ConceptHighlight[] | null>(null);
  const [loadingHighlights, setLoadingHighlights] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const graph = useMemo(
    () => ({
      nodes: data.nodes.map((n) => ({ ...n })),
      links: data.edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight })),
    }),
    [data]
  );

  // Tune force simulation so labels don't pile up:
  //  - stronger repulsion (charge) pushes nodes apart
  //  - longer link distance gives connected concepts more room
  //  - lower velocityDecay lets nodes drift further before settling
  // Re-run on every graph change so newly added nodes get re-laid-out.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || data.nodes.length === 0) return;
    fg.d3Force("charge")?.strength(-380).distanceMax(420);
    fg.d3Force("link")?.distance(110);
    fg.d3VelocityDecay?.(0.35);
    // Kick the simulation so new forces actually take effect.
    fg.d3ReheatSimulation?.();
  }, [data]);

  async function selectNode(node: GraphNode) {
    setSelected(node);
    setLoadingHighlights(true);
    try {
      const res = await fetch(`/api/concepts/${node.id}/highlights`);
      if (res.ok) {
        const body = (await res.json()) as { highlights: ConceptHighlight[] };
        setHighlights(body.highlights);
      } else {
        setHighlights([]);
      }
    } catch {
      setHighlights([]);
    } finally {
      setLoadingHighlights(false);
    }
  }

  return (
    <div className="grid min-h-[560px] grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      <div
        ref={containerRef}
        className="relative h-[560px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
      >
        {data.nodes.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center px-8 text-center text-sm text-[var(--muted-foreground)]">
            No concepts yet. Capture a few highlights, then click <em>Build / refresh graph</em>.
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graph}
            width={size.w}
            height={size.h}
            backgroundColor="transparent"
            nodeRelSize={5}
            nodeLabel={(n: GraphNode) => `${n.label} (${n.highlightCount})`}
            linkWidth={(l: { weight: number }) => Math.min(4, 1 + Math.log(l.weight + 1))}
            linkColor={() => "rgba(0,0,0,0.18)"}
            onNodeClick={(n: GraphNode) => {
              void selectNode(n);
            }}
            cooldownTicks={300}
            nodeCanvasObjectMode={() => "after"}
            nodeCanvasObject={(
              node: GraphNode & { x?: number; y?: number },
              ctx: CanvasRenderingContext2D,
              globalScale: number
            ) => {
              const fontSize = Math.max(10, 12 / globalScale);
              ctx.font = `${fontSize}px serif`;
              ctx.fillStyle = "var(--foreground)";
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              const x = node.x ?? 0;
              const y = node.y ?? 0;
              ctx.fillText(node.label, x, y + 6 + Math.sqrt(node.highlightCount) * 2);
            }}
          />
        )}
      </div>

      <aside className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        {!selected ? (
          <div className="text-sm text-[var(--muted-foreground)]">
            Click a node to see the highlights tagged with that concept across your library.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                  Concept
                </p>
                <h3 className="font-heading text-2xl">{selected.label}</h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {selected.highlightCount} highlight{selected.highlightCount === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setSelected(null);
                  setHighlights(null);
                }}
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>

            {loadingHighlights ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Loader2 className="size-4 animate-spin" /> Loading highlights…
              </div>
            ) : !highlights || highlights.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No highlights found.</p>
            ) : (
              <ul className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                {highlights.map((h) => (
                  <li key={h.highlightId}>
                    <Card>
                      <CardContent className="p-3">
                        <p className="prose-quote text-sm leading-snug">&ldquo;{h.body}&rdquo;</p>
                        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                          {h.bookTitle}
                          {h.bookAuthor ? ` · ${h.bookAuthor}` : ""}
                          {h.page != null ? ` · p. ${h.page}` : ""}
                        </p>
                        <Link
                          href={`/library/${h.reviewId}`}
                          className="mt-1 inline-block text-xs underline-offset-4 hover:underline"
                        >
                          Open review →
                        </Link>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
