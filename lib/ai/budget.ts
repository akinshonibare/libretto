/**
 * Daily AI spend cap per user.
 * Default budget: $1/day. Override with AI_DAILY_BUDGET_CENTS in env.
 *
 * Pricing (May 2026):
 *   Claude Haiku 4.5  — $1/MTok in / $5/MTok out
 *   text-embedding-3-small — $0.02/MTok
 */

import type { createClient } from "@/lib/supabase/server";

type SbServer = Awaited<ReturnType<typeof createClient>>;

export const HAIKU_INPUT_PER_MTOK_CENTS = 100;   // $1 / 1M tokens = 100¢ / 1M = 0.0001¢/tok
export const HAIKU_OUTPUT_PER_MTOK_CENTS = 500;  // $5 / 1M = 500¢ / 1M
export const EMBED_PER_MTOK_CENTS = 2;           // $0.02 / 1M

export function dailyBudgetCents(): number {
  const raw = process.env.AI_DAILY_BUDGET_CENTS;
  const parsed = raw ? Number(raw) : 100;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

export function estimateChatCostCents(inputTokens: number, outputTokens: number): number {
  return Math.ceil(
    (inputTokens * HAIKU_INPUT_PER_MTOK_CENTS) / 1_000_000 +
      (outputTokens * HAIKU_OUTPUT_PER_MTOK_CENTS) / 1_000_000
  );
}

export function estimateEmbedCostCents(tokens: number): number {
  return Math.ceil((tokens * EMBED_PER_MTOK_CENTS) / 1_000_000);
}

export type UsageSnapshot = {
  spentCents: number;
  budgetCents: number;
  remainingCents: number;
};

export async function getUsageToday(supabase: SbServer, userId: string): Promise<UsageSnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("ai_usage")
    .select("estimated_cost_cents")
    .eq("user_id", userId)
    .eq("day", today);

  const spent = (data ?? []).reduce((sum, r) => sum + (r.estimated_cost_cents ?? 0), 0);
  const budget = dailyBudgetCents();
  return { spentCents: spent, budgetCents: budget, remainingCents: Math.max(0, budget - spent) };
}

export async function recordUsage(
  supabase: SbServer,
  userId: string,
  provider: "anthropic" | "openai",
  model: string,
  inputTokens: number,
  outputTokens: number,
  costCents: number
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  // Upsert pattern: try update, fall back to insert.
  const { data: existing } = await supabase
    .from("ai_usage")
    .select("input_tokens, output_tokens, estimated_cost_cents")
    .eq("user_id", userId)
    .eq("day", today)
    .eq("provider", provider)
    .eq("model", model)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("ai_usage")
      .update({
        input_tokens: (existing.input_tokens ?? 0) + inputTokens,
        output_tokens: (existing.output_tokens ?? 0) + outputTokens,
        estimated_cost_cents: (existing.estimated_cost_cents ?? 0) + costCents,
      })
      .eq("user_id", userId)
      .eq("day", today)
      .eq("provider", provider)
      .eq("model", model);
  } else {
    await supabase.from("ai_usage").insert({
      user_id: userId,
      day: today,
      provider,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_cents: costCents,
    });
  }
}
