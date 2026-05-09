-- Phase 6.5 — share-token access to private reviews
--
-- The /r/[id]?t=<token> page needs to read a private review when a valid share
-- token is supplied in the URL. The base SELECT policy on `reviews` is
-- `is_public OR auth.uid() = user_id`, which fires *before* the page can
-- validate the token, so a non-owner viewer always saw a 404 even with a
-- valid token.
--
-- Two SECURITY DEFINER functions fix this without weakening RLS:
--   review_for_share(p_review_id, p_token)     → at most one row, joined w/ book + profile
--   highlights_for_share(p_review_id, p_token) → all highlights for that review
--
-- Each function only returns rows when *one* of three conditions holds:
--   1. the review is public, or
--   2. the caller is the review's owner, or
--   3. the token matches a row in review_share_tokens for that review.
-- They cannot be used to enumerate or list reviews — `p_review_id` must be
-- known up front.

create or replace function public.review_for_share(
  p_review_id uuid,
  p_token text default null
)
returns table (
  id uuid,
  user_id uuid,
  status reading_status,
  rating smallint,
  liked boolean,
  why text,
  synopsis text,
  reading_mode reading_mode,
  is_public boolean,
  updated_at timestamptz,
  book_title text,
  book_author text,
  book_cover_url text,
  book_year int,
  book_slug text,
  author_handle text,
  author_display_name text
)
language sql
security definer
set search_path = public
as $$
  select
    r.id, r.user_id, r.status, r.rating, r.liked, r.why, r.synopsis,
    r.reading_mode, r.is_public, r.updated_at,
    b.title, b.author, b.cover_url, b.year, b.slug,
    p.handle, p.display_name
  from public.reviews r
  left join public.books b on b.id = r.book_id
  left join public.profiles p on p.id = r.user_id
  where r.id = p_review_id
    and (
      r.is_public
      or r.user_id = auth.uid()
      or (
        p_token is not null
        and exists (
          select 1 from public.review_share_tokens t
          where t.review_id = r.id and t.token = p_token
        )
      )
    );
$$;

grant execute on function public.review_for_share(uuid, text) to anon, authenticated;

create or replace function public.highlights_for_share(
  p_review_id uuid,
  p_token text default null
)
returns table (
  id uuid,
  review_id uuid,
  body text,
  page int,
  source text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select h.id, h.review_id, h.body, h.page, h.source, h.created_at
  from public.highlights h
  join public.reviews r on r.id = h.review_id
  where h.review_id = p_review_id
    and (
      r.is_public
      or r.user_id = auth.uid()
      or (
        p_token is not null
        and exists (
          select 1 from public.review_share_tokens t
          where t.review_id = r.id and t.token = p_token
        )
      )
    )
  order by h.created_at;
$$;

grant execute on function public.highlights_for_share(uuid, text) to anon, authenticated;

-- Same idea for a single highlight (used by /api/og/highlight/[id])
create or replace function public.highlight_for_share(
  p_highlight_id uuid,
  p_token text default null
)
returns table (
  id uuid,
  body text,
  page int,
  review_id uuid,
  is_public boolean,
  book_title text,
  book_author text,
  author_handle text
)
language sql
security definer
set search_path = public
as $$
  select h.id, h.body, h.page, h.review_id, r.is_public, b.title, b.author, p.handle
  from public.highlights h
  join public.reviews r on r.id = h.review_id
  left join public.books b on b.id = r.book_id
  left join public.profiles p on p.id = r.user_id
  where h.id = p_highlight_id
    and (
      r.is_public
      or r.user_id = auth.uid()
      or (
        p_token is not null
        and exists (
          select 1 from public.review_share_tokens t
          where t.review_id = r.id and t.token = p_token
        )
      )
    );
$$;

grant execute on function public.highlight_for_share(uuid, text) to anon, authenticated;
