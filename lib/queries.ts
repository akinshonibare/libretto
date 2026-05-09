// Result row types for the queries we actually run.
// The hand-written Database type in lib/supabase/types.ts doesn't model the
// foreign-key Relationships field, so the typed client narrows nested selects
// to `never`. Each row type below maps to an exact `.select(...)` shape and
// is applied via `.returns<T>()` to restore type safety.
// (See lib/supabase/types.ts header for why we hand-author types.)

import type { ReadingMode, ReadingStatus } from "@/lib/supabase/types";

export type LibraryReviewRow = {
  id: string;
  status: ReadingStatus;
  rating: number | null;
  liked: boolean | null;
  reading_mode: ReadingMode;
  is_public: boolean;
  updated_at: string;
  books: {
    title: string;
    author: string | null;
    cover_url: string | null;
    slug: string;
  } | null;
};

export type LibraryHighlightTeaser = {
  review_id: string;
  body: string;
};

export type ReviewDetailRow = {
  id: string;
  user_id: string;
  status: ReadingStatus;
  rating: number | null;
  liked: boolean | null;
  why: string | null;
  synopsis: string | null;
  reading_mode: ReadingMode;
  is_public: boolean;
  updated_at: string;
  books: {
    title: string;
    author: string | null;
    cover_url: string | null;
    year: number | null;
    slug: string;
  } | null;
};

export type ChapterNoteRow = {
  id: string;
  label: string | null;
  body: string;
  page: number | null;
  created_at: string;
};

export type PublicProfileReviewRow = {
  id: string;
  status: ReadingStatus;
  rating: number | null;
  books: {
    title: string;
    author: string | null;
    cover_url: string | null;
    slug: string;
  } | null;
};

export type BookPageReviewRow = {
  id: string;
  status: ReadingStatus;
  rating: number | null;
  why: string | null;
  reading_mode: ReadingMode;
  profiles: {
    handle: string;
    display_name: string | null;
  } | null;
};

export type PublicReviewRow = {
  id: string;
  user_id: string;
  status: ReadingStatus;
  rating: number | null;
  liked: boolean | null;
  why: string | null;
  synopsis: string | null;
  reading_mode: ReadingMode;
  is_public: boolean;
  updated_at: string;
  books: {
    title: string;
    author: string | null;
    cover_url: string | null;
    year: number | null;
    slug: string;
  } | null;
  profiles: {
    handle: string;
    display_name: string | null;
  } | null;
};

export type HighlightRow = {
  id: string;
  body: string;
  page: number | null;
  source: string;
  created_at: string;
};

export type SessionRow = {
  id: string;
  mode: ReadingMode;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};
