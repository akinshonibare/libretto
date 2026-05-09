-- Phase 3 — streaks, badges, library_heart, spaced repetition (resurface)

-- ---------------- streaks ----------------
-- One row per user. last_logged_date is the user's local date (not UTC) when they last
-- did any "active" thing — created/updated a review, captured a highlight, ended a
-- session. Maintained by application code (touchStreakAction).
create table if not exists public.streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  current int not null default 0,
  longest int not null default 0,
  last_logged_date date,
  updated_at timestamptz not null default now()
);

alter table public.streaks enable row level security;

drop policy if exists "users see own streak" on public.streaks;
create policy "users see own streak"
  on public.streaks for select
  using (auth.uid() = user_id);

drop policy if exists "users update own streak" on public.streaks;
create policy "users update own streak"
  on public.streaks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------- badges ----------------
create table if not exists public.badges (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null default 'sparkle',
  threshold int,
  metric text not null check (metric in (
    'reviews_finished',
    'highlights_total',
    'streak_days',
    'genres_distinct',
    'shares_total',
    'sessions_total'
  )),
  created_at timestamptz not null default now()
);

alter table public.badges enable row level security;

drop policy if exists "badges readable by everyone" on public.badges;
create policy "badges readable by everyone"
  on public.badges for select using (true);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index if not exists user_badges_user_idx on public.user_badges (user_id, awarded_at desc);

alter table public.user_badges enable row level security;

drop policy if exists "user_badges readable by everyone" on public.user_badges;
create policy "user_badges readable by everyone"
  on public.user_badges for select using (true);

drop policy if exists "users insert own badges" on public.user_badges;
create policy "users insert own badges"
  on public.user_badges for insert
  with check (auth.uid() = user_id);

-- Seed catalog (idempotent).
insert into public.badges (id, name, description, icon, threshold, metric) values
  ('first-book',     'Opening Pages',   'Logged your first book.',                 'book-open',  1,    'reviews_finished'),
  ('five-books',     'Shelf Started',   'Finished five books.',                     'library',    5,    'reviews_finished'),
  ('twenty-five',    'Quarter Hundred', 'Finished twenty-five books.',              'library',    25,   'reviews_finished'),
  ('hundred-books',  'Centurion',       'Finished one hundred books.',              'crown',      100,  'reviews_finished'),
  ('first-highlight','Margin Note',     'Captured your first highlight.',           'highlighter',1,    'highlights_total'),
  ('fifty-highlights','Loose Marginalia','Fifty highlights captured.',              'highlighter',50,   'highlights_total'),
  ('streak-7',       'A Week Steady',   'Seven-day reading streak.',                'flame',      7,    'streak_days'),
  ('streak-30',      'Month of Pages',  'Thirty-day reading streak.',               'flame',      30,   'streak_days'),
  ('streak-100',     'Triple Digit',    'One hundred straight days.',               'flame',      100,  'streak_days'),
  ('first-session',  'Settled In',      'Completed your first reading session.',    'play',       1,    'sessions_total'),
  ('first-share',    'Said It Out Loud','Shared your first review or highlight.',   'share',      1,    'shares_total')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  threshold = excluded.threshold,
  metric = excluded.metric;

-- ---------------- library_heart ----------------
-- A composite 0–100 score. Recomputed lazily when the user hits the dashboard.
create table if not exists public.library_heart (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  score int not null default 50 check (score between 0 and 100),
  components jsonb,
  updated_at timestamptz not null default now()
);

alter table public.library_heart enable row level security;

drop policy if exists "library_heart self-only" on public.library_heart;
create policy "library_heart self-only"
  on public.library_heart for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------- resurface_schedule (SM-2 lite) ----------------
create table if not exists public.resurface_schedule (
  highlight_id uuid primary key references public.highlights(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ease real not null default 2.5,
  interval_days int not null default 1,
  lapses int not null default 0,
  reviews_count int not null default 0,
  last_reviewed_at timestamptz,
  next_due_at timestamptz not null default (now() + interval '1 day')
);

create index if not exists resurface_due_idx
  on public.resurface_schedule (user_id, next_due_at);

alter table public.resurface_schedule enable row level security;

drop policy if exists "resurface self-only" on public.resurface_schedule;
create policy "resurface self-only"
  on public.resurface_schedule for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create a resurface row whenever a highlight is inserted.
create or replace function public.schedule_highlight_resurface()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
begin
  select user_id into owner from public.reviews where id = new.review_id;
  if owner is not null then
    insert into public.resurface_schedule (highlight_id, user_id)
    values (new.id, owner)
    on conflict (highlight_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists highlights_after_insert_resurface on public.highlights;
create trigger highlights_after_insert_resurface
  after insert on public.highlights
  for each row execute function public.schedule_highlight_resurface();

-- Backfill: every existing highlight without a schedule row gets one due today.
insert into public.resurface_schedule (highlight_id, user_id, next_due_at)
select h.id, r.user_id, now()
from public.highlights h
join public.reviews r on r.id = h.review_id
where not exists (select 1 from public.resurface_schedule s where s.highlight_id = h.id);
