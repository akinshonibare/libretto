"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validateHandle } from "@/lib/handle";

const ProfileInput = z.object({
  handle: z.string(),
  display_name: z.string().max(80).optional(),
  bio: z.string().max(280).optional(),
});

export type UpdateProfileResult =
  | { ok: true; handle: string }
  | { ok: false; error: string };

export async function updateProfileAction(formData: FormData): Promise<UpdateProfileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const parsed = ProfileInput.safeParse({
    handle: formData.get("handle") ?? "",
    display_name: (formData.get("display_name") as string | null) || undefined,
    bio: (formData.get("bio") as string | null) || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const validated = validateHandle(parsed.data.handle);
  if (!validated.ok) return { ok: false, error: validated.reason };
  const handle = validated.normalized;

  // Uniqueness check (case-insensitive on the column, but handle is already lowercased).
  const { data: clash } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .neq("id", user.id)
    .maybeSingle();
  if (clash) return { ok: false, error: "That username is taken." };

  const { error } = await supabase
    .from("profiles")
    .update({
      handle,
      display_name: parsed.data.display_name?.trim() || null,
      bio: parsed.data.bio?.trim() || null,
    })
    .eq("id", user.id);

  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "That username is taken." };
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true, handle };
}
