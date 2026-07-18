alter table public.funding_participations
  add column if not exists payment_provider text not null default 'none'
    check (payment_provider in ('none', 'kakaopay')),
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'ready', 'paid', 'cancelled', 'failed')),
  add column if not exists payment_tid text,
  add column if not exists partner_order_id text,
  add column if not exists payment_method_type text,
  add column if not exists payment_approved_at timestamptz,
  add column if not exists payment_cancelled_at timestamptz,
  add column if not exists payment_payload jsonb;

create unique index if not exists funding_participations_payment_tid_idx
  on public.funding_participations(payment_tid)
  where payment_tid is not null;

create unique index if not exists funding_participations_partner_order_id_idx
  on public.funding_participations(partner_order_id)
  where partner_order_id is not null;

revoke all on function public.participate_in_funding(uuid, text, text, integer) from authenticated;

create or replace function public.create_funding_payment(
  p_funding_id uuid,
  p_color text,
  p_size text,
  p_quantity integer
)
returns table (
  participation_id uuid,
  partner_order_id text,
  partner_user_id text,
  item_name text,
  total_amount integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_funding public.fundings%rowtype;
  v_participation_id uuid := gen_random_uuid();
  v_partner_order_id text;
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

  v_partner_order_id := 'BRANDER-' || replace(v_participation_id::text, '-', '');

  insert into public.funding_participations (
    id,
    funding_id,
    participant_id,
    selected_color,
    selected_size,
    quantity,
    unit_price,
    status,
    payment_provider,
    payment_status,
    partner_order_id
  ) values (
    v_participation_id,
    p_funding_id,
    v_user_id,
    p_color,
    p_size,
    p_quantity,
    v_funding.price,
    'pledged',
    'kakaopay',
    'ready',
    v_partner_order_id
  );

  return query select
    v_participation_id,
    v_partner_order_id,
    v_user_id::text,
    v_funding.product_name,
    v_funding.price * p_quantity;
end;
$$;

revoke all on function public.create_funding_payment(uuid, text, text, integer) from public;
grant execute on function public.create_funding_payment(uuid, text, text, integer) to authenticated;

create or replace function public.finalize_funding_payment(
  p_participation_id uuid,
  p_user_id uuid,
  p_payment_method_type text,
  p_approved_at timestamptz,
  p_payment_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participation public.funding_participations%rowtype;
begin
  select * into v_participation
  from public.funding_participations
  where id = p_participation_id
  for update;

  if not found or v_participation.participant_id <> p_user_id then
    raise exception '결제할 펀딩 참여 내역을 찾을 수 없습니다.';
  end if;

  if v_participation.payment_status = 'paid' then
    return;
  end if;

  if v_participation.payment_status <> 'ready' or v_participation.status = 'cancelled' then
    raise exception '승인할 수 없는 결제 상태입니다.';
  end if;

  update public.funding_participations
  set payment_status = 'paid',
      payment_method_type = p_payment_method_type,
      payment_approved_at = coalesce(p_approved_at, now()),
      payment_payload = p_payment_payload,
      updated_at = now()
  where id = p_participation_id;

  update public.fundings
  set current_orders = current_orders + v_participation.quantity,
      updated_at = now()
  where id = v_participation.funding_id;
end;
$$;

revoke all on function public.finalize_funding_payment(uuid, uuid, text, timestamptz, jsonb) from public;
grant execute on function public.finalize_funding_payment(uuid, uuid, text, timestamptz, jsonb) to service_role;

create or replace function public.finalize_funding_cancellation(
  p_participation_id uuid,
  p_user_id uuid,
  p_payment_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participation public.funding_participations%rowtype;
  v_was_counted boolean;
begin
  select * into v_participation
  from public.funding_participations
  where id = p_participation_id
  for update;

  if not found or v_participation.participant_id <> p_user_id then
    raise exception '취소할 펀딩 참여 내역을 찾을 수 없습니다.';
  end if;

  if v_participation.status = 'fulfilled' then
    raise exception '이미 제작 처리가 완료된 참여 건은 취소할 수 없습니다.';
  end if;

  if v_participation.status = 'cancelled' and v_participation.payment_status = 'cancelled' then
    return;
  end if;

  v_was_counted := v_participation.status <> 'cancelled'
    and v_participation.payment_status in ('unpaid', 'paid');

  update public.funding_participations
  set status = 'cancelled',
      payment_status = 'cancelled',
      payment_cancelled_at = now(),
      payment_payload = coalesce(p_payment_payload, payment_payload),
      updated_at = now()
  where id = p_participation_id;

  if v_was_counted then
    update public.fundings
    set current_orders = greatest(0, current_orders - v_participation.quantity),
        updated_at = now()
    where id = v_participation.funding_id;
  end if;
end;
$$;

revoke all on function public.finalize_funding_cancellation(uuid, uuid, jsonb) from public;
grant execute on function public.finalize_funding_cancellation(uuid, uuid, jsonb) to service_role;

create or replace function public.fail_funding_payment(
  p_participation_id uuid,
  p_user_id uuid,
  p_error_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.funding_participations
  set status = 'cancelled',
      payment_status = 'failed',
      payment_payload = p_error_payload,
      updated_at = now()
  where id = p_participation_id
    and participant_id = p_user_id
    and payment_status = 'ready';
end;
$$;

revoke all on function public.fail_funding_payment(uuid, uuid, jsonb) from public;
grant execute on function public.fail_funding_payment(uuid, uuid, jsonb) to service_role;

drop function if exists public.get_my_funding_participations();
create function public.get_my_funding_participations()
returns table (
  id uuid,
  funding_id uuid,
  participant_id uuid,
  selected_color text,
  selected_size text,
  quantity integer,
  unit_price integer,
  total_amount integer,
  status text,
  payment_provider text,
  payment_status text,
  payment_method_type text,
  payment_approved_at timestamptz,
  payment_cancelled_at timestamptz,
  created_at timestamptz,
  product_name text,
  image_url text,
  funding_status text,
  creator_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return query
  select
    fp.id,
    fp.funding_id,
    fp.participant_id,
    fp.selected_color,
    fp.selected_size,
    fp.quantity,
    fp.unit_price,
    fp.total_amount,
    fp.status,
    fp.payment_provider,
    fp.payment_status,
    fp.payment_method_type,
    fp.payment_approved_at,
    fp.payment_cancelled_at,
    fp.created_at,
    f.product_name,
    f.image_url,
    f.status,
    f.creator_id
  from public.funding_participations fp
  join public.fundings f on f.id = fp.funding_id
  where fp.participant_id = auth.uid()
  order by fp.created_at desc;
end;
$$;

revoke all on function public.get_my_funding_participations() from public;
grant execute on function public.get_my_funding_participations() to authenticated;

drop function if exists public.get_funding_participants(uuid);
create function public.get_funding_participants(p_funding_id uuid)
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
  payment_provider text,
  payment_status text,
  payment_approved_at timestamptz,
  payment_cancelled_at timestamptz,
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
    fp.payment_provider,
    fp.payment_status,
    fp.payment_approved_at,
    fp.payment_cancelled_at,
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

  if v_participation.payment_provider = 'kakaopay'
    and v_participation.payment_status = 'paid'
    and p_status = 'cancelled' then
    raise exception '결제 완료 건은 참여자의 내 펀딩 페이지에서 환불과 함께 취소해야 합니다.';
  end if;

  if v_participation.payment_status = 'cancelled' and p_status <> 'cancelled' then
    raise exception '환불 완료된 참여 건은 다시 활성화할 수 없습니다.';
  end if;

  if v_participation.status <> 'cancelled'
    and p_status = 'cancelled'
    and v_participation.payment_status in ('unpaid', 'paid') then
    update public.fundings
    set current_orders = greatest(0, current_orders - v_participation.quantity),
        updated_at = now()
    where id = v_participation.funding_id;
  elsif v_participation.status = 'cancelled'
    and p_status <> 'cancelled'
    and v_participation.payment_status = 'unpaid' then
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