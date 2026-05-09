// OpenLibrary "subjects" lookup — used to build a candidate set for /discover.
// Docs: https://openlibrary.org/dev/docs/api/subjects

export type SubjectBook = {
  openlibraryId: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  year: number | null;
};

const SUBJECTS_URL = "https://openlibrary.org/subjects";
const COVER_URL = "https://covers.openlibrary.org/b/id";

type RawSubjectWork = {
  key?: string;
  title?: string;
  authors?: Array<{ name?: string }>;
  cover_id?: number;
  first_publish_year?: number;
};

export async function fetchSubjectBooks(subject: string, limit = 25): Promise<SubjectBook[]> {
  const slug = subject.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!slug) return [];

  const url = new URL(`${SUBJECTS_URL}/${slug}.json`);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, {
    headers: { "User-Agent": "Libretto/0.1 (akindevelops@gmail.com)" },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { works?: RawSubjectWork[] };

  return (data.works ?? [])
    .filter((w) => w.key && w.title)
    .map((w) => ({
      openlibraryId: (w.key ?? "").replace(/^\//, ""),
      title: w.title ?? "Untitled",
      author: w.authors?.[0]?.name ?? null,
      coverUrl: w.cover_id ? `${COVER_URL}/${w.cover_id}-M.jpg` : null,
      year: w.first_publish_year ?? null,
    }));
}

/**
 * Look up an OpenLibrary work's subjects so we can find similar books.
 */
export async function fetchWorkSubjects(openlibraryId: string): Promise<string[]> {
  if (!openlibraryId) return [];
  const path = openlibraryId.startsWith("works/") ? openlibraryId : `works/${openlibraryId}`;
  const url = `https://openlibrary.org/${path}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Libretto/0.1 (akindevelops@gmail.com)" },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { subjects?: string[] };
  return (data.subjects ?? []).map((s) => s.toLowerCase());
}
