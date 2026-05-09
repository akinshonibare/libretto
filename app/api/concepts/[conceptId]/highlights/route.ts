import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadHighlightsForConcept } from "@/lib/graph-data";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conceptId: string }> }
) {
  const { conceptId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const highlights = await loadHighlightsForConcept(supabase, user.id, conceptId);
  return NextResponse.json({ highlights });
}
