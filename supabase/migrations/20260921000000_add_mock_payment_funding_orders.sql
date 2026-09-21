-- PG 연동 전 단계의 모의결제(Mock Payment) 펀딩 참여 흐름을 추가합니다.
-- 기존 카카오페이 결제 컬럼/함수는 그대로 유지하고, payment_provider에 'mock'을
-- 추가해 실제 결제와 명확히 구분되는 내부 모의결제 주문을 지원합니다.
-- 참여 건에 주문자/수령인/배송지 정보를 직접 저장해 향후 실제 배송에 사용합니다.

alter table public.funding_participations
  drop constraint if exists funding_participations_payment_provider_check;

alter table public.funding_participations
  add constraint funding_participations_payment_provider_check
  check (payment_provider in ('none', 'kakaopay', 'mock'));

alter table public.funding_participations
  add column if not exists payment_type text generated always as (
    case when payment_provider = 'mock' then 'MOCK' else 'REAL' end
  ) stored;

alter table public.funding_participations
  add column if not exists orderer_name text,
  add column if not exists orderer_phone text,
  add column if not exists orderer_email text,
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text,
  add column if not exists postal_code text,
  add column if not exists shipping_address text,
  add column if not exists shipping_address_detail text,
  add column if not exists delivery_message text,
  add column if not exists privacy_consent_at timestamptz;

alter table public.funding_participations
  add column if not exists production_stage text not null default 'funding'
    check (production_stage in (
      'funding', 'fabric_sourcing', 'sampling', 'production',
      'inspection_packing', 'shipping_ready', 'delivered'
    ));

alter table public.funding_participations
  add column if not exists shipping_status text not null default 'preparing'
    check (shipping_status in ('preparing', 'shipped', 'delivered')),
  add column if not exists tracking_number text,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

-- 모의결제 참여 생성: 실제 PG 호출 없이 즉시 결제 완료 처리하고
-- 주문자/배송지 정보를 참여 건에 직접 저장합니다.
create or replace function public.create_mock_funding_order(
  p_funding_id uuid,
  p_color text,
  p_size text,
  p_quantity integer,
  p_orderer_name text,
  p_orderer_phone text,
  p_orderer_email text,
  p_recipient_name text,
  p_recipient_phone text,
  p_postal_code text,
  p_address text,
  p_address_detail text,
  p_delivery_message text,
  p_agree_privacy boolean
)
returns table (
  participation_id uuid,
  partner_order_id text,
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

  if p_agree_privacy is not true then
    raise exception '개인정보 수집·이용에 동의해야 펀딩에 참여할 수 있습니다.';
  end if;

  if nullif(btrim(coalesce(p_orderer_name, '')), '') is null
     or nullif(btrim(coalesce(p_orderer_phone, '')), '') is null
     or nullif(btrim(coalesce(p_orderer_email, '')), '') is null
     or nullif(btrim(coalesce(p_recipient_name, '')), '') is null
     or nullif(btrim(coalesce(p_recipient_phone, '')), '') is null
     or nullif(btrim(coalesce(p_postal_code, '')), '') is null
     or nullif(btrim(coalesce(p_address, '')), '') is null then
    raise exception '주문자 정보와 배송지를 모두 입력해주세요.';
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
    id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price,
    status, payment_provider, payment_status, partner_order_id, payment_approved_at,
    orderer_name, orderer_phone, orderer_email,
    recipient_name, recipient_phone, postal_code,
    shipping_address, shipping_address_detail, delivery_message,
    privacy_consent_at, production_stage, shipping_status
  ) values (
    v_participation_id, p_funding_id, v_user_id, p_color, p_size, p_quantity, v_funding.price,
    'pledged', 'mock', 'paid', v_partner_order_id, now(),
    btrim(p_orderer_name), btrim(p_orderer_phone), btrim(p_orderer_email),
    btrim(p_recipient_name), btrim(p_recipient_phone), btrim(p_postal_code),
    btrim(p_address), nullif(btrim(coalesce(p_address_detail, '')), ''), nullif(btrim(coalesce(p_delivery_message, '')), ''),
    now(), 'funding', 'preparing'
  );

  update public.fundings
  set current_orders = current_orders + p_quantity,
      updated_at = now()
  where id = p_funding_id;

  return query select v_participation_id, v_partner_order_id, v_funding.price * p_quantity;
