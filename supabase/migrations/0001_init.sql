-- Libretto — initial schema (Phase 1)
-- Tables: profiles, books, reviews, chapter_notes
-- Plus: RLS policies, profile auto-create trigger, updated_at trigger.

-- ---------------- Enums ----------------
do $$ begin
  create type reading_status as enum ('reading', 'finished', 'dnf');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reading_mode as enum ('absorb', 'study', 'challenge', 'apply', 'enjoy');
exception when duplicate_object then null; end $$;

-- ---------------- profiles ----------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  theme jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profiles_handle_idx on public.profiles (handle);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by everyone" on public.profiles;
create policy "profiles readable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create a profile row when an auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle text;
  candidate text;
  attempt int := 0;
begin
  base_handle := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'reader'), '[^a-z0-9_]+', '', 'g'));
  if length(base_handle) < 3 then base_handle := 'reader' || base_handle; end if;
  candidate := left(base_handle, 24);

  while exists (select 1 from public.profiles where handle = candidate) loop
    attempt := attempt + 1;
    candidate := left(base_handle, 20) || attempt::text;
  end loop;

  insert into public.profiles (id, handle, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data->>'name', candidate));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------- books ----------------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  openlibrary_id text unique,
  isbn text,
  title text not null,
  author text,
  cover_url text,
  year int,
  synopsis text,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create index if not exists books_slug_idx on public.books (slug);
create index if not exists books_title_idx on public.books using gin (to_tsvector('simple', title));

alter table public.books enable row level security;

drop policy if exists "books readable by everyone" on public.books;
create policy "books readable by everyone"
  on public.books for select
  using (true);

drop policy if exists "authenticated users can insert books" on public.books;
create policy "authenticated users can insert books"
  on public.books for insert
  with check (auth.uid() is not null);

-- ---------------- reviews ----------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status reading_status not null default 'reading',
  rating smallint check (rating between 1 and 5),
  liked boolean,
  why text,
  synopsis text,
  reading_mode reading_mode not null default 'enjoy',
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create index if not exists reviews_user_idx on public.reviews (user_id, created_at desc);
create index if not exists reviews_book_idx on public.reviews (book_id) where is_public;

alter table public.reviews enable row level security;

drop policy if exists "reviews visible to owner or if public" on public.reviews;
create policy "reviews visible to owner or if public"
  on public.reviews for select
  using (is_public or auth.uid() = user_id);

drop policy if exists "users can insert own reviews" on public.reviews;
create policy "users can insert own reviews"
  on public.reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update own reviews" on public.reviews;
create policy "users can update own reviews"
  on public.reviews for update
  using (auth.uid() = user_id);

drop policy if exists "users can delete own reviews" on public.reviews;
create policy "users can delete own reviews"
  on public.reviews for delete
  using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();

-- ---------------- chapter_notes ----------------
create table if not exists public.chapter_notes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  label text,
  body text not null,
  page int,
  created_at timestamptz not null default now()
);

create index if not exists chapter_notes_review_idx on public.chapter_notes (review_id, created_at);

alter table public.chapter_notes enable row level security;

drop policy if exists "chapter_notes follow review visibility" on public.chapter_notes;
create policy "chapter_notes follow review visibility"
  on public.chapter_notes for select
  using (
    exists (
      select 1 from public.reviews r
      where r.id = chapter_notes.review_id
        and (r.is_public or r.user_id = auth.uid())
    )
  );

drop policy if exists "owners manage chapter_notes" on public.chapter_notes;
create policy "owners manage chapter_notes"
  on public.chapter_notes for all
  using (
    exists (select 1 from public.reviews r where r.id = chapter_notes.review_id and r.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.reviews r where r.id = chapter_notes.review_id and r.user_id = auth.uid())
  );
