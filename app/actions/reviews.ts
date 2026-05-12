"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { checkAndAwardBadges, touchStreak } from "@/lib/retention";
import type { ReadingMode, ReadingStatus } from "@/lib/supabase/types";

const READING_MODES = ["absorb", "study", "challenge", "apply", "enjoy"] as const;
const READING_STATUSES = ["reading", "finished", "dnf"] as const;

const ReviewInput = z.object({
  bookOpenLibraryId: z.string().optional(),
  bookTitle: z.string().min(1, "A title is required").max(300),
  bookAuthor: z.string().max(200).optional(),
  bookCoverUrl: z.string().url().optional().or(z.literal("")).optional(),
  bookYear: z.coerce.number().int().min(0).max(3000).optional(),
  bookIsbn: z.string().max(40).optional(),
  status: z.enum(READING_STATUSES).default("reading"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  liked: z.enum(["yes", "no", "unset"]).default("unset"),
  why: z.string().max(4000).optional(),
  synopsis: z.string().max(4000).optional(),
  readingMode: z.enum(READING_MODES).default("enjoy"),
  isPublic: z.enum(["on", "off"]).default("on"),
});

function fdToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  fd.forEach((value, key) => {
    obj[key] = value === "" ? undefined : value;
  });
  return obj;
}

async function ensureBook(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: z.infer<typeof ReviewInput>
): Promise<string> {
  const olid = input.bookOpenLibraryId?.trim() || null;

  if (olid) {
    const { data: existing } = await supabase
      .from("books")
      .select("id")
      .eq("openlibrary_id", olid)
      .maybeSingle();
    if (existing) return existing.id;
  }

  const baseSlug = slugify(`${input.bookTitle}${input.bookAuthor ? "-" + input.bookAuthor : ""}`);
  let slug = baseSlug || `book-${Date.now()}`;

  // De-dupe slug by appending a numeric suffix on conflict.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? slug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("books")
      .insert({
        openlibrary_id: olid,
        isbn: input.bookIsbn || null,
        title: input.bookTitle,
        author: input.bookAuthor || null,
        cover_url: input.bookCoverUrl || null,
        year: input.bookYear ?? null,
        slug: candidate,
      })
      .select("id")
      .single();

    if (!error && data) return data.id;
    if (error && !/duplicate key|unique constraint/i.test(error.message)) throw error;
    slug = candidate;
  }
  throw new Error("Could not create book record after several attempts.");
}

export type CreateReviewResult =
  | { ok: true; reviewId: string }
  | { ok: false; error: string };

export async function createReviewAction(formData: FormData): Promise<CreateReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const parsed = ReviewInput.safeParse(fdToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const bookId = await ensureBook(supabase, input);

  const { data: review, error } = await supabase
    .from("reviews")
    .upsert(
      {
        user_id: user.id,
        book_id: bookId,
        status: input.status as ReadingStatus,
        rating: input.rating ?? null,
        liked: input.liked === "yes" ? true : input.liked === "no" ? false : null,
        why: input.why || null,
        synopsis: input.synopsis || null,
        reading_mode: input.readingMode as ReadingMode,
        is_public: input.isPublic === "on",
      },
      { onConflict: "user_id,book_id" }
    )
    .select("id")
    .single();

  if (error || !review) {
    return { ok: false, error: error?.message ?? "Could not save review." };
  }

  await touchStreak(supabase, user.id);
  await checkAndAwardBadges(supabase, user.id);

  revalidatePath("/library");
  revalidatePath(`/library/${review.id}`);
  revalidatePath("/dashboard");
  return { ok: true, reviewId: review.id };
}

const ReviewUpdateInput = z.object({
  reviewId: z.string().uuid(),
  status: z.enum(READING_STATUSES).default("reading"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  liked: z.enum(["yes", "no", "unset"]).default("unset"),
  why: z.string().max(4000).optional(),
  synopsis: z.string().max(4000).optional(),
  readingMode: z.enum(READING_MODES).default("enjoy"),
  isPublic: z.enum(["on", "off"]).default("off"),
});

export type UpdateReviewResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateReviewAction(formData: FormData): Promise<UpdateReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const parsed = ReviewUpdateInput.safeParse(fdToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const { error } = await supabase
    .from("reviews")
    .update({
      status: input.status as ReadingStatus,
      rating: input.rating ?? null,
      liked: input.liked === "yes" ? true : input.liked === "no" ? false : null,
      why: input.why || null,
      synopsis: input.synopsis || null,
      reading_mode: input.readingMode as ReadingMode,
      is_public: input.isPublic === "on",
    })
    .eq("id", input.reviewId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  await touchStreak(supabase, user.id);
  await checkAndAwardBadges(supabase, user.id);

  revalidatePath("/library");
  revalidatePath(`/library/${input.reviewId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteReviewAction(reviewId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", user.id);
  revalidatePath("/library");
  redirect("/library");
}

const ChapterNoteInput = z.object({
  reviewId: z.string().uuid(),
  label: z.string().max(200).optional(),
  body: z.string().min(1, "Note can't be empty.").max(4000),
  page: z.coerce.number().int().min(0).max(99999).optional(),
});

export async function addChapterNoteAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const parsed = ChapterNoteInput.safeParse(fdToObject(formData));
  if (!parsed.success) return;

  const { error } = await supabase.from("chapter_notes").insert({
    review_id: parsed.data.reviewId,
    label: parsed.data.label || null,
    body: parsed.data.body,
    page: parsed.data.page ?? null,
  });
  if (error) console.error("[chapter_notes]", error);
  await touchStreak(supabase, user.id);
  revalidatePath(`/library/${parsed.data.reviewId}`);
}

const ChapterNoteUpdateInput = z.object({
  id: z.string().uuid(),
  reviewId: z.string().uuid(),
  label: z.string().max(200).optional(),
  body: z.string().min(1, "Note can't be empty.").max(4000),
  page: z.coerce.number().int().min(0).max(99999).optional(),
});

export type UpdateChapterNoteResult = { ok: true } | { ok: false; error: string };

export async function updateChapterNoteAction(
  formData: FormData
): Promise<UpdateChapterNoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You need to be signed in." };

  const parsed = ChapterNoteUpdateInput.safeParse(fdToObject(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { error } = await supabase
    .from("chapter_notes")
    .update({
      label: parsed.data.label || null,
      body: parsed.data.body,
      page: parsed.data.page ?? null,
    })
    .eq("id", parsed.data.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/library/${parsed.data.reviewId}`);
  return { ok: true };
}

export async function deleteChapterNoteAction(noteId: string, reviewId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  await supabase.from("chapter_notes").delete().eq("id", noteId);
  revalidatePath(`/library/${reviewId}`);
}
