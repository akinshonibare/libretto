-- Phase 6 — community: follows, reactions, clubs, reports

-- ---------------- follows ----------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id != followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id);
create index if not exists follows_follower_idx on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists "follows readable by everyone" on public.follows;
create policy "follows readable by everyone"
  on public.follows for select using (true);

drop policy if exists "users follow" on public.follows;
create policy "users follow"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "users unfollow" on public.follows;
create policy "users unfollow"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ---------------- reactions ----------------
do $$ begin
  create type reaction_kind as enum ('star', 'this_hit', 'bookmark');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reaction_target as enum ('review', 'highlight');
exception when duplicate_object then null; end $$;

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type reaction_target not null,
  target_id uuid not null,
  kind reaction_kind not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id, kind)
);

create index if not exists reactions_target_idx on public.reactions (target_type, target_id, kind);

alter table public.reactions enable row level security;

drop policy if exists "reactions readable by everyone" on public.reactions;
create policy "reactions readable by everyone"
  on public.reactions for select using (true);

drop policy if exists "users add reactions" on public.reactions;
create policy "users add reactions"
  on public.reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "users remove own reactions" on public.reactions;
create policy "users remove own reactions"
  on public.reactions for delete
  using (auth.uid() = user_id);

-- ---------------- clubs ----------------
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  is_private boolean not null default false,
  current_book_id uuid references public.books(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists clubs_slug_idx on public.clubs (slug);

alter table public.clubs enable row level security;

-- ---------------- club_members (created before clubs policies that reference it) ----------------
create table if not exists public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index if not exists club_members_user_idx on public.club_members (user_id);

alter table public.club_members enable row level security;

-- ---------------- clubs RLS ----------------
drop policy if exists "clubs read: public or member" on public.clubs;
create policy "clubs read: public or member"
  on public.clubs for select
  using (
    not is_private
    or owner_id = auth.uid()
    or exists (
      select 1 from public.club_members m
      where m.club_id = clubs.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "owners create clubs" on public.clubs;
create policy "owners create clubs"
  on public.clubs for insert
  with check (auth.uid() = owner_id);

drop policy if exists "owners update club" on public.clubs;
create policy "owners update club"
  on public.clubs for update
  using (auth.uid() = owner_id);

drop policy if exists "owners delete club" on public.clubs;
create policy "owners delete club"
  on public.clubs for delete
  using (auth.uid() = owner_id);

drop policy if exists "members readable by everyone" on public.club_members;
create policy "members readable by everyone"
  on public.club_members for select using (true);

drop policy if exists "users join clubs" on public.club_members;
create policy "users join clubs"
  on public.club_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "users leave clubs" on public.club_members;
create policy "users leave clubs"
  on public.club_members for delete
  using (auth.uid() = user_id);

-- Auto-add owner as a member when a club is created.
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.club_members (club_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (club_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists clubs_add_owner_member on public.clubs;
create trigger clubs_add_owner_member
  after insert on public.clubs
  for each row execute function public.add_owner_as_member();

-- ---------------- club_messages ----------------
create table if not exists public.club_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists club_messages_club_idx on public.club_messages (club_id, created_at);

alter table public.club_messages enable row level security;

drop policy if exists "club messages: members read" on public.club_messages;
create policy "club messages: members read"
  on public.club_messages for select
  using (
    exists (
      select 1 from public.club_members m
      where m.club_id = club_messages.club_id and m.user_id = auth.uid()
    )
    or exists (
      select 1 from public.clubs c
      where c.id = club_messages.club_id and not c.is_private
    )
  );

drop policy if exists "club messages: members post" on public.club_messages;
create policy "club messages: members post"
  on public.club_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.club_members m
      where m.club_id = club_messages.club_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "club messages: authors edit" on public.club_messages;
create policy "club messages: authors edit"
  on public.club_messages for update
  using (auth.uid() = user_id);

drop policy if exists "club messages: authors delete" on public.club_messages;
create policy "club messages: authors delete"
  on public.club_messages for delete
  using (auth.uid() = user_id);

-- ---------------- reports ----------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('review', 'highlight', 'club', 'club_message', 'user')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'actioned')),
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "users see own reports" on public.reports;
create policy "users see own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

drop policy if exists "users file reports" on public.reports;
create policy "users file reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);
