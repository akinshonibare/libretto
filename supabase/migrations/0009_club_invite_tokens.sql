-- Phase 7 — invite-link access for private clubs
--
-- Mirrors the review_share_tokens pattern (migration 0002) and the
-- review_for_share helper (migration 0008). A private club can be visited
-- via /clubs/<slug>?t=<token>; the SECURITY DEFINER helpers below let
-- non-members read the club + its messages + its members when a valid token
-- is supplied, without weakening the base RLS policies.

create table if not exists public.club_invite_tokens (
  token text primary key,
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists club_invite_tokens_club_idx
  on public.club_invite_tokens (club_id) where revoked_at is null;

alter table public.club_invite_tokens enable row level security;

drop policy if exists "owners manage club invite tokens" on public.club_invite_tokens;
create policy "owners manage club invite tokens"
  on public.club_invite_tokens for all
  using (
    exists (
      select 1 from public.clubs c
      where c.id = club_invite_tokens.club_id and c.owner_id = auth.uid()
    )
  )
  with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.clubs c
      where c.id = club_invite_tokens.club_id and c.owner_id = auth.uid()
    )
  );

-- Helper: is the supplied token valid for this club?
create or replace function public.club_invite_token_valid(p_club_id uuid, p_token text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.club_invite_tokens t
    where t.club_id = p_club_id
      and t.token = p_token
      and t.revoked_at is null
  );
$$;

grant execute on function public.club_invite_token_valid(uuid, text) to anon, authenticated;

-- Look up a single club by slug, bypassing RLS when an invite token matches.
-- Returns at most one row. Used to render /clubs/<slug>?t=<token> for users
-- who aren't members yet.
create or replace function public.club_for_invite(p_slug text, p_token text default null)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  owner_id uuid,
  is_private boolean,
  current_book_id uuid,
  created_at timestamptz,
  book_title text,
  book_author text,
  book_cover_url text,
  book_slug text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    c.id, c.slug, c.name, c.description, c.owner_id, c.is_private,
    c.current_book_id, c.created_at,
    b.title, b.author, b.cover_url, b.slug
  from public.clubs c
  left join public.books b on b.id = c.current_book_id
  where c.slug = p_slug
    and (
      not c.is_private
      or c.owner_id = auth.uid()
      or exists (
        select 1 from public.club_members m
        where m.club_id = c.id and m.user_id = auth.uid()
      )
      or (p_token is not null and public.club_invite_token_valid(c.id, p_token))
    );
$$;

grant execute on function public.club_for_invite(text, text) to anon, authenticated;

-- Fetch members of a club, bypassing RLS for valid invite-token holders.
create or replace function public.club_members_for_invite(p_club_id uuid, p_token text default null)
returns table (
  user_id uuid,
  role text,
  handle text,
  display_name text,
  joined_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select m.user_id, m.role, p.handle, p.display_name, m.joined_at
  from public.club_members m
  left join public.profiles p on p.id = m.user_id
  join public.clubs c on c.id = m.club_id
  where m.club_id = p_club_id
    and (
      not c.is_private
      or c.owner_id = auth.uid()
      or exists (
        select 1 from public.club_members me
        where me.club_id = c.id and me.user_id = auth.uid()
      )
      or (p_token is not null and public.club_invite_token_valid(c.id, p_token))
    )
  order by m.joined_at asc;
$$;

grant execute on function public.club_members_for_invite(uuid, text) to anon, authenticated;

-- Fetch messages of a club, bypassing RLS for valid invite-token holders.
-- Note: invite-token holders can read but not post (posting still requires
-- club membership via the existing club_messages RLS).
create or replace function public.club_messages_for_invite(p_club_id uuid, p_token text default null)
returns table (
  id uuid,
  body text,
  created_at timestamptz,
  user_id uuid,
  handle text,
  display_name text
)
language sql
security definer
stable
set search_path = public
as $$
  select cm.id, cm.body, cm.created_at, cm.user_id, p.handle, p.display_name
  from public.club_messages cm
  left join public.profiles p on p.id = cm.user_id
  join public.clubs c on c.id = cm.club_id
  where cm.club_id = p_club_id
    and (
      not c.is_private
      or c.owner_id = auth.uid()
      or exists (
        select 1 from public.club_members me
        where me.club_id = c.id and me.user_id = auth.uid()
      )
      or (p_token is not null and public.club_invite_token_valid(c.id, p_token))
    )
  order by cm.created_at asc
  limit 200;
$$;

grant execute on function public.club_messages_for_invite(uuid, text) to anon, authenticated;
