"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

// ---------------- Follows ----------------

export async function followAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const target = formData.get("targetUserId");
  const handle = formData.get("targetHandle");
  if (typeof target !== "string") return;
  if (target === user.id) return;

  await supabase.from("follows").insert({ follower_id: user.id, followee_id: target });

  if (typeof handle === "string") revalidatePath(`/u/${handle}`);
  revalidatePath("/feed");
}

export async function unfollowAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const target = formData.get("targetUserId");
  const handle = formData.get("targetHandle");
  if (typeof target !== "string") return;

  await supabase.from("follows").delete().eq("follower_id", user.id).eq("followee_id", target);

  if (typeof handle === "string") revalidatePath(`/u/${handle}`);
  revalidatePath("/feed");
}

// ---------------- Reactions ----------------

const ReactionInput = z.object({
  targetType: z.enum(["review", "highlight"]),
  targetId: z.string().uuid(),
  kind: z.enum(["star", "this_hit", "bookmark"]),
  on: z.enum(["true", "false"]),
  redirectTo: z.string().optional(),
});

export async function toggleReactionAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const parsed = ReactionInput.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    kind: formData.get("kind"),
    on: formData.get("on"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) return;

  if (parsed.data.on === "true") {
    await supabase.from("reactions").upsert(
      {
        user_id: user.id,
        target_type: parsed.data.targetType,
        target_id: parsed.data.targetId,
        kind: parsed.data.kind,
      },
      { onConflict: "user_id,target_type,target_id,kind" }
    );
  } else {
    await supabase
      .from("reactions")
      .delete()
      .eq("user_id", user.id)
      .eq("target_type", parsed.data.targetType)
      .eq("target_id", parsed.data.targetId)
      .eq("kind", parsed.data.kind);
  }

  if (parsed.data.redirectTo) revalidatePath(parsed.data.redirectTo);
}

// ---------------- Clubs ----------------

const ClubInput = z.object({
  name: z.string().min(2, "Name must be 2+ characters.").max(80),
  description: z.string().max(500).optional(),
  isPrivate: z.enum(["true", "false"]).default("false"),
});

export type CreateClubResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export async function createClubAction(formData: FormData): Promise<CreateClubResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to create a club." };

  const parsed = ClubInput.safeParse({
    name: formData.get("name"),
    description: (formData.get("description") as string | null) || undefined,
    isPrivate: formData.get("isPrivate") === "true" ? "true" : "false",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const baseSlug = slugify(parsed.data.name) || `club-${Date.now()}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("clubs")
      .insert({
        slug: candidate,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        owner_id: user.id,
        is_private: parsed.data.isPrivate === "true",
      })
      .select("slug")
      .single();
    if (!error && data) {
      revalidatePath("/clubs");
      return { ok: true, slug: data.slug };
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
  }
  return { ok: false, error: "Couldn't create club after several attempts." };
}

export async function joinClubAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const clubId = formData.get("clubId");
  const slug = formData.get("slug");
  if (typeof clubId !== "string") return;

  await supabase.from("club_members").upsert(
    { club_id: clubId, user_id: user.id, role: "member" },
    { onConflict: "club_id,user_id" }
  );

  revalidatePath("/clubs");
  if (typeof slug === "string") revalidatePath(`/clubs/${slug}`);
}

export async function leaveClubAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const clubId = formData.get("clubId");
  const slug = formData.get("slug");
  if (typeof clubId !== "string") return;

  await supabase
    .from("club_members")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .neq("role", "owner");

  revalidatePath("/clubs");
  if (typeof slug === "string") revalidatePath(`/clubs/${slug}`);
}

const ClubBookInput = z.object({
  clubId: z.string().uuid(),
  slug: z.string(),
  bookId: z.string().uuid().nullable().optional(),
});

export async function setClubBookAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const parsed = ClubBookInput.safeParse({
    clubId: formData.get("clubId"),
    slug: formData.get("slug"),
    bookId: (formData.get("bookId") as string | null) || null,
  });
  if (!parsed.success) return;

  await supabase
    .from("clubs")
    .update({ current_book_id: parsed.data.bookId ?? null })
    .eq("id", parsed.data.clubId)
    .eq("owner_id", user.id);

  revalidatePath(`/clubs/${parsed.data.slug}`);
}

const MessageInput = z.object({
  clubId: z.string().uuid(),
  slug: z.string(),
  body: z.string().min(1).max(2000),
});

const ENABLE_CLUB_MESSAGE_SPAM_HEURISTICS = false;

/**
 * Spam heuristics for club messages. We do NOT word-filter for slurs —
 * maintaining a curated list at the application layer creates more harm than
 * it prevents (it's incomplete, embeds offensive content in the codebase, and
 * misses every variant). Moderation lives in three layers instead:
 *
 *   1. RLS gates posting to club members only (migration 0007).
 *   2. Rate limit (1 message per 2 seconds per user) prevents floods.
 *   3. Reports table — any user can flag a message; reviewers triage.
 *
 * What this function does block: structural spam — link bombs, emoji walls,
 * stuck-key garbage. The signal-to-noise on these patterns is high; they're
 * almost never legitimate prose.
 */
function looksLikeSpam(body: string): boolean {
  const trimmed = body.trim();
  if (trimmed.length < 1) return true;

  // 4+ http/https URLs in one message → almost always spam.
  const urlMatches = trimmed.match(/https?:\/\/\S+/gi);
  if (urlMatches && urlMatches.length >= 4) return true;

  // 8+ of the same character in a row (e.g. "aaaaaaaa", "!!!!!!!!").
  if (/(.)\1{7,}/.test(trimmed)) return true;

  // Mostly non-alphanumeric (>60% punctuation) and longer than 30 chars.
  if (trimmed.length > 30) {
    const alphanumChars = trimmed.replace(/[^\p{L}\p{N}]/gu, "").length;
    if (alphanumChars / trimmed.length < 0.4) return true;
  }

  return false;
}

export async function postClubMessageAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const parsed = MessageInput.safeParse({
    clubId: formData.get("clubId"),
    slug: formData.get("slug"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;

  // Spam filter intentionally inactive — rate limit + RLS-gated membership +
  // reports are enough for v1. Helper kept; re-enable here if abuse picks up.
  if (ENABLE_CLUB_MESSAGE_SPAM_HEURISTICS && looksLikeSpam(parsed.data.body)) return;

  // Rate limit: 1 message per 2 seconds per user.
  const twoSecondsAgo = new Date(Date.now() - 2000).toISOString();
  const { data: recent } = await supabase
    .from("club_messages")
    .select("id")
    .eq("user_id", user.id)
    .gte("created_at", twoSecondsAgo)
    .limit(1);
  if (recent && recent.length > 0) return;

  await supabase.from("club_messages").insert({
    club_id: parsed.data.clubId,
    user_id: user.id,
    body: parsed.data.body,
  });

  revalidatePath(`/clubs/${parsed.data.slug}`);
}

// ---------------- Reports ----------------

const ReportInput = z.object({
  targetType: z.enum(["review", "highlight", "club", "club_message", "user"]),
  targetId: z.string().uuid(),
  reason: z.string().min(3, "Tell us briefly what's wrong.").max(500),
  redirectTo: z.string().optional(),
});

export async function reportAction(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to report." };

  const parsed = ReportInput.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await supabase.from("reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
  });

  if (parsed.data.redirectTo) revalidatePath(parsed.data.redirectTo);
  return { ok: true };
}
