"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { processHighlightConcepts } from "@/lib/ai/concepts";

/**
 * Process all of a user's highlights that don't yet have any concepts attached.
 * Triggered on /graph load (or via "Rebuild graph" button) so we don't
 * pile up Claude calls during normal session capture.
 *
 * Returns counts so the UI can show "processed N highlights".
 */
export async function rebuildConceptGraphAction(): Promise<{ processed: number; skipped: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/graph");

  // Fetch the user's highlight IDs along with which already have concept rows.
  type Row = { id: string; review_id: string };
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", user.id);
  const reviewIds = (reviewRows ?? []).map((r) => r.id);
  if (reviewIds.length === 0) return { processed: 0, skipped: 0 };

  const { data: highlights } = await supabase
    .from("highlights")
    .select("id, review_id")
    .in("review_id", reviewIds)
    .returns<Row[]>();

  if (!highlights || highlights.length === 0) return { processed: 0, skipped: 0 };

  const { data: hasConcepts } = await supabase
    .from("highlight_concepts")
    .select("highlight_id")
    .in(
      "highlight_id",
      highlights.map((h) => h.id)
    );
  const tagged = new Set((hasConcepts ?? []).map((r) => r.highlight_id));

  let processed = 0;
  let skipped = 0;
  // Cap at 25 highlights per call to bound latency + cost on big libraries.
  const queue = highlights.filter((h) => !tagged.has(h.id)).slice(0, 25);
  for (const h of queue) {
    try {
      const n = await processHighlightConcepts(supabase, {
        userId: user.id,
        highlightId: h.id,
        reviewId: h.review_id,
      });
      if (n > 0) processed += 1;
      else skipped += 1;
    } catch (err) {
      console.error("[concepts]", h.id, err);
      skipped += 1;
    }
  }

  revalidatePath("/graph");
  return { processed, skipped };
}
