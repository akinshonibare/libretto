import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ThemePicker } from "@/components/theme-picker";
import { ProfileEditor } from "@/components/profile-editor";
import { SiteHeader } from "@/components/site-header";
import { getSessionContext } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function SettingsPage() {
  const { profile } = await getSessionContext();

  let bio: string | null = null;
  if (profile && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("bio").eq("id", profile.id).maybeSingle();
    bio = data?.bio ?? null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <Link
          href={profile ? "/dashboard" : "/"}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-4" /> Back
        </Link>
        <h1 className="mt-4 font-heading text-4xl tracking-tight">Settings</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          {profile
            ? "Your username, profile, and how Libretto looks."
            : "Pick how Libretto looks. Sign in to edit your profile."}
        </p>

        {profile && (
          <section className="mt-10">
            <h2 className="font-heading text-2xl mb-3">Profile</h2>
            <ProfileEditor
              initialHandle={profile.handle}
              initialDisplayName={profile.display_name}
              initialBio={bio}
            />
          </section>
        )}

        <section className="mt-12">
          <h2 className="font-heading text-2xl mb-3">Appearance</h2>
          <ThemePicker />
        </section>
      </main>
    </div>
  );
}
