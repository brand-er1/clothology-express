alter table public.fundings
  add column if not exists color_options text[] not null default '{}'::text[],
  add column if not exists size_options text[] not null default '{}'::text[];

update public.fundings
set color_options = array[color]
where cardinality(color_options) = 0 and color is not null and btrim(color) <> '';

update public.fundings
set color_options = array['기본 색상']
where cardinality(color_options) = 0;

update public.fundings
set size_options = array[size]
where cardinality(size_options) = 0 and size is not null and btrim(size) <> '';

update public.fundings
set size_options = array['FREE']
where cardinality(size_options) = 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fundings_color_options_not_empty'
      and conrelid = 'public.fundings'::regclass
  ) then
    alter table public.fundings
      add constraint fundings_color_options_not_empty check (cardinality(color_options) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fundings_size_options_not_empty'
      and conrelid = 'public.fundings'::regclass
  ) then
    alter table public.fundings
      add constraint fundings_size_options_not_empty check (cardinality(size_options) > 0);
  end if;
end $$;

create table if not exists public.funding_participations (
  id uuid primary key default gen_random_uuid(),
  funding_id uuid not null references public.fundings(id) on delete cascade,
  participant_id uuid not null references auth.users(id) on delete cascade,
  selected_color text not null,
  selected_size text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price integer not null check (unit_price > 0),
  total_amount integer generated always as (quantity * unit_price) stored,
  status text not null default 'pledged'
    check (status in ('pledged', 'confirmed', 'cancelled', 'fulfilled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funding_participations_funding_id_idx
  on public.funding_participations(funding_id, created_at desc);

create index if not exists funding_participations_participant_id_idx
  on public.funding_participations(participant_id, created_at desc);

alter table public.funding_participations enable row level security;

drop policy if exists "Participants can view their pledges" on public.funding_participations;
create policy "Participants can view their pledges"
  on public.funding_participations for select
  to authenticated
  using (participant_id = auth.uid());

drop policy if exists "Creators can view funding participants" on public.funding_participations;
create policy "Creators can view funding participants"
  on public.funding_participations for select
  to authenticated
  using (
    exists (
      select 1 from public.fundings
      where fundings.id = funding_participations.funding_id
        and fundings.creator_id = auth.uid()
    )
  );

drop policy if exists "Admins can view funding participants" on public.funding_participations;
create policy "Admins can view funding participants"
  on public.funding_participations for select
  to authenticated
  using (public.is_admin(auth.uid()));

create or replace function public.participate_in_funding(
  p_funding_id uuid,
  p_color text,
  p_size text,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_funding public.fundings%rowtype;
  v_participation_id uuid;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    raise exception '수량은 1장부터 99장까지 선택할 수 있습니다.';
  end if;

  select * into v_funding
  from public.fundings
  where id = p_funding_id
  for update;

  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;

  if v_funding.status <> 'approved' then
    raise exception '현재 참여할 수 없는 펀딩입니다.';
  end if;

  if v_funding.price is null or v_funding.price <= 0 then
    raise exception '판매가가 설정되지 않았습니다.';
  end if;

  if not (p_color = any(v_funding.color_options)) then
    raise exception '선택할 수 없는 컬러입니다.';
  end if;

  if not (p_size = any(v_funding.size_options)) then
    raise exception '선택할 수 없는 사이즈입니다.';
  end if;

  insert into public.funding_participations (
    funding_id,
    participant_id,
    selected_color,
    selected_size,
    quantity,
    unit_price
  ) values (
    p_funding_id,
    v_user_id,
    p_color,
    p_size,
    p_quantity,
    v_funding.price
  ) returning id into v_participation_id;

  update public.fundings
  set current_orders = current_orders + p_quantity,
      updated_at = now()
  where id = p_funding_id;

  return v_participation_id;
end;
$$;

revoke all on function public.participate_in_funding(uuid, text, text, integer) from public;
grant execute on function public.participate_in_funding(uuid, text, text, integer) to authenticated;

create or replace function public.get_funding_participants(p_funding_id uuid)
returns table (
  id uuid,
  participant_id uuid,
  participant_name text,
  phone_number text,
  selected_color text,
  selected_size text,
  quantity integer,
  unit_price integer,
  total_amount integer,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not exists (
    select 1 from public.fundings
    where fundings.id = p_funding_id
      and (fundings.creator_id = auth.uid() or public.is_admin(auth.uid()))
  ) then
    raise exception '참여자 목록을 볼 권한이 없습니다.';
  end if;

  return query
  select
    fp.id,
    fp.participant_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), '참여 고객') as participant_name,
    p.phone_number,
    fp.selected_color,
    fp.selected_size,
    fp.quantity,
    fp.unit_price,
    fp.total_amount,
    fp.status,
    fp.created_at
  from public.funding_participations fp
  left join public.profiles p on p.id = fp.participant_id
  where fp.funding_id = p_funding_id
  order by fp.created_at desc;
end;
$$;

revoke all on function public.get_funding_participants(uuid) from public;
grant execute on function public.get_funding_participants(uuid) to authenticated;

create or replace function public.update_funding_participation_status(
  p_participation_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participation public.funding_participations%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_status not in ('pledged', 'confirmed', 'cancelled', 'fulfilled') then
    raise exception '올바르지 않은 참여 상태입니다.';
  end if;

  select * into v_participation
  from public.funding_participations
  where id = p_participation_id
  for update;

  if not found then
    raise exception '참여 내역을 찾을 수 없습니다.';
  end if;

  if not exists (
    select 1 from public.fundings
    where fundings.id = v_participation.funding_id
      and (fundings.creator_id = auth.uid() or public.is_admin(auth.uid()))
  ) then
    raise exception '참여 내역을 관리할 권한이 없습니다.';
  end if;

  if v_participation.status <> 'cancelled' and p_status = 'cancelled' then
    update public.fundings
    set current_orders = greatest(0, current_orders - v_participation.quantity),
        updated_at = now()
    where id = v_participation.funding_id;
  elsif v_participation.status = 'cancelled' and p_status <> 'cancelled' then
    update public.fundings
    set current_orders = current_orders + v_participation.quantity,
        updated_at = now()
    where id = v_participation.funding_id;
  end if;

  update public.funding_participations
  set status = p_status,
      updated_at = now()
  where id = p_participation_id;
end;
$$;

revoke all on function public.update_funding_participation_status(uuid, text) from public;
grant execute on function public.update_funding_participation_status(uuid, text) to authenticated;
