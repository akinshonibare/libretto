/**
 * LLM-driven concept extraction. Given a highlight body (and surrounding
 * context: book, why), Claude returns 1–4 short conceptual tags. The tags
 * are slug-normalized and merged into the per-user concepts table.
 */

import { CLAUDE_HAIKU_MODEL, getAnthropicClient, isAnthropicConfigured } from "@/lib/ai/anthropic";
import { estimateChatCostCents, recordUsage } from "@/lib/ai/budget";
import type { createClient } from "@/lib/supabase/server";

type SbServer = Awaited<ReturnType<typeof createClient>>;

export type ExtractedConcept = { slug: string; label: string };

const SYSTEM_PROMPT = `You read a single highlight from a book and tag it with 1–4 short conceptual labels — the kinds of tags a careful reader would put in their notebook to find this passage later.

Rules:
  • Each label is 1–4 words, capitalised in title case (e.g. "Solitude", "Civic Trust", "Self-Deception").
  • Prefer recurring, transferrable concepts over one-off proper nouns. ("Solitude" over "Charlotte"; "Civic Trust" over "Putnam".)
  • Skip generic filler ("Idea", "Story", "Reading"). If nothing meaningful, return an empty array.
  • Return VALID JSON only — no preamble, no Markdown fences.`;

// Anthropic structured outputs reject array-level constraints (maxItems/minItems);
// cap to 4 concepts after parsing instead.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
        },
        required: ["label"],
        additionalProperties: false,
      },
    },
  },
  required: ["concepts"],
  additionalProperties: false,
} as const;

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/**
 * Extract concepts and persist them to the per-user concepts table + the
 * join table. Idempotent — running twice for the same highlight is safe.
 *
 * Returns the number of concepts attached.
 */
export async function processHighlightConcepts(
  supabase: SbServer,
  args: { userId: string; highlightId: string; reviewId: string }
): Promise<number> {
  if (!isAnthropicConfigured()) return 0;

  // Skip if we already have concepts for this highlight.
  const { count: existing } = await supabase
    .from("highlight_concepts")
    .select("highlight_id", { count: "exact", head: true })
    .eq("highlight_id", args.highlightId);
  if ((existing ?? 0) > 0) return existing ?? 0;

  type HighlightRow = {
    body: string;
    reviews: { books: { title: string; author: string | null } | null } | null;
  };
  const { data: highlight } = await supabase
    .from("highlights")
    .select("body, reviews(books(title, author))")
    .eq("id", args.highlightId)
    .returns<HighlightRow[]>()
    .maybeSingle();
  if (!highlight) return 0;
  const book = highlight.reviews?.books;
  if (!book) return 0;

  const client = getAnthropicClient();
  if (!client) return 0;

  const userPrompt = `<book>${book.title}${
    book.author ? ` — ${book.author}` : ""
  }</book>\n\n<highlight>${highlight.body.slice(0, 2000)}</highlight>\n\nReturn JSON with up to 4 concepts.`;

  const response = await client.messages.create({
    model: CLAUDE_HAIKU_MODEL,
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
  });

  // Record usage.
  const inputTokens =
    (response.usage.input_tokens ?? 0) +
    (response.usage.cache_creation_input_tokens ?? 0) +
    (response.usage.cache_read_input_tokens ?? 0);
  const outputTokens = response.usage.output_tokens ?? 0;
  const cost = estimateChatCostCents(inputTokens, outputTokens);
  await recordUsage(
    supabase,
    args.userId,
    "anthropic",
    CLAUDE_HAIKU_MODEL,
    inputTokens,
    outputTokens,
    cost
  );

  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  let parsed: { concepts?: Array<{ label?: string }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    return 0;
  }

  const seen = new Set<string>();
  const labels: ExtractedConcept[] = [];
  for (const c of parsed.concepts ?? []) {
    const label = c.label?.trim();
    if (!label) continue;
    const slug = slugify(label);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    labels.push({ slug, label });
    if (labels.length >= 4) break;
  }
  if (labels.length === 0) return 0;

  // Upsert each concept (matched per-user by slug), then join.
  const conceptIds: string[] = [];
  for (const { slug, label } of labels) {
    const { data: existing } = await supabase
      .from("concepts")
      .select("id")
      .eq("user_id", args.userId)
      .eq("slug", slug)
      .maybeSingle();
    if (existing) {
      conceptIds.push(existing.id);
      continue;
    }
    const { data: created } = await supabase
      .from("concepts")
      .insert({ user_id: args.userId, slug, label })
      .select("id")
      .single();
    if (created) conceptIds.push(created.id);
  }

  if (conceptIds.length > 0) {
    await supabase.from("highlight_concepts").upsert(
      conceptIds.map((concept_id) => ({ highlight_id: args.highlightId, concept_id })),
      { onConflict: "highlight_id,concept_id" }
    );
  }

  return conceptIds.length;
}
