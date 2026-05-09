"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkAndAwardBadges, touchStreak } from "@/lib/retention";
import { processHighlightConcepts } from "@/lib/ai/concepts";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

const HighlightInput = z.object({
  reviewId: z.string().uuid(),
  body: z.string().min(1, "Highlight is empty.").max(4000),
  page: z.coerce.number().int().min(0).max(99999).optional(),
  sessionId: z.string().uuid().optional(),
});

export async function addHighlightAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const parsed = HighlightInput.safeParse({
    reviewId: formData.get("reviewId"),
    body: formData.get("body"),
    page: formData.get("page") || undefined,
    sessionId: formData.get("sessionId") || undefined,
  });
  if (!parsed.success) return;

  const { data: inserted, error } = await supabase
    .from("highlights")
    .insert({
      review_id: parsed.data.reviewId,
      body: parsed.data.body,
      page: parsed.data.page ?? null,
      session_id: parsed.data.sessionId ?? null,
      source: parsed.data.sessionId ? "session" : "manual",
    })
    .select("id")
    .single();
  if (error) console.error("[addHighlight]", error);

  await touchStreak(supabase, user.id);
  await checkAndAwardBadges(supabase, user.id);

  revalidatePath(`/library/${parsed.data.reviewId}`);
  revalidatePath("/dashboard");
  if (parsed.data.sessionId) {
    revalidatePath(`/library/${parsed.data.reviewId}/session/${parsed.data.sessionId}`);
  }

  // Fire-and-forget: extract concepts after the response so the user isn't
  // blocked on a Claude round-trip just to save a highlight.
  if (inserted && isAnthropicConfigured()) {
    const highlightId = inserted.id;
    const reviewId = parsed.data.reviewId;
    const userId = user.id;
    after(async () => {
      try {
        const sb = await createClient();
        await processHighlightConcepts(sb, { userId, highlightId, reviewId });
        revalidatePath("/graph");
      } catch (err) {
        console.error("[concepts/after]", err);
      }
    });
  }
}

export async function deleteHighlightAction(highlightId: string, reviewId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  await supabase.from("highlights").delete().eq("id", highlightId);
  revalidatePath(`/library/${reviewId}`);
}
