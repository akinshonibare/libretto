// Tiny client for the OpenLibrary REST API. No key required.
// Docs: https://openlibrary.org/dev/docs/api/search

export type OpenLibraryBook = {
  openlibraryId: string; // works/OLxxxxxxW
  title: string;
  author: string | null;
  coverUrl: string | null;
  year: number | null;
  isbn: string | null;
};

const SEARCH_URL = "https://openlibrary.org/search.json";
const COVER_URL = "https://covers.openlibrary.org/b/id";

type RawDoc = {
  key?: string; // "/works/OL...W"
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  edition_count?: number;
};

export async function searchBooks(query: string, limit = 8): Promise<OpenLibraryBook[]> {
  if (!query.trim()) return [];
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,isbn,edition_count");

  const res = await fetch(url, {
    headers: { "User-Agent": "Libretto/0.1 (akindevelops@gmail.com)" },
    next: { revalidate: 60 * 60 },
  });
  if (!res.ok) throw new Error(`OpenLibrary error: ${res.status}`);
  const data = (await res.json()) as { docs?: RawDoc[] };

  return (data.docs ?? [])
    .filter((d) => d.key && d.title)
    .map((d) => ({
      openlibraryId: (d.key ?? "").replace(/^\//, ""),
      title: d.title ?? "Untitled",
      author: d.author_name?.[0] ?? null,
      coverUrl: d.cover_i ? `${COVER_URL}/${d.cover_i}-M.jpg` : null,
      year: d.first_publish_year ?? null,
      isbn: d.isbn?.[0] ?? null,
    }));
}
