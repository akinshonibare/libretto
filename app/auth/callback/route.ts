import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth/PKCE magic-link callback. Supabase appends ?code=... after the user clicks the link.
// We exchange it for a session, set cookies, then redirect to ?next=...
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/library";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=missing-code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/sign-in?error=${encodeURIComponent(error.message)}`
    );
  }
  return NextResponse.redirect(`${origin}${next}`);
}
