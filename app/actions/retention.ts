"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyGrade, type Grade, type ResurfaceState } from "@/lib/spaced-repetition";
import { checkAndAwardBadges, touchStreak } from "@/lib/retention";

export async function touchStreakAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await touchStreak(supabase, user.id);
  await checkAndAwardBadges(supabase, user.id);
  revalidatePath("/", "layout");
}

export async function gradeHighlightAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const highlightId = formData.get("highlightId");
  const grade = formData.get("grade");
  if (typeof highlightId !== "string" || typeof grade !== "string") return;
  if (grade !== "forgot" && grade !== "familiar" && grade !== "mastered") return;

  const { data: row } = await supabase
    .from("resurface_schedule")
    .select("ease, interval_days, lapses, reviews_count, last_reviewed_at, next_due_at")
    .eq("highlight_id", highlightId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return;

  const prev: ResurfaceState = {
    ease: row.ease,
    intervalDays: row.interval_days,
    lapses: row.lapses,
    reviewsCount: row.reviews_count,
    lastReviewedAt: row.last_reviewed_at,
    nextDueAt: row.next_due_at,
  };
  const next = applyGrade(prev, grade as Grade);

  await supabase
    .from("resurface_schedule")
    .update({
      ease: next.ease,
      interval_days: next.intervalDays,
      lapses: next.lapses,
      reviews_count: next.reviewsCount,
      last_reviewed_at: next.lastReviewedAt,
      next_due_at: next.nextDueAt,
    })
    .eq("highlight_id", highlightId)
    .eq("user_id", user.id);

  await touchStreak(supabase, user.id);
  await checkAndAwardBadges(supabase, user.id);

  revalidatePath("/today");
  revalidatePath("/dashboard");
}
