import { Sparkles, RefreshCw, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import {
  getCachedOrFreshRecommendations,
  refreshRecommendationsAction,
} from "@/app/actions/discover";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const { profile } = await requireUser();
  const result = await getCachedOrFreshRecommendations();

  return (
    <AppShell handle={profile.handle}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-[var(--accent)]" />
              <h1 className="font-heading text-4xl tracking-tight">Discover</h1>
            </div>
            <p className="mt-2 text-[var(--muted-foreground)]">
              Picks shaped by what you&rsquo;ve read and rated. Refreshes daily.
            </p>
          </div>
          {result.kind === "ok" && (
            <form action={refreshRecommendationsAction}>
              <Button type="submit" variant="outline" size="sm">
                <RefreshCw className="size-4" /> Refresh now
              </Button>
            </form>
          )}
        </div>

        {result.kind === "ok" ? (
          <>
            {result.tasteSummary && (
              <p className="mt-6 prose-quote text-base">
                &ldquo;{result.tasteSummary}&rdquo;
              </p>
            )}
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.recommendations.map((rec) => (
                <li key={rec.openlibraryId}>
                  <Card className="h-full">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {rec.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={rec.coverUrl}
                            alt=""
                            className="h-24 w-16 shrink-0 rounded-sm border border-[var(--border)] object-cover"
                          />
                        ) : (
                          <div className="h-24 w-16 shrink-0 rounded-sm border border-[var(--border)] bg-[var(--muted)]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-heading text-lg leading-tight line-clamp-2">
                            {rec.title}
                          </p>
                          {rec.author && (
                            <p className="text-sm text-[var(--muted-foreground)]">
                              {rec.author}
                              {rec.year ? ` · ${rec.year}` : ""}
                            </p>
                          )}
                          <a
                            href={`https://openlibrary.org/${rec.openlibraryId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:underline"
                          >
                            OpenLibrary <ExternalLink className="size-3" />
                          </a>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed">{rec.reason}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-xs text-[var(--muted-foreground)]">
              Generated {new Date(result.generatedAt).toLocaleString()}.
            </p>
          </>
        ) : (
          <Empty result={result} />
        )}
      </div>
    </AppShell>
  );
}

function Empty({ result }: { result: Exclude<Awaited<ReturnType<typeof getCachedOrFreshRecommendations>>, { kind: "ok" }> }) {
  const message = (() => {
    switch (result.kind) {
      case "no-history":
        return result.message;
      case "no-key":
        return "AI is not configured — set ANTHROPIC_API_KEY in your env to enable recommendations.";
      case "budget-exhausted":
        return `You've hit today's AI budget ($${(result.budgetCents / 100).toFixed(2)} of $${(result.budgetCents / 100).toFixed(2)}). Resets at midnight.`;
      case "error":
        return result.message;
    }
  })();

  return (
    <Card className="mt-10">
      <CardContent className="p-8 text-center">
        <p className="text-sm text-[var(--muted-foreground)]">{message}</p>
      </CardContent>
    </Card>
  );
}