end;
$$;

revoke all on function public.create_mock_funding_order(
  uuid, text, text, integer, text, text, text, text, text, text, text, text, text, boolean
) from public;
grant execute on function public.create_mock_funding_order(
  uuid, text, text, integer, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;

-- 참여자(개설자/관리자) 조회용 함수를 새 배송·주문 정보까지 포함하도록 확장합니다.
drop function if exists public.get_funding_participants(uuid);
create function public.get_funding_participants(p_funding_id uuid)
returns table (
  id uuid,
  order_number text,
  participant_id uuid,
  participant_name text,
  phone_number text,
  address text,
  selected_color text,
  selected_size text,
  quantity integer,
  unit_price integer,
  total_amount integer,
  status text,
  payment_provider text,
  payment_type text,
  payment_status text,
  payment_approved_at timestamptz,
  payment_cancelled_at timestamptz,
  created_at timestamptz,
  orderer_name text,
  orderer_phone text,
  orderer_email text,
  recipient_name text,
  recipient_phone text,
  postal_code text,
  shipping_address text,
  shipping_address_detail text,
  delivery_message text,
  production_stage text,
  shipping_status text,
  tracking_number text
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
    fp.partner_order_id,
    fp.participant_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), '참여 고객'),
    coalesce(fp.orderer_phone, p.phone_number),
    coalesce(fp.shipping_address, p.address),
    fp.selected_color,
    fp.selected_size,
    fp.quantity,
    fp.unit_price,
    fp.total_amount,
    fp.status,
    fp.payment_provider,
    fp.payment_type,
    fp.payment_status,
    fp.payment_approved_at,
    fp.payment_cancelled_at,
    fp.created_at,
    coalesce(fp.orderer_name, nullif(p.full_name, ''), nullif(p.username, '')),
    coalesce(fp.orderer_phone, p.phone_number),
    fp.orderer_email,
    coalesce(fp.recipient_name, nullif(p.full_name, ''), nullif(p.username, '')),
    coalesce(fp.recipient_phone, p.phone_number),
    fp.postal_code,
    coalesce(fp.shipping_address, p.address),
    fp.shipping_address_detail,
    fp.delivery_message,
    fp.production_stage,
    fp.shipping_status,
    fp.tracking_number
  from public.funding_participations fp
  left join public.profiles p on p.id = fp.participant_id
  where fp.funding_id = p_funding_id
  order by fp.created_at desc;
end;
$$;

revoke all on function public.get_funding_participants(uuid) from public;
grant execute on function public.get_funding_participants(uuid) to authenticated;

