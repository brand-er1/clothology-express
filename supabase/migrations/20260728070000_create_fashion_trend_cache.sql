create table if not exists public.fashion_trend_cache (
  source text primary key,
  trends jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.fashion_trend_cache enable row level security;

comment on table public.fashion_trend_cache is
  'Server-only cache for public fashion ranking trend summaries.';

