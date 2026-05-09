"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function generateToken(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Mint (or reuse) a share token for a review. Used for sharing private reviews
 * via /r/[id]?t=... — the route checks the token before bypassing is_public.
 */
export async function getOrCreateShareTokenAction(reviewId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Reuse the most recent active token to avoid sprawl.
  const { data: existing } = await supabase
    .from("review_share_tokens")
    .select("token")
    .eq("review_id", reviewId)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const token = generateToken();
  const { error } = await supabase.from("review_share_tokens").insert({
    token,
    review_id: reviewId,
    created_by: user.id,
  });
  if (error) {
    console.error("[shareToken]", error);
    return null;
  }
  revalidatePath(`/library/${reviewId}`);
  return token;
}

/**
 * Toggle a review's public/private state.
 */
export async function toggleReviewPublicAction(reviewId: string, isPublic: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("reviews")
    .update({ is_public: isPublic })
    .eq("id", reviewId)
    .eq("user_id", user.id);

  revalidatePath(`/library/${reviewId}`);
  revalidatePath(`/r/${reviewId}`);
}
