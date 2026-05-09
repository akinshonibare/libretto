/**
 * Anthropic-only recommendations. No embeddings.
 *
 * Pipeline:
 *   1. Pull user's read books + likes/whys from Supabase
 *   2. Look up subjects of their best-rated books on OpenLibrary
 *   3. Build a candidate pool from subject-similar books (de-duped vs read)
 *   4. Ask Claude to pick the top N and write a 2-sentence "why" each
 *
 * Cached per-user for 24h via the cache table; LLM call only fires on cache miss.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  fetchSubjectBooks,
  fetchWorkSubjects,
  type SubjectBook,
} from "@/lib/openlibrary-subjects";
import {
  CLAUDE_HAIKU_MODEL,
  getAnthropicClient,
  isAnthropicConfigured,
} from "@/lib/ai/anthropic";
import {
  estimateChatCostCents,
  getUsageToday,
  recordUsage,
} from "@/lib/ai/budget";
import type { createClient } from "@/lib/supabase/server";

type SbServer = Awaited<ReturnType<typeof createClient>>;

export type Recommendation = {
  openlibraryId: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  year: number | null;
  reason: string;
};

export type RecommendationResult =
  | { kind: "ok"; recommendations: Recommendation[]; tasteSummary: string; generatedAt: string }
  | { kind: "no-history"; message: string }
  | { kind: "no-key" }
  | { kind: "budget-exhausted"; spentCents: number; budgetCents: number }
  | { kind: "error"; message: string };

const MAX_CANDIDATES = 30;
const TOP_N = 6;

export async function getRecommendations(
  supabase: SbServer,
  userId: string
): Promise<RecommendationResult> {
  if (!isAnthropicConfigured()) return { kind: "no-key" };

  const usage = await getUsageToday(supabase, userId);
  if (usage.remainingCents <= 0) {
    return {
      kind: "budget-exhausted",
      spentCents: usage.spentCents,
      budgetCents: usage.budgetCents,
    };
  }

  const reviews = await loadUserReadingProfile(supabase, userId);
  if (reviews.length === 0) {
    return {
      kind: "no-history",
      message: "Add a couple of books to your library — recommendations sharpen with each one.",
    };
  }

  const candidates = await buildCandidatePool(reviews);
  if (candidates.length === 0) {
    return {
      kind: "no-history",
      message:
        "Couldn't pull enough subject metadata from OpenLibrary for the books you've added — try logging another title or two.",
    };
  }

  const client = getAnthropicClient();
  if (!client) return { kind: "no-key" };

  try {
    const result = await rankWithClaude(client, supabase, userId, reviews, candidates);
    return result;
  } catch (err) {
    console.error("[recommendations]", err);
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Recommendation step failed.",
    };
  }
}

// ---------------- Reading profile ----------------

type ReviewSummary = {
  title: string;
  author: string | null;
  openlibraryId: string | null;
  rating: number | null;
  liked: boolean | null;
  why: string | null;
  status: string;
};

async function loadUserReadingProfile(
  supabase: SbServer,
  userId: string
): Promise<ReviewSummary[]> {
  type Row = {
    rating: number | null;
    liked: boolean | null;
    why: string | null;
    status: string;
    books: { title: string; author: string | null; openlibrary_id: string | null } | null;
  };
  const { data } = await supabase
    .from("reviews")
    .select("rating, liked, why, status, books(title, author, openlibrary_id)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40)
    .returns<Row[]>();

  return (data ?? [])
    .filter((r) => r.books)
    .map((r) => ({
      title: r.books!.title,
      author: r.books!.author,
      openlibraryId: r.books!.openlibrary_id,
      rating: r.rating,
      liked: r.liked,
      why: r.why,
      status: r.status,
    }));
}

// ---------------- Candidate pool ----------------

async function buildCandidatePool(reviews: ReviewSummary[]): Promise<SubjectBook[]> {
  const seedReviews = reviews
    .filter((r) => r.openlibraryId && (r.liked === true || (r.rating ?? 0) >= 4))
    .slice(0, 5);

  // Fall back to recent reads if no liked/4-star books.
  const seeds = seedReviews.length > 0
    ? seedReviews
    : reviews.filter((r) => r.openlibraryId).slice(0, 5);

  const subjectsLists = await Promise.all(
    seeds.map((r) => fetchWorkSubjects(r.openlibraryId!).catch(() => [] as string[]))
  );

  // Pick the most common 4 subjects across seeds.
  const counts = new Map<string, number>();
  for (const subjects of subjectsLists) {
    for (const subject of subjects.slice(0, 8)) {
      counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }
  }
  const topSubjects = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([s]) => s);

  if (topSubjects.length === 0) return [];

  const candidatePages = await Promise.all(
    topSubjects.map((s) => fetchSubjectBooks(s, 12).catch(() => [] as SubjectBook[]))
  );
  const flat = candidatePages.flat();

  const readTitles = new Set(reviews.map((r) => r.title.toLowerCase()));
  const seen = new Set<string>();
  const candidates: SubjectBook[] = [];
  for (const book of flat) {
    if (!book.openlibraryId) continue;
    if (seen.has(book.openlibraryId)) continue;
    if (readTitles.has(book.title.toLowerCase())) continue;
    seen.add(book.openlibraryId);
    candidates.push(book);
    if (candidates.length >= MAX_CANDIDATES) break;
  }
  return candidates;
}

// ---------------- Claude re-rank ----------------

const RANK_SYSTEM = `You are Libretto's literary recommender. The user has shared the books they've read with their notes and ratings. Your job: pick books from a candidate list they're most likely to love and explain the match in 1–2 sentences each.

Style:
  • Honest and specific. Tie the explanation to the user's actual notes/ratings — don't speak in generalities.
  • If a candidate is a poor fit, drop it. Better to return 4 strong picks than 6 mediocre ones.
  • Avoid books you can tell from context the user has already read.
  • Output VALID JSON only — no preamble, no commentary, no Markdown fences.`;

// Anthropic structured outputs don't accept array-level constraints
// (maxItems, minItems). The TOP_N cap is enforced after parsing.
const RANK_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    taste_summary: {
      type: "string",
      description: "One sentence describing the user's reading taste based on their library.",
    },
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          openlibrary_id: { type: "string" },
          reason: { type: "string", description: "1-2 sentences tying the pick to the user's notes." },
        },
        required: ["openlibrary_id", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["taste_summary", "picks"],
  additionalProperties: false,
} as const;

async function rankWithClaude(
  client: Anthropic,
  supabase: SbServer,
  userId: string,
  reviews: ReviewSummary[],
  candidates: SubjectBook[]
): Promise<RecommendationResult> {
  const profile = reviews
    .slice(0, 25)
    .map((r, i) => {
      const meta = [
        `${i + 1}.`,
        r.title + (r.author ? ` — ${r.author}` : ""),
        r.status === "finished" ? "" : `[${r.status}]`,
        r.rating ? `${"★".repeat(r.rating)}` : "",
        r.liked === true ? "(liked)" : r.liked === false ? "(disliked)" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const why = r.why ? `   why: ${r.why.slice(0, 240)}` : "";
      return [meta, why].filter(Boolean).join("\n");
    })
    .join("\n");

  const candidatesText = candidates
    .map(
      (c, i) =>
        `${i + 1}. id=${c.openlibraryId} | ${c.title}${c.author ? ` — ${c.author}` : ""}${
          c.year ? ` (${c.year})` : ""
        }`
    )
    .join("\n");

  const userPrompt = `<reading_profile>\n${profile}\n</reading_profile>\n\n<candidates>\n${candidatesText}\n</candidates>\n\nReturn JSON matching the schema. Limit to ${TOP_N} picks max.`;

  const response = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 1500,
    system: RANK_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: { type: "json_schema", schema: RANK_OUTPUT_SCHEMA } },
  });

  // Record usage.
  const inputTokens =
    (response.usage.input_tokens ?? 0) +
    (response.usage.cache_creation_input_tokens ?? 0) +
    (response.usage.cache_read_input_tokens ?? 0);
  const outputTokens = response.usage.output_tokens ?? 0;
  const cost = estimateChatCostCents(inputTokens, outputTokens);
  await recordUsage(supabase, userId, "anthropic", CLAUDE_HAIKU_MODEL, inputTokens, outputTokens, cost);

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: { taste_summary?: string; picks?: Array<{ openlibrary_id?: string; reason?: string }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "error", message: "Recommender returned malformed JSON." };
  }

  const byId = new Map(candidates.map((c) => [c.openlibraryId, c]));
  const picks: Recommendation[] = (parsed.picks ?? [])
    .map((p) => {
      const id = p.openlibrary_id ?? "";
      const book = byId.get(id);
      if (!book || !p.reason) return null;
      return {
        openlibraryId: book.openlibraryId,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        year: book.year,
        reason: p.reason,
      };
    })
    .filter((p): p is Recommendation => p !== null)
    .slice(0, TOP_N);

  return {
    kind: "ok",
    recommendations: picks,
    tasteSummary: parsed.taste_summary ?? "",
    generatedAt: new Date().toISOString(),
  };
}
