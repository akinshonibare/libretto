-- Phase 5 — knowledge graph
-- Per-user concept tags extracted from highlights via LLM. Edges derived at
-- query time from co-occurrence in the same review (no edges table needed).

create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  label text not null,
  highlight_count int not null default 0,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists concepts_user_idx on public.concepts (user_id);

alter table public.concepts enable row level security;

drop policy if exists "concepts self-only" on public.concepts;
create policy "concepts self-only"
  on public.concepts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.highlight_concepts (
  highlight_id uuid not null references public.highlights(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  primary key (highlight_id, concept_id)
);

create index if not exists highlight_concepts_concept_idx on public.highlight_concepts (concept_id);

alter table public.highlight_concepts enable row level security;

drop policy if exists "highlight_concepts via review owner" on public.highlight_concepts;
create policy "highlight_concepts via review owner"
  on public.highlight_concepts for all
  using (
    exists (
      select 1 from public.highlights h
      join public.reviews r on r.id = h.review_id
      where h.id = highlight_concepts.highlight_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.highlights h
      join public.reviews r on r.id = h.review_id
      where h.id = highlight_concepts.highlight_id and r.user_id = auth.uid()
    )
  );

-- Maintain concepts.highlight_count automatically.
create or replace function public.bump_concept_highlight_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.concepts set highlight_count = highlight_count + 1 where id = new.concept_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.concepts set highlight_count = greatest(0, highlight_count - 1) where id = old.concept_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists highlight_concepts_count_trigger on public.highlight_concepts;
create trigger highlight_concepts_count_trigger
  after insert or delete on public.highlight_concepts
  for each row execute function public.bump_concept_highlight_count();
