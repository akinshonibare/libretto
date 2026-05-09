-- Phase 4.5 — cache /discover results per-user (24h TTL) so we don't burn tokens on every page view.

create table if not exists public.recommendations_cache (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.recommendations_cache enable row level security;

drop policy if exists "recommendations_cache self-only" on public.recommendations_cache;
create policy "recommendations_cache self-only"
  on public.recommendations_cache for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
