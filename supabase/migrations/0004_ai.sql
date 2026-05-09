-- Phase 4 — pgvector embeddings + AI usage/budget tracking

create extension if not exists vector;

-- Add embedding columns. text-embedding-3-small returns 1536 dims.
alter table public.highlights add column if not exists embedding vector(1536);
alter table public.reviews add column if not exists embedding vector(1536);

-- IVFFlat indexes for approximate nearest-neighbour search.
-- Note: lists tuning is fine for small projects; revisit at >100k rows.
do $$ begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'highlights_embedding_idx'
  ) then
    create index highlights_embedding_idx
      on public.highlights using ivfflat (embedding vector_cosine_ops)
      with (lists = 100);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'reviews_embedding_idx'
  ) then
    create index reviews_embedding_idx
      on public.reviews using ivfflat (embedding vector_cosine_ops)
      with (lists = 100);
  end if;
end $$;

-- ---------------- ai_usage ----------------
-- Per-user, per-day token spend. Used to enforce a daily budget.
create table if not exists public.ai_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  provider text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_cost_cents int not null default 0,
  primary key (user_id, day, provider, model)
);

create index if not exists ai_usage_user_day_idx
  on public.ai_usage (user_id, day desc);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage self-only" on public.ai_usage;
create policy "ai_usage self-only"
  on public.ai_usage for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
