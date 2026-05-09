import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function requireUser() {
  if (!isSupabaseConfigured()) redirect("/auth/sign-in?error=supabase-not-configured");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // The trigger should have created one; if it didn't, fall back gracefully.
    return { user, profile: { id: user.id, handle: "reader", display_name: null } };
  }
  return { user, profile };
}
