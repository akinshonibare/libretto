import { Network, Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConceptMap } from "@/components/concept-map";
import { requireUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { loadKnowledgeGraph } from "@/lib/graph-data";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { rebuildConceptGraphAction } from "@/app/actions/concepts";

export const dynamic = "force-dynamic";

export default async function GraphPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const data = await loadKnowledgeGraph(supabase, profile.id);

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
              Concepts auto-extracted from your highlights. Tap any chip to follow a thread across your library.
            </p>
          </div>
          <form action={rebuildAndReturn}>
            <Button type="submit" variant="outline" size="sm">
              <Sparkles className="size-4" /> Rebuild / refresh
            </Button>
          </form>
        </div>

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
              <h2 className="font-heading text-2xl">No graph yet</h2>
              <p className="max-w-md text-sm text-[var(--muted-foreground)]">
                Capture a few highlights — concepts are tagged in the background. Click <em>Rebuild / refresh</em> above to backfill any older highlights.
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
