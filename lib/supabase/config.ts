// Helper to detect whether real Supabase credentials are configured.
// Useful so the app can render its public surface without crashing when
// running locally before a project is provisioned.

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  if (url.includes("placeholder")) return false;
  if (key.includes("placeholder")) return false;
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".supabase.co") || u.hostname.endsWith(".supabase.in");
  } catch {
    return false;
  }
}
