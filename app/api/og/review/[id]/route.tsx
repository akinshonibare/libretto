import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ReviewForShareRow = {
  id: string;
  rating: number | null;
  why: string | null;
  is_public: boolean;
  book_title: string | null;
  book_author: string | null;
  book_cover_url: string | null;
  author_handle: string | null;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? undefined;

  const supabase = await createClient();
  // Goes through the SECURITY DEFINER fn — public, owner, or matching token only.
  const { data: rows } = await supabase.rpc("review_for_share", {
    p_review_id: id,
    p_token: token ?? null,
  });
  const review = (rows as ReviewForShareRow[] | null)?.[0];
  if (!review) return new Response("Not found", { status: 404 });

  const book = {
    title: review.book_title,
    author: review.book_author,
    cover_url: review.book_cover_url,
  };
  const author = { handle: review.author_handle };

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
