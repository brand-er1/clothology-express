create table if not exists public.homepage_notify_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  source text not null default 'homepage',
  created_at timestamptz not null default now(),
  constraint homepage_notify_subscriptions_email_key unique (email)
);

create index if not exists homepage_notify_subscriptions_created_idx
  on public.homepage_notify_subscriptions(created_at desc);

alter table public.homepage_notify_subscriptions enable row level security;

drop policy if exists "Anyone can subscribe to homepage notify"
  on public.homepage_notify_subscriptions;
create policy "Anyone can subscribe to homepage notify"
  on public.homepage_notify_subscriptions for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins can view homepage notify subscriptions"
  on public.homepage_notify_subscriptions;
create policy "Admins can view homepage notify subscriptions"
  on public.homepage_notify_subscriptions for select
  to authenticated
  using (public.is_admin(auth.uid()));
