import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * React `cache()` dedupes these helpers within a single request.
 * Layout + page + components can each call them without piling up
 * round-trips to Supabase.
 */

export type SessionContext = {
  user: { id: string; email?: string | null } | null;
  profile: { id: string; handle: string; display_name: string | null } | null;
};

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  if (!isSupabaseConfigured()) return { user: null, profile: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: profile
      ? { id: profile.id, handle: profile.handle, display_name: profile.display_name }
      : { id: user.id, handle: "reader", display_name: null },
  };
});

export async function requireUser(): Promise<{
  user: { id: string; email?: string | null };
  profile: { id: string; handle: string; display_name: string | null };
}> {
  if (!isSupabaseConfigured()) redirect("/auth/sign-in?error=supabase-not-configured");
  const ctx = await getSessionContext();
  if (!ctx.user || !ctx.profile) redirect("/auth/sign-in");
  return { user: ctx.user, profile: ctx.profile };
}