-- 구매자 마이페이지용 참여 내역 함수를 주문번호·제작진행상태·배송정보까지 확장합니다.
drop function if exists public.get_my_funding_participations();
create function public.get_my_funding_participations()
returns table (
  id uuid,
  order_number text,
  funding_id uuid,
  participant_id uuid,
  selected_color text,
  selected_size text,
  quantity integer,
  unit_price integer,
  total_amount integer,
  status text,
  payment_provider text,
  payment_type text,
  payment_status text,
  payment_method_type text,
  payment_approved_at timestamptz,
  payment_cancelled_at timestamptz,
  created_at timestamptz,
  product_name text,
  image_url text,
  funding_status text,
  creator_id uuid,
  funding_moq integer,
  funding_current_orders integer,
  production_stage text,
  shipping_status text,
  tracking_number text,
  recipient_name text,
  recipient_phone text,
  postal_code text,
  shipping_address text,
  shipping_address_detail text,
  delivery_message text
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
    fp.partner_order_id,
    fp.funding_id,
    fp.participant_id,
    fp.selected_color,
    fp.selected_size,
    fp.quantity,
    fp.unit_price,
    fp.total_amount,
    fp.status,
    fp.payment_provider,
    fp.payment_type,
    fp.payment_status,
    fp.payment_method_type,
    fp.payment_approved_at,
    fp.payment_cancelled_at,
    fp.created_at,
    f.product_name,
    f.image_url,
    f.status,
    f.creator_id,
    f.moq,
    f.current_orders,
    fp.production_stage,
    fp.shipping_status,
    fp.tracking_number,
    fp.recipient_name,
    fp.recipient_phone,
    fp.postal_code,
    fp.shipping_address,
    fp.shipping_address_detail,
    fp.delivery_message
  from public.funding_participations fp
  join public.fundings f on f.id = fp.funding_id
  where fp.participant_id = auth.uid()
  order by fp.created_at desc;
end;
$$;

revoke all on function public.get_my_funding_participations() from public;
grant execute on function public.get_my_funding_participations() to authenticated;

-- 개설자/관리자가 제작 진행 상태·배송 상태·송장번호를 갱신하는 함수입니다.
create or replace function public.update_funding_order_fulfillment(
  p_participation_id uuid,
  p_production_stage text default null,
  p_shipping_status text default null,
  p_tracking_number text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participation public.funding_participations%rowtype;
  v_next_shipping_status text;
  v_next_production_stage text;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_production_stage is not null and p_production_stage not in (
    'funding', 'fabric_sourcing', 'sampling', 'production',
    'inspection_packing', 'shipping_ready', 'delivered'
  ) then
    raise exception '올바르지 않은 제작 진행 상태입니다.';
  end if;

  if p_shipping_status is not null and p_shipping_status not in ('preparing', 'shipped', 'delivered') then
    raise exception '올바르지 않은 배송 상태입니다.';
  end if;

  select * into v_participation
  from public.funding_participations
  where id = p_participation_id
  for update;

  if not found then
    raise exception '주문을 찾을 수 없습니다.';
  end if;

  if not exists (
    select 1 from public.fundings
    where fundings.id = v_participation.funding_id
      and (fundings.creator_id = auth.uid() or public.is_admin(auth.uid()))
  ) then
    raise exception '이 주문을 관리할 권한이 없습니다.';
  end if;

  v_next_shipping_status := coalesce(p_shipping_status, v_participation.shipping_status);
  v_next_production_stage := coalesce(p_production_stage, v_participation.production_stage);

  update public.funding_participations
  set production_stage = v_next_production_stage,
      shipping_status = v_next_shipping_status,
      tracking_number = coalesce(nullif(btrim(coalesce(p_tracking_number, '')), ''), tracking_number),
      shipped_at = case
        when v_next_shipping_status = 'shipped' and shipped_at is null then now()
        else shipped_at
      end,
      delivered_at = case
        when v_next_shipping_status = 'delivered' and delivered_at is null then now()
        else delivered_at
      end,
      status = case
        when v_next_production_stage = 'delivered' then 'fulfilled'
        else status
      end,
      updated_at = now()
  where id = p_participation_id;
end;
$$;

revoke all on function public.update_funding_order_fulfillment(uuid, text, text, text) from public;
grant execute on function public.update_funding_order_fulfillment(uuid, text, text, text) to authenticated;

-- 결제 완료 건은 판매자가 바로 상태를 취소로 바꾸지 못하도록 모의결제에도 동일하게 적용합니다.
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

  if v_participation.payment_provider in ('kakaopay', 'mock')
    and v_participation.payment_status = 'paid'
    and p_status = 'cancelled' then
    raise exception '결제 완료 건은 참여자의 내 펀딩 페이지에서 취소(환불)해야 합니다.';
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

-- 판매자 대시보드: 자신이 개설한 펀딩별 KPI만 조회합니다 (다른 판매자 데이터 접근 불가).
create or replace function public.get_seller_funding_dashboard()
returns table (
  funding_id uuid,
  product_name text,
  image_url text,
  price integer,
  moq integer,
  current_orders integer,
  participant_count integer,
  funding_rate numeric,
  expected_revenue bigint,
  mock_revenue bigint,
  real_revenue bigint,
  start_date timestamptz,
  end_date timestamptz,
  status text
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
    f.id,
    f.product_name,
    f.image_url,
    f.price,
    f.moq,
    f.current_orders,
    count(distinct fp.participant_id) filter (
      where fp.status <> 'cancelled' and fp.payment_status = 'paid'
    )::integer,
    case when f.moq > 0 then round((f.current_orders::numeric / f.moq) * 100, 1) else 0 end,
    coalesce(sum(fp.total_amount) filter (where fp.status <> 'cancelled' and fp.payment_status = 'paid'), 0),
    coalesce(sum(fp.total_amount) filter (
      where fp.status <> 'cancelled' and fp.payment_status = 'paid' and fp.payment_provider = 'mock'
    ), 0),
    coalesce(sum(fp.total_amount) filter (
      where fp.status <> 'cancelled' and fp.payment_status = 'paid' and fp.payment_provider = 'kakaopay'
    ), 0),
    f.reviewed_at,
    case when f.reviewed_at is not null then f.reviewed_at + (f.funding_days || ' days')::interval else null end,
    f.status
  from public.fundings f
  left join public.funding_participations fp on fp.funding_id = f.id
  where f.creator_id = auth.uid()
  group by f.id
  order by f.created_at desc;
end;
$$;

revoke all on function public.get_seller_funding_dashboard() from public;
grant execute on function public.get_seller_funding_dashboard() to authenticated;

create or replace function public.get_seller_dashboard_totals()
returns table (
  total_expected_revenue bigint,
  total_participants integer,
  total_quantity bigint,
  avg_funding_rate numeric
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
    coalesce((
      select sum(fp.total_amount)
      from public.funding_participations fp
      join public.fundings f on f.id = fp.funding_id
      where f.creator_id = auth.uid() and fp.status <> 'cancelled' and fp.payment_status = 'paid'
    ), 0),
    (
      select count(distinct fp.participant_id)
      from public.funding_participations fp
      join public.fundings f on f.id = fp.funding_id
      where f.creator_id = auth.uid() and fp.status <> 'cancelled' and fp.payment_status = 'paid'
    )::integer,
    coalesce((
      select sum(fp.quantity)
      from public.funding_participations fp
      join public.fundings f on f.id = fp.funding_id
      where f.creator_id = auth.uid() and fp.status <> 'cancelled' and fp.payment_status = 'paid'
    ), 0),
    coalesce((
      select round(avg(case when f.moq > 0 then (f.current_orders::numeric / f.moq) * 100 else 0 end), 1)
      from public.fundings f
      where f.creator_id = auth.uid() and f.status = 'approved'
    ), 0);
end;
$$;

revoke all on function public.get_seller_dashboard_totals() from public;
grant execute on function public.get_seller_dashboard_totals() to authenticated;

-- 관리자 대시보드: 전체 플랫폼 KPI (모의결제 주문금액과 실제결제 매출을 분리 표시).
create or replace function public.get_admin_funding_overview()
returns table (
  total_fundings integer,
  active_fundings integer,
  total_participants integer,
  total_quantity bigint,
  total_mock_amount bigint,
  total_real_amount bigint,
  avg_funding_rate numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  return query
  select
    (select count(*) from public.fundings)::integer,
    (select count(*) from public.fundings where status = 'approved')::integer,
    (
      select count(distinct fp.participant_id)
      from public.funding_participations fp
      where fp.status <> 'cancelled' and fp.payment_status = 'paid'
    )::integer,
    coalesce((
      select sum(fp.quantity)
      from public.funding_participations fp
      where fp.status <> 'cancelled' and fp.payment_status = 'paid'
    ), 0),
    coalesce((
      select sum(fp.total_amount)
      from public.funding_participations fp
      where fp.status <> 'cancelled' and fp.payment_status = 'paid' and fp.payment_provider = 'mock'
    ), 0),
    coalesce((
      select sum(fp.total_amount)
      from public.funding_participations fp
      where fp.status <> 'cancelled' and fp.payment_status = 'paid' and fp.payment_provider = 'kakaopay'
    ), 0),
    coalesce((
      select round(avg(case when f.moq > 0 then (f.current_orders::numeric / f.moq) * 100 else 0 end), 1)
      from public.fundings f
      where f.status = 'approved'
    ), 0);
end;
$$;

revoke all on function public.get_admin_funding_overview() from public;
grant execute on function public.get_admin_funding_overview() to authenticated;

notify pgrst, 'reload schema';
