alter table public.funding_participations
  add column if not exists payment_provider text not null default 'legacy',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_tid text,
  add column if not exists partner_order_id text,
  add column if not exists payment_method_type text,
  add column if not exists payment_ready_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists payment_payload jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'funding_participations_payment_provider_check'
      and conrelid = 'public.funding_participations'::regclass
  ) then
    alter table public.funding_participations
      add constraint funding_participations_payment_provider_check
      check (payment_provider in ('legacy', 'kakaopay'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'funding_participations_payment_status_check'
      and conrelid = 'public.funding_participations'::regclass
  ) then
    alter table public.funding_participations
      add constraint funding_participations_payment_status_check
      check (payment_status in ('unpaid', 'ready', 'paid', 'cancelled', 'failed'));
  end if;
end $$;

create unique index if not exists funding_participations_payment_tid_idx
  on public.funding_participations(payment_tid)
  where payment_tid is not null;

create unique index if not exists funding_participations_partner_order_id_idx
  on public.funding_participations(partner_order_id)
  where partner_order_id is not null;

create index if not exists funding_participations_payment_status_idx
  on public.funding_participations(payment_status, created_at desc);

-- 유료 참여는 서버의 카카오페이 승인 절차를 통해서만 생성합니다.
revoke execute on function public.participate_in_funding(uuid, text, text, integer) from authenticated;

create or replace function public.update_creator_funding(
  p_funding_id uuid,
  p_product_name text,
  p_description text,
  p_moq integer,
  p_price integer,
  p_funding_days integer,
  p_color_options text[],
  p_size_options text[]
)
returns public.fundings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_funding
  from public.fundings
  where id = p_funding_id and creator_id = auth.uid()
  for update;

  if not found then
    raise exception '펀딩을 수정할 권한이 없습니다.';
  end if;

  if nullif(btrim(p_product_name), '') is null then
    raise exception '상품명을 입력해주세요.';
  end if;

  if v_funding.status in ('pending', 'rejected') then
    if p_moq < 20 then
      raise exception '최소 제작 수량은 20장입니다.';
    end if;

    if p_price is not null and p_price < 0 then
      raise exception '판매가는 0원 이상이어야 합니다.';
    end if;

    if p_funding_days < 1 or p_funding_days > 90 then
      raise exception '진행 기간은 1일부터 90일까지 설정할 수 있습니다.';
    end if;

    if cardinality(p_color_options) = 0 or cardinality(p_size_options) = 0 then
      raise exception '컬러와 사이즈를 한 개 이상 등록해주세요.';
    end if;

    update public.fundings
    set product_name = btrim(p_product_name),
        description = p_description,
        moq = p_moq,
        price = p_price,
        funding_days = p_funding_days,
        color_options = p_color_options,
        size_options = p_size_options,
        status = 'pending',
        admin_comment = null,
        reviewed_at = null,
        reviewed_by = null,
        updated_at = now()
    where id = p_funding_id
    returning * into v_funding;
  else
    if p_moq <> v_funding.moq
      or p_price is distinct from v_funding.price
      or p_funding_days <> v_funding.funding_days
      or p_color_options is distinct from v_funding.color_options
      or p_size_options is distinct from v_funding.size_options then
      raise exception '승인된 펀딩은 상품명과 상세 설명만 수정할 수 있습니다.';
    end if;

    update public.fundings
    set product_name = btrim(p_product_name),
        description = p_description,
        updated_at = now()
    where id = p_funding_id
    returning * into v_funding;
  end if;

  return v_funding;
end;
$$;

revoke all on function public.update_creator_funding(uuid, text, text, integer, integer, integer, text[], text[]) from public;
grant execute on function public.update_creator_funding(uuid, text, text, integer, integer, integer, text[], text[]) to authenticated;

create or replace function public.finalize_kakaopay_funding_payment(
  p_participation_id uuid,
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

  if not found then
    raise exception '참여 내역을 찾을 수 없습니다.';
  end if;

  if v_participation.payment_status = 'paid' then
    return;
  end if;

  if v_participation.payment_status <> 'ready' then
    raise exception '결제 승인 대기 상태가 아닙니다.';
  end if;

  update public.funding_participations
  set payment_status = 'paid',
      payment_method_type = p_payment_method_type,
      paid_at = coalesce(p_approved_at, now()),
      payment_payload = p_payment_payload,
      status = 'pledged',
      updated_at = now()
  where id = p_participation_id;

  update public.fundings
  set current_orders = current_orders + v_participation.quantity,
      updated_at = now()
  where id = v_participation.funding_id;
end;
$$;

revoke all on function public.finalize_kakaopay_funding_payment(uuid, text, timestamptz, jsonb) from public;
grant execute on function public.finalize_kakaopay_funding_payment(uuid, text, timestamptz, jsonb) to service_role;

create or replace function public.cancel_funding_payment_record(
  p_participation_id uuid,
  p_payment_payload jsonb default null
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

  if not found then
    raise exception '참여 내역을 찾을 수 없습니다.';
  end if;

  if v_participation.status = 'cancelled' and v_participation.payment_status = 'cancelled' then
    return;
  end if;

  v_was_counted := v_participation.status <> 'cancelled'
    and v_participation.payment_status in ('paid', 'unpaid');

  if v_was_counted then
    update public.fundings
    set current_orders = greatest(0, current_orders - v_participation.quantity),
        updated_at = now()
    where id = v_participation.funding_id;
  end if;

  update public.funding_participations
  set status = 'cancelled',
      payment_status = 'cancelled',
      cancelled_at = now(),
      payment_payload = coalesce(p_payment_payload, payment_payload),
      updated_at = now()
  where id = p_participation_id;
end;
$$;

revoke all on function public.cancel_funding_payment_record(uuid, jsonb) from public;
grant execute on function public.cancel_funding_payment_record(uuid, jsonb) to service_role;

drop function if exists public.get_my_funding_participations();
create function public.get_my_funding_participations()
returns table (
  id uuid,
  funding_id uuid,
  funding_name text,
  funding_image_url text,
  funding_status text,
  selected_color text,
  selected_size text,
  quantity integer,
  unit_price integer,
  total_amount integer,
  status text,
  payment_provider text,
  payment_status text,
  payment_method_type text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    fp.id,
    fp.funding_id,
    f.product_name,
    f.image_url,
    f.status,
    fp.selected_color,
    fp.selected_size,
    fp.quantity,
    fp.unit_price,
    fp.total_amount,
    fp.status,
    fp.payment_provider,
    fp.payment_status,
    fp.payment_method_type,
    fp.paid_at,
    fp.cancelled_at,
    fp.created_at
  from public.funding_participations fp
  join public.fundings f on f.id = fp.funding_id
  where fp.participant_id = auth.uid()
  order by fp.created_at desc;
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
  payment_method_type text,
  paid_at timestamptz,
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
    fp.payment_method_type,
    fp.paid_at,
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

  if p_status = 'cancelled' and v_participation.payment_status = 'paid' then
    raise exception '결제 완료 건은 카카오페이 환불 기능으로 취소해주세요.';
  end if;

  if v_participation.payment_status = 'cancelled' and p_status <> 'cancelled' then
    raise exception '환불 완료된 참여 내역은 다시 활성화할 수 없습니다.';
  end if;

  if v_participation.status <> 'cancelled'
    and p_status = 'cancelled'
    and v_participation.payment_status = 'unpaid' then
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
