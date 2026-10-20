-- KSNET(KSPay) 실결제로 펀딩 참여를 받습니다.
--
-- 흐름: create_ksnet_funding_order 로 결제 대기(ready) 참여를 만들고 → KSPay 결제창에서 카드 인증 →
-- ksnet-return Edge Function 이 **DB 금액으로** KSNET 에 승인을 걸고 → finalize_funding_payment 로 확정합니다.
-- 확정 전(ready)에는 펀딩 수량(current_orders)에 반영하지 않습니다. 카카오페이 흐름과 같은 규칙입니다.

alter table public.funding_participations
  drop constraint if exists funding_participations_payment_provider_check;

alter table public.funding_participations
  add constraint funding_participations_payment_provider_check
  check (payment_provider in ('none', 'kakaopay', 'mock', 'ksnet'));

-- 결제 대기 참여 생성. 검증과 저장 항목은 create_mock_funding_order 와 같고,
-- 차이는 결제 상태를 ready 로 두고 수량을 올리지 않는다는 것뿐입니다.
create or replace function public.create_ksnet_funding_order(
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
    status, payment_provider, payment_status, partner_order_id,
    orderer_name, orderer_phone, orderer_email,
    recipient_name, recipient_phone, postal_code,
    shipping_address, shipping_address_detail, delivery_message,
    privacy_consent_at, production_stage, shipping_status
  ) values (
    v_participation_id, p_funding_id, v_user_id, p_color, p_size, p_quantity, v_funding.price,
    'pledged', 'ksnet', 'ready', v_partner_order_id,
    btrim(p_orderer_name), btrim(p_orderer_phone), btrim(p_orderer_email),
    btrim(p_recipient_name), btrim(p_recipient_phone), btrim(p_postal_code),
    btrim(p_address), nullif(btrim(coalesce(p_address_detail, '')), ''), nullif(btrim(coalesce(p_delivery_message, '')), ''),
    now(), 'funding', 'preparing'
  );

  return query select v_participation_id, v_partner_order_id, v_funding.product_name, v_funding.price * p_quantity;
end;
$$;

revoke all on function public.create_ksnet_funding_order(
  uuid, text, text, integer, text, text, text, text, text, text, text, text, text, boolean
) from public;
grant execute on function public.create_ksnet_funding_order(
  uuid, text, text, integer, text, text, text, text, text, text, text, text, text, boolean
) to authenticated;

-- 아래 세 함수는 20260921000000 정의 그대로이고, 결제수단 조건에 ksnet 만 반영했습니다.
--  * update_funding_participation_status: KSNET 결제 완료 건도 판매자가 상태만 '취소'로 바꾸지 못하게 막는다
--    (돈은 그대로인데 참여만 취소되는 것을 막기 위해 환불 경로로 보낸다).
--  * get_seller_funding_dashboard / get_admin_funding_overview: '실결제 매출'을 카카오페이만이 아니라
--    모의결제가 아닌 결제 전체로 집계한다 (관리자 운영 RPC 의 gmv_real 과 같은 기준).

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

  if v_participation.payment_provider in ('kakaopay', 'mock', 'ksnet')
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
      where fp.status <> 'cancelled' and fp.payment_status = 'paid' and fp.payment_provider <> 'mock'
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
      where fp.status <> 'cancelled' and fp.payment_status = 'paid' and fp.payment_provider <> 'mock'
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
