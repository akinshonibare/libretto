"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecommendations, type RecommendationResult } from "@/lib/ai/recommendations";

export async function getCachedOrFreshRecommendations(): Promise<RecommendationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/discover");

  // Check cache.
  const { data: cached } = await supabase
    .from("recommendations_cache")
    .select("payload, generated_at, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
    return cached.payload as RecommendationResult;
  }

  const fresh = await getRecommendations(supabase, user.id);
  if (fresh.kind === "ok") {
    await supabase.from("recommendations_cache").upsert({
      user_id: user.id,
      payload: fresh,
      generated_at: fresh.generatedAt,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  return fresh;
}

export async function refreshRecommendationsAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/discover");

  await supabase.from("recommendations_cache").delete().eq("user_id", user.id);
  revalidatePath("/discover");
}
