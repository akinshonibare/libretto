import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type HighlightOg = {
  id: string;
  body: string;
  page: number | null;
  reviews: {
    id: string;
    is_public: boolean;
    books: { title: string; author: string | null } | null;
    profiles: { handle: string } | null;
  } | null;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? undefined;

  const supabase = await createClient();
  const { data: h } = await supabase
    .from("highlights")
    .select(
      "id, body, page, reviews(id, is_public, books(title, author), profiles!reviews_user_id_fkey(handle))"
    )
    .eq("id", id)
    .returns<HighlightOg[]>()
    .maybeSingle();

  if (!h || !h.reviews) return new Response("Not found", { status: 404 });

  if (!h.reviews.is_public) {
    if (!token) return new Response("Forbidden", { status: 403 });
    const { data: t } = await supabase
      .from("review_share_tokens")
      .select("token")
      .eq("token", token)
      .eq("review_id", h.reviews.id)
      .maybeSingle();
    if (!t) return new Response("Forbidden", { status: 403 });
  }

  const book = h.reviews.books;
  const handle = h.reviews.profiles?.handle ?? "";
  const quote = h.body.length > 280 ? h.body.slice(0, 277) + "…" : h.body;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f7f1e3",
          color: "#3a2e1f",
          padding: "80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <span
          style={{
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#8a7a5a",
          }}
        >
          Libretto · highlight
        </span>
        <div
          style={{
            fontSize: 56,
            lineHeight: 1.2,
            marginTop: 36,
            fontStyle: "italic",
            color: "#3a2e1f",
            fontWeight: 500,
          }}
        >
          &ldquo;{quote}&rdquo;
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 26,
            color: "#5c4a32",
          }}
        >
          <span>
            {book?.title ?? "Untitled"}
            {book?.author ? ` · ${book.author}` : ""}
          </span>
          <span>@{handle}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
