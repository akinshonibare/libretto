import { NextResponse } from "next/server";
import { searchBooks } from "@/lib/openlibrary";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await searchBooks(q, 8);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("[books/search]", error);
    return NextResponse.json({ results: [], error: "search-failed" }, { status: 502 });
  }
}
