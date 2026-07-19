-- 카카오페이 결제가 완료된 참여만 펀딩 수량에 반영합니다.
-- 결제 전 배송 정보 확인과 개설자 전용 배송지 조회를 함께 보강합니다.

revoke all on function public.participate_in_funding(uuid, text, text, integer) from authenticated;
drop function if exists public.cancel_my_funding_participation(uuid);

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
  v_phone_number text;
  v_address text;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select phone_number, address
  into v_phone_number, v_address
  from public.profiles
  where id = v_user_id;

  if nullif(btrim(coalesce(v_phone_number, '')), '') is null
     or nullif(btrim(coalesce(v_address, '')), '') is null then
    raise exception '결제 전에 마이페이지에서 전화번호와 배송지를 입력해주세요.';
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

drop function if exists public.get_funding_participants(uuid);
create function public.get_funding_participants(p_funding_id uuid)
returns table (
  id uuid,
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
    select 1
    from public.fundings
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
    p.address,
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

notify pgrst, 'reload schema';
