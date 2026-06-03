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

const MOBILE_BREAKPOINT = 640;

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

  const isMobile = size.w > 0 && size.w < MOBILE_BREAKPOINT;

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

  function clearSelection() {
    setSelected(null);
    setHighlights(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div
        ref={containerRef}
        className="relative h-[60vh] min-h-[360px] max-h-[560px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] lg:h-[560px] lg:max-h-none"
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
            nodeRelSize={isMobile ? 8 : 5}
            nodeLabel={(n: GraphNode) => `${n.label} (${n.highlightCount})`}
            linkWidth={(l: { weight: number }) => Math.min(4, 1 + Math.log(l.weight + 1))}
            linkColor={() => "rgba(0,0,0,0.18)"}
            onNodeClick={(n: GraphNode) => {
              void selectNode(n);
            }}
            onBackgroundClick={() => {
              if (isMobile) clearSelection();
            }}
            enableNodeDrag={false}
            cooldownTicks={120}
            onEngineStop={() => {
              fgRef.current?.zoomToFit?.(400, 60);
            }}
            nodeCanvasObjectMode={() => "after"}
            nodeCanvasObject={(
              node: GraphNode & { x?: number; y?: number },
              ctx: CanvasRenderingContext2D,
              globalScale: number
            ) => {
              const minPx = isMobile ? 13 : 10;
              const basePx = isMobile ? 15 : 12;
              const fontSize = Math.max(minPx, basePx / globalScale);
              ctx.font = `${fontSize}px serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              const x = node.x ?? 0;
              const y = node.y ?? 0;
              const radiusPad = (isMobile ? 9 : 6) + Math.sqrt(node.highlightCount) * 2;
              const textY = y + radiusPad;
              const metrics = ctx.measureText(node.label);
              const padX = 4;
              const padY = 2;
              ctx.fillStyle = "rgba(255,255,255,0.82)";
              ctx.fillRect(
                x - metrics.width / 2 - padX,
                textY - padY,
                metrics.width + padX * 2,
                fontSize + padY * 2
              );
              ctx.fillStyle = "#1c1917";
              ctx.fillText(node.label, x, textY);
            }}
          />
        )}
      </div>

      {/* Desktop side panel */}
      <aside className="hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 lg:block">
        {!selected ? (
          <div className="text-sm text-[var(--muted-foreground)]">
            Click a node to see the highlights tagged with that concept across your library.
          </div>
        ) : (
          <ConceptPanel
            node={selected}
            highlights={highlights}
            loading={loadingHighlights}
            onClose={clearSelection}
            maxListHeight="max-h-[460px]"
          />
        )}
      </aside>

      {/* Mobile bottom sheet */}
      <div className="lg:hidden" aria-hidden={!selected}>
        {selected && (
          <button
            type="button"
            aria-label="Close highlights"
            onClick={clearSelection}
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]"
          />
        )}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="concept-sheet-title"
          className={
            "fixed inset-x-0 bottom-0 z-50 max-h-[78vh] overflow-hidden rounded-t-2xl border-t border-[var(--border)] bg-[var(--card)] shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out " +
            (selected ? "translate-y-0" : "pointer-events-none translate-y-full")
          }
        >
          <div className="flex justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-[var(--border)]" />
          </div>
          <div className="max-h-[calc(78vh-1.25rem)] overflow-y-auto p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
            {selected && (
              <ConceptPanel
                node={selected}
                highlights={highlights}
                loading={loadingHighlights}
                onClose={clearSelection}
                maxListHeight="max-h-[55vh]"
                titleId="concept-sheet-title"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConceptPanel({
  node,
  highlights,
  loading,
  onClose,
  maxListHeight,
  titleId,
}: {
  node: GraphNode;
  highlights: ConceptHighlight[] | null;
  loading: boolean;
  onClose: () => void;
  maxListHeight: string;
  titleId?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Concept
          </p>
          <h3 id={titleId} className="font-heading text-2xl">
            {node.label}
          </h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            {node.highlightCount} highlight{node.highlightCount === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading highlights…
        </div>
      ) : !highlights || highlights.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">No highlights found.</p>
      ) : (
        <ul className={`${maxListHeight} space-y-2 overflow-y-auto pr-1`}>
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
  );
}
