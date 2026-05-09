import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import type { PublicReviewRow } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? undefined;

  const supabase = await createClient();
  const { data: review } = await supabase
    .from("reviews")
    .select(
      "id, user_id, status, rating, liked, why, synopsis, reading_mode, is_public, updated_at, books(title, author, cover_url, year, slug), profiles!reviews_user_id_fkey(handle, display_name)"
    )
    .eq("id", id)
    .returns<PublicReviewRow[]>()
    .maybeSingle();

  if (!review) return new Response("Not found", { status: 404 });

  if (!review.is_public) {
    if (!token) return new Response("Forbidden", { status: 403 });
    const { data: t } = await supabase
      .from("review_share_tokens")
      .select("token")
      .eq("token", token)
      .eq("review_id", id)
      .maybeSingle();
    if (!t) return new Response("Forbidden", { status: 403 });
  }

  const book = review.books;
  const author = review.profiles;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          backgroundColor: "#f7f1e3",
          color: "#3a2e1f",
          padding: "60px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", gap: 48, alignItems: "stretch", width: "100%" }}>
          {book?.cover_url ? (
            <img
              src={book.cover_url}
              width={260}
              height={400}
              style={{ objectFit: "cover", borderRadius: 4, border: "1px solid #d8cfb6" }}
            />
          ) : (
            <div
              style={{
                width: 260,
                height: 400,
                background: "#ece5d2",
                borderRadius: 4,
                border: "1px solid #d8cfb6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                color: "#8a7a5a",
              }}
            >
              {book?.title?.[0] ?? "?"}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontSize: 22,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#8a7a5a",
                }}
              >
                Libretto
              </span>
              {review.rating ? (
                <span style={{ fontSize: 28, color: "#c89a5b" }}>{"★".repeat(review.rating)}</span>
              ) : null}
            </div>
            <div
              style={{
                fontSize: 64,
                lineHeight: 1.05,
                marginTop: 16,
                fontWeight: 600,
              }}
            >
              {book?.title ?? "Untitled"}
            </div>
            {book?.author ? (
              <div style={{ fontSize: 28, color: "#5c4a32", marginTop: 8 }}>{book.author}</div>
            ) : null}
            {review.why ? (
              <div
                style={{
                  fontSize: 28,
                  marginTop: 32,
                  lineHeight: 1.4,
                  color: "#3a2e1f",
                  fontStyle: "italic",
                }}
              >
                &ldquo;{review.why.slice(0, 180)}{review.why.length > 180 ? "…" : ""}&rdquo;
              </div>
            ) : null}
            <div
              style={{
                marginTop: "auto",
                fontSize: 22,
                color: "#5c4a32",
                display: "flex",
                gap: 12,
              }}
            >
              <span>by @{author?.handle}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
