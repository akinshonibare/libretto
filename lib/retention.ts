/**
 * Retention helpers — streaks, library heart, badge awards.
 * Server-only. Pulled into server actions and dashboard data fetches.
 */

import { createClient } from "@/lib/supabase/server";

type SbServer = Awaited<ReturnType<typeof createClient>>;

export const BADGE_ICONS: Record<string, string> = {
  "book-open": "📖",
  "library": "📚",
  "crown": "👑",
  "highlighter": "🖍️",
  "flame": "🔥",
  "play": "▶️",
  "share": "↗",
  "sparkle": "✨",
};

/**
 * Bump the user's streak. Idempotent within a calendar day.
 * Uses the server's local "today" — fine for solo use; for global users we
 * could store a tz on profiles and adjust.
 */
export async function touchStreak(supabase: SbServer, userId: string): Promise<void> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: existing } = await supabase
    .from("streaks")
    .select("current, longest, last_logged_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("streaks").insert({
      user_id: userId,
      current: 1,
      longest: 1,
      last_logged_date: todayStr,
    });
    return;
  }

  if (existing.last_logged_date === todayStr) return; // already counted today

  const last = existing.last_logged_date ? new Date(existing.last_logged_date) : null;
  const yesterdayStr = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10);

  const next =
    last && existing.last_logged_date === yesterdayStr ? existing.current + 1 : 1;
  const longest = Math.max(existing.longest, next);

  await supabase
    .from("streaks")
    .update({ current: next, longest, last_logged_date: todayStr, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

/**
 * Compute & cache the user's Library Heart (0–100).
 * Components:
 *   activity (40) — actions in the past 14 days, log-scaled
 *   density  (30) — highlights/finished books ratio (capped)
 *   variety  (15) — distinct-author count over last 90d
 *   streak   (15) — current streak, log-scaled
 */
export async function recomputeLibraryHeart(
  supabase: SbServer,
  userId: string
): Promise<{ score: number; components: Record<string, number> }> {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  const [{ count: actions }, { count: highlightCount }, { count: finishedBooks }, { data: variety }, { data: streak }] =
    await Promise.all([
      supabase
        .from("highlights")
        .select("id", { count: "exact", head: true })
        .gte("created_at", fourteenDaysAgo)
        .in(
          "review_id",
          (await supabase.from("reviews").select("id").eq("user_id", userId)).data?.map((r) => r.id) ?? ["00000000-0000-0000-0000-000000000000"]
        ),
      supabase
        .from("highlights")
        .select("id", { count: "exact", head: true })
        .in(
          "review_id",
          (await supabase.from("reviews").select("id").eq("user_id", userId)).data?.map((r) => r.id) ?? ["00000000-0000-0000-0000-000000000000"]
        ),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "finished"),
      supabase
        .from("reviews")
        .select("books(author)")
        .eq("user_id", userId)
        .gte("updated_at", ninetyDaysAgo)
        .returns<Array<{ books: { author: string | null } | null }>>(),
      supabase.from("streaks").select("current").eq("user_id", userId).maybeSingle(),
    ]);

  const activityScore = Math.min(40, Math.round((Math.log10((actions ?? 0) + 1) / Math.log10(50)) * 40));
  const densityScore =
    finishedBooks && finishedBooks > 0
      ? Math.min(30, Math.round(((highlightCount ?? 0) / Math.max(1, finishedBooks)) * 3))
      : (highlightCount ?? 0) > 0
        ? 10
        : 0;
  const distinctAuthors = new Set(
    (variety ?? []).map((r) => r.books?.author?.trim().toLowerCase()).filter(Boolean) as string[]
  ).size;
  const varietyScore = Math.min(15, Math.round((distinctAuthors / 10) * 15));
  const streakScore = Math.min(
    15,
    Math.round((Math.log10((streak?.current ?? 0) + 1) / Math.log10(30)) * 15)
  );

  const components = {
    activity: activityScore,
    density: densityScore,
    variety: varietyScore,
    streak: streakScore,
  };
  const score = Math.min(100, activityScore + densityScore + varietyScore + streakScore);

  await supabase
    .from("library_heart")
    .upsert({
      user_id: userId,
      score,
      components,
      updated_at: new Date().toISOString(),
    });

  return { score, components };
}

/**
 * Check the user's metrics and award any newly-earned badges.
 * Returns the badge ids awarded in this call.
 */
export async function checkAndAwardBadges(
  supabase: SbServer,
  userId: string
): Promise<string[]> {
  const [{ count: reviewsFinished }, { data: reviewIdsRows }, { data: streakRow }, { data: alreadyHave }] =
    await Promise.all([
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "finished"),
      supabase.from("reviews").select("id").eq("user_id", userId),
      supabase.from("streaks").select("longest").eq("user_id", userId).maybeSingle(),
      supabase.from("user_badges").select("badge_id").eq("user_id", userId),
    ]);

  const reviewIds = (reviewIdsRows ?? []).map((r) => r.id);
  const { count: highlightsTotal } = await supabase
    .from("highlights")
    .select("id", { count: "exact", head: true })
    .in("review_id", reviewIds.length ? reviewIds : ["00000000-0000-0000-0000-000000000000"]);

  const { count: sessionsTotal } = await supabase
    .from("reading_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("ended_at", "is", null);

  const { count: sharesTotal } = await supabase
    .from("review_share_tokens")
    .select("token", { count: "exact", head: true })
    .eq("created_by", userId);

  const metrics: Record<string, number> = {
    reviews_finished: reviewsFinished ?? 0,
    highlights_total: highlightsTotal ?? 0,
    streak_days: streakRow?.longest ?? 0,
    sessions_total: sessionsTotal ?? 0,
    shares_total: sharesTotal ?? 0,
    genres_distinct: 0,
  };

  const { data: catalog } = await supabase.from("badges").select("id, threshold, metric");
  const owned = new Set((alreadyHave ?? []).map((b) => b.badge_id));
  const earned: string[] = [];

  for (const badge of catalog ?? []) {
    if (owned.has(badge.id)) continue;
    const value = metrics[badge.metric] ?? 0;
    if (badge.threshold != null && value >= badge.threshold) {
      earned.push(badge.id);
    }
  }

  if (earned.length > 0) {
    await supabase
      .from("user_badges")
      .insert(earned.map((id) => ({ user_id: userId, badge_id: id })));
  }
  return earned;
}
