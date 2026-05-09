-- Phase 2 — highlights, reading sessions, chat messages, share tokens
-- Embeddings (pgvector) are added in a later phase migration to avoid coupling.

-- ---------------- highlights ----------------
create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  body text not null,
  source text not null default 'manual' check (source in ('manual','ocr','paste','session')),
  page int,
  position int,
  created_at timestamptz not null default now()
);

create index if not exists highlights_review_idx on public.highlights (review_id, created_at);

alter table public.highlights enable row level security;

drop policy if exists "highlights follow review visibility" on public.highlights;
create policy "highlights follow review visibility"
  on public.highlights for select
  using (
    exists (
      select 1 from public.reviews r
      where r.id = highlights.review_id
        and (r.is_public or r.user_id = auth.uid())
    )
  );

drop policy if exists "owners manage highlights" on public.highlights;
create policy "owners manage highlights"
  on public.highlights for all
  using (
    exists (select 1 from public.reviews r where r.id = highlights.review_id and r.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.reviews r where r.id = highlights.review_id and r.user_id = auth.uid())
  );

-- ---------------- reading_sessions ----------------
-- A "session" is one focused chunk of reading. Notes/highlights captured
-- during a session can be filtered/aggregated by session.
create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode reading_mode not null default 'enjoy',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int generated always as (extract(epoch from (ended_at - started_at))::int) stored
);

create index if not exists reading_sessions_review_idx on public.reading_sessions (review_id, started_at desc);
create index if not exists reading_sessions_user_idx on public.reading_sessions (user_id, started_at desc);

alter table public.reading_sessions enable row level security;

drop policy if exists "owners manage own reading_sessions" on public.reading_sessions;
create policy "owners manage own reading_sessions"
  on public.reading_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional link from a highlight or note to the session that produced it.
alter table public.highlights add column if not exists session_id uuid
  references public.reading_sessions(id) on delete set null;

alter table public.chapter_notes add column if not exists session_id uuid
  references public.reading_sessions(id) on delete set null;

-- ---------------- chat_messages (Phase 4 will add embeddings) ----------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  mode reading_mode,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_review_idx on public.chat_messages (review_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "users see own chat" on public.chat_messages;
create policy "users see own chat"
  on public.chat_messages for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own chat" on public.chat_messages;
create policy "users insert own chat"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- ---------------- review_share_tokens ----------------
-- Unguessable tokens that grant read access to a *private* review via /r/[id]?t=...
-- The route validates the token server-side and bypasses the is_public check.
create table if not exists public.review_share_tokens (
  token text primary key,
  review_id uuid not null references public.reviews(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists review_share_tokens_review_idx on public.review_share_tokens (review_id);

alter table public.review_share_tokens enable row level security;

drop policy if exists "owners manage share tokens" on public.review_share_tokens;
create policy "owners manage share tokens"
  on public.review_share_tokens for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);
