create table if not exists public.fundings (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  cloth_type text not null,
  material text not null,
  color text,
  size text not null,
  measurements jsonb,
  image_url text not null,
  image_path text,
  description text,
  moq integer not null default 20 check (moq >= 20),
  current_orders integer not null default 0 check (current_orders >= 0),
  price integer check (price is null or price >= 0),
  funding_days integer not null default 30 check (funding_days between 1 and 90),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'closed')),
  admin_comment text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fundings_status_created_at_idx
  on public.fundings(status, created_at desc);

create index if not exists fundings_creator_id_idx
  on public.fundings(creator_id, created_at desc);

alter table public.fundings enable row level security;

drop policy if exists "Approved fundings are public" on public.fundings;
create policy "Approved fundings are public"
  on public.fundings for select
  using (
    status = 'approved'
    or creator_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists "Creators can create pending fundings" on public.fundings;
create policy "Creators can create pending fundings"
  on public.fundings for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and status = 'pending'
    and moq >= 20
  );

drop policy if exists "Creators can edit unapproved fundings" on public.fundings;
create policy "Creators can edit unapproved fundings"
  on public.fundings for update
  to authenticated
  using (creator_id = auth.uid() and status in ('pending', 'rejected'))
  with check (creator_id = auth.uid() and status in ('pending', 'rejected') and moq >= 20);

drop policy if exists "Admins can manage fundings" on public.fundings;
create policy "Admins can manage fundings"
  on public.fundings for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
