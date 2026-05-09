"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("highlights").insert({
    review_id: parsed.data.reviewId,
    body: parsed.data.body,
    page: parsed.data.page ?? null,
    session_id: parsed.data.sessionId ?? null,
    source: parsed.data.sessionId ? "session" : "manual",
  });
  if (error) console.error("[addHighlight]", error);

  revalidatePath(`/library/${parsed.data.reviewId}`);
  if (parsed.data.sessionId) {
    revalidatePath(`/library/${parsed.data.reviewId}/session/${parsed.data.sessionId}`);
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
