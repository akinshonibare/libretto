/**
 * SM-2 lite. Three grades:
 *   forgot   — reset interval to 1 day, decrement ease
 *   familiar — multiply current interval by ease, ease unchanged
 *   mastered — multiply current interval by ease + small bonus, increment ease
 *
 * Bounded ease in [1.3, 3.0]. Bounded interval at 365 days so the resurface
 * schedule never goes silent forever.
 */

export type Grade = "forgot" | "familiar" | "mastered";

export type ResurfaceState = {
  ease: number;
  intervalDays: number;
  lapses: number;
  reviewsCount: number;
  lastReviewedAt: string | null;
  nextDueAt: string;
};

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const MAX_INTERVAL_DAYS = 365;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function applyGrade(prev: ResurfaceState, grade: Grade, now = new Date()): ResurfaceState {
  let { ease, intervalDays, lapses, reviewsCount } = prev;
  reviewsCount += 1;

  if (grade === "forgot") {
    lapses += 1;
    ease = clamp(ease - 0.2, MIN_EASE, MAX_EASE);
    intervalDays = 1;
  } else if (grade === "familiar") {
    intervalDays = Math.max(1, Math.round(intervalDays * ease));
  } else {
    ease = clamp(ease + 0.1, MIN_EASE, MAX_EASE);
    intervalDays = Math.max(2, Math.round(intervalDays * ease + 0.5));
  }

  intervalDays = clamp(intervalDays, 1, MAX_INTERVAL_DAYS);
  const nextDue = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    ease,
    intervalDays,
    lapses,
    reviewsCount,
    lastReviewedAt: now.toISOString(),
    nextDueAt: nextDue.toISOString(),
  };
}
