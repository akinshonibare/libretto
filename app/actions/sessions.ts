"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ReadingMode } from "@/lib/supabase/types";

const VALID_MODES: ReadingMode[] = ["absorb", "study", "challenge", "apply", "enjoy"];

export async function startSessionAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const reviewId = formData.get("reviewId");
  const modeRaw = formData.get("mode");
  if (typeof reviewId !== "string") return;
  const mode = (typeof modeRaw === "string" && VALID_MODES.includes(modeRaw as ReadingMode)
    ? (modeRaw as ReadingMode)
    : "enjoy");

  const { data, error } = await supabase
    .from("reading_sessions")
    .insert({ review_id: reviewId, user_id: user.id, mode })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[startSession]", error);
    return;
  }

  revalidatePath(`/library/${reviewId}`);
  redirect(`/library/${reviewId}/session/${data.id}`);
}

export async function endSessionAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const sessionId = formData.get("sessionId");
  const reviewId = formData.get("reviewId");
  if (typeof sessionId !== "string" || typeof reviewId !== "string") return;

  await supabase
    .from("reading_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  revalidatePath(`/library/${reviewId}`);
  redirect(`/library/${reviewId}`);
}
