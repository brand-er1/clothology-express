-- 펀딩 구매자 관리 · 엑셀(.xlsx) 내보내기
--  * 제작자: 본인이 개설한 펀딩(fundings.creator_id = auth.uid())의 구매자만 조회/다운로드
--  * 관리자: orders.pii 권한(개인정보 열람)이 있는 관리자만 전체/브랜드/제작자/펀딩 단위 조회/다운로드
--  * 비로그인·일반 구매자·다른 제작자는 모든 RPC 에서 42501 로 거부한다(펀딩 존재 여부도 노출하지 않음).
--  * funding_participations 의 기존 RLS(본인/개설자/관리자 SELECT 전용)는 그대로 유지한다.
--  * 추가되는 것은 조회 RPC 와 다운로드 기록 테이블 1개뿐이며 기존 테이블·데이터는 변경하지 않는다.

-- ---------------------------------------------------------------------------
-- 1. 다운로드 기록 (개인정보 반출 이력)
-- ---------------------------------------------------------------------------

create table if not exists public.buyer_export_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null,
  scope text not null,
  funding_id uuid references public.fundings(id) on delete set null,
  brand_id uuid,
  creator_id uuid,
  row_count integer not null default 0,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint buyer_export_logs_actor_role_check check (actor_role in ('creator', 'admin'))
);

create index if not exists buyer_export_logs_actor_created_idx
  on public.buyer_export_logs(actor_id, created_at desc);
create index if not exists buyer_export_logs_funding_created_idx
  on public.buyer_export_logs(funding_id, created_at desc);

comment on table public.buyer_export_logs is
  '구매자 명단 엑셀 다운로드 기록. 쓰기는 export RPC(SECURITY DEFINER)만 가능하다.';

alter table public.buyer_export_logs enable row level security;

drop policy if exists "Export actors and auditors can view buyer export logs" on public.buyer_export_logs;
create policy "Export actors and auditors can view buyer export logs"
  on public.buyer_export_logs for select
  to authenticated
  using (actor_id = auth.uid() or public.has_admin_permission('audit.view'));

revoke insert, update, delete on public.buyer_export_logs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. 내부 공통 조회 (클라이언트 직접 호출 불가)
-- ---------------------------------------------------------------------------

-- 상태 그룹: paid(결제 완료) / pending(결제 대기) / cancelled(취소·환불)
--  public._order_state 와 같은 기준: 취소가 최우선, 그다음 결제 완료 여부.
-- 배송 필터(preparing/shipped/delivered)는 결제 완료 주문에만 적용한다.
create or replace function public._funding_buyer_rows(
  p_funding_id uuid default null,
  p_brand_id uuid default null,
  p_creator_id uuid default null,
  p_search text default null,
  p_status text default 'all',
  p_size text default null,
  p_color text default null,
  p_ids uuid[] default null
)
returns table (
  id uuid,
  funding_id uuid,
  brand_id uuid,
  creator_id uuid,
  participant_id uuid,
  order_number text,
  funding_name text,
  brand_name text,
  creator_name text,
  buyer_name text,
  buyer_phone text,
  buyer_email text,
  color text,
  size text,
  quantity integer,
  unit_price integer,
  total_amount integer,
  order_status text,
  payment_status text,
  payment_type text,
  payment_provider text,
  payment_approved_at timestamptz,
  ordered_at timestamptz,
  status_group text,
  production_stage text,
  shipping_status text,
  recipient_name text,
  recipient_phone text,
  postal_code text,
  address text,
  address_detail text,
  delivery_message text,
  tracking_number text,
  courier text
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      fp.id,
      fp.funding_id,
      f.brand_id,
      f.creator_id,
      fp.participant_id,
      fp.partner_order_id as order_number,
      f.product_name as funding_name,
      b.brand_name,
      coalesce(nullif(btrim(cp.display_name), ''), nullif(btrim(cpr.full_name), ''), nullif(btrim(cpr.username), '')) as creator_name,
      coalesce(nullif(btrim(fp.orderer_name), ''), nullif(btrim(pr.full_name), ''), nullif(btrim(pr.username), ''), '참여 고객') as buyer_name,
      coalesce(nullif(btrim(fp.orderer_phone), ''), nullif(btrim(pr.phone_number), '')) as buyer_phone,
      nullif(btrim(fp.orderer_email), '') as buyer_email,
      fp.selected_color as color,
      fp.selected_size as size,
      fp.quantity,
      fp.unit_price,
      fp.total_amount,
      fp.status as order_status,
      fp.payment_status,
      fp.payment_type,
      fp.payment_provider,
      fp.payment_approved_at,
      fp.created_at as ordered_at,
      case
        when fp.status = 'cancelled' or fp.payment_status = 'cancelled' then 'cancelled'
        when fp.payment_status = 'paid' then 'paid'
        else 'pending'
      end as status_group,
      fp.production_stage,
      fp.shipping_status,
      coalesce(nullif(btrim(fp.recipient_name), ''), nullif(btrim(fp.orderer_name), ''), nullif(btrim(pr.full_name), '')) as recipient_name,
      coalesce(nullif(btrim(fp.recipient_phone), ''), nullif(btrim(fp.orderer_phone), ''), nullif(btrim(pr.phone_number), '')) as recipient_phone,
      nullif(btrim(fp.postal_code), '') as postal_code,
      coalesce(nullif(btrim(fp.shipping_address), ''), nullif(btrim(pr.address), '')) as address,
      nullif(btrim(fp.shipping_address_detail), '') as address_detail,
      nullif(btrim(fp.delivery_message), '') as delivery_message,
      nullif(btrim(fp.tracking_number), '') as tracking_number,
      nullif(btrim(fp.courier), '') as courier
    from public.funding_participations fp
    join public.fundings f on f.id = fp.funding_id
    left join public.brands b on b.id = f.brand_id
    left join public.creator_profiles cp on cp.user_id = f.creator_id
    left join public.profiles cpr on cpr.id = f.creator_id
    left join public.profiles pr on pr.id = fp.participant_id
    where (p_funding_id is null or fp.funding_id = p_funding_id)
      and (p_brand_id is null or f.brand_id = p_brand_id)
      and (p_creator_id is null or f.creator_id = p_creator_id)
      and (p_ids is null or fp.id = any(p_ids))
  ),
  term as (
    select
      nullif(btrim(coalesce(p_search, '')), '') as search,
      nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '') as digits
  )
  select x.*
  from base x, term t
  where (t.search is null
      or x.buyer_name ilike '%' || t.search || '%'
      or x.recipient_name ilike '%' || t.search || '%'
      or x.order_number ilike '%' || t.search || '%'
      or (t.digits is not null and char_length(t.digits) >= 3 and (
        regexp_replace(coalesce(x.buyer_phone, ''), '\D', '', 'g') like '%' || t.digits || '%'
        or regexp_replace(coalesce(x.recipient_phone, ''), '\D', '', 'g') like '%' || t.digits || '%'
      )))
    and (nullif(p_size, '') is null or x.size = p_size)
    and (nullif(p_color, '') is null or x.color = p_color)
    and (case coalesce(nullif(p_status, ''), 'all')
      when 'all' then true
      when 'paid' then x.status_group = 'paid'
      when 'pending' then x.status_group = 'pending'
      when 'cancelled' then x.status_group = 'cancelled'
      when 'preparing' then x.status_group = 'paid' and x.shipping_status = 'preparing'
      when 'shipped' then x.status_group = 'paid' and x.shipping_status = 'shipped'
      when 'delivered' then x.status_group = 'paid' and x.shipping_status = 'delivered'
      else false
    end)
  order by x.ordered_at desc;
$$;

revoke all on function public._funding_buyer_rows(uuid, uuid, uuid, text, text, text, text, uuid[]) from public, anon, authenticated;

-- 펀딩 단위 접근 판정: 'creator'(본인 펀딩) | 'admin'(orders.pii) | 예외
-- 존재하지 않는 펀딩과 남의 펀딩을 같은 메시지로 거부해 펀딩 ID 탐색을 막는다.
create or replace function public._funding_buyer_access(p_funding_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_creator uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  select f.creator_id into v_creator from public.fundings f where f.id = p_funding_id;

  if v_creator is not null and v_creator = v_uid then
    return 'creator';
  end if;
  if found and public._admin_has_permission(v_uid, 'orders.pii') then
    return 'admin';
  end if;

  raise exception '구매자 정보를 볼 권한이 없습니다.' using errcode = '42501';
end;
$$;

revoke all on function public._funding_buyer_access(uuid) from public, anon, authenticated;

create or replace function public._funding_buyer_meta(p_funding_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', f.id,
    'product_name', f.product_name,
    'brand_name', b.brand_name,
    'creator_name', coalesce(nullif(btrim(cp.display_name), ''), nullif(btrim(pr.full_name), ''), nullif(btrim(pr.username), '')),
    'size_options', coalesce(to_jsonb(f.size_options), '[]'::jsonb),
    'color_options', coalesce(to_jsonb(f.color_options), '[]'::jsonb)
  )
  from public.fundings f
  left join public.brands b on b.id = f.brand_id
  left join public.creator_profiles cp on cp.user_id = f.creator_id
  left join public.profiles pr on pr.id = f.creator_id
  where f.id = p_funding_id;
$$;

revoke all on function public._funding_buyer_meta(uuid) from public, anon, authenticated;

-- 결제 완료 · 미취소 주문 기준 생산 수량 / 상태별 집계
create or replace function public._funding_buyer_summary(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  with x as (
    select
      r->>'participant_id' as participant_id,
      r->>'status_group' as status_group,
      coalesce((r->>'quantity')::integer, 0) as quantity,
      coalesce(r->>'color', '-') as color,
      coalesce(r->>'size', '-') as size
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  )
  select jsonb_build_object(
    'buyers', (select count(distinct participant_id) from x where status_group <> 'cancelled'),
    'orders', (select count(*) from x),
    'quantity', (select coalesce(sum(quantity), 0) from x where status_group = 'paid'),
    'paid', (select count(*) from x where status_group = 'paid'),
    'pending', (select count(*) from x where status_group = 'pending'),
    'cancelled', (select count(*) from x where status_group = 'cancelled'),
    'matrix', coalesce((
      select jsonb_agg(jsonb_build_object('color', color, 'size', size, 'quantity', qty) order by color, size)
      from (select color, size, sum(quantity) as qty from x where status_group = 'paid' group by color, size) m
    ), '[]'::jsonb)
  );
$$;

revoke all on function public._funding_buyer_summary(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. 제작자(본인 펀딩) · 관리자 공용: 펀딩 1건의 구매자
-- ---------------------------------------------------------------------------

create or replace function public.get_funding_buyers(p_funding_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_access text := public._funding_buyer_access(p_funding_id);
begin
  return jsonb_build_object(
    'access', v_access,
    'funding', public._funding_buyer_meta(p_funding_id),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.ordered_at desc)
      from public._funding_buyer_rows(p_funding_id) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_funding_buyers(uuid) from public, anon;
grant execute on function public.get_funding_buyers(uuid) to authenticated;

-- 엑셀 생성용 데이터. 화면에서 받은 목록을 그대로 쓰지 않고 다운로드 시점에 권한과 데이터를 다시 확인한다.
--  p_ids: null = 펀딩 전체, 배열 = 현재 필터 결과 또는 체크한 주문(이 펀딩에 속한 주문만 반환)
create or replace function public.export_funding_buyers(
  p_funding_id uuid,
  p_ids uuid[] default null,
  p_scope text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_access text := public._funding_buyer_access(p_funding_id);
  v_scope text := case when p_scope in ('all', 'filtered', 'selected') then p_scope else 'all' end;
  v_rows jsonb;
  v_count integer;
begin
  if p_ids is not null and cardinality(p_ids) = 0 then
    raise exception '다운로드할 구매자를 선택해주세요.';
  end if;
  if p_ids is not null and cardinality(p_ids) > 20000 then
    raise exception '한 번에 20,000건까지 다운로드할 수 있습니다.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.ordered_at desc), '[]'::jsonb), count(*)
  into v_rows, v_count
  from public._funding_buyer_rows(p_funding_id, null, null, null, 'all', null, null, p_ids) x;

  insert into public.buyer_export_logs (actor_id, actor_role, scope, funding_id, row_count, filters)
  values (auth.uid(), v_access, v_scope, p_funding_id, v_count,
    jsonb_build_object('requested', coalesce(cardinality(p_ids), 0)));

  if v_access = 'admin' then
    perform public._admin_log(
      'buyers.export', 'funding', p_funding_id::text,
      (select product_name from public.fundings where id = p_funding_id),
      null, jsonb_build_object('rows', v_count), '펀딩 구매자 관리 화면에서 다운로드',
      jsonb_build_object('scope', v_scope)
    );
  end if;

  return jsonb_build_object(
    'funding', public._funding_buyer_meta(p_funding_id),
    'rows', v_rows,
    'count', v_count
  );
end;
$$;

revoke all on function public.export_funding_buyers(uuid, uuid[], text) from public, anon;
grant execute on function public.export_funding_buyers(uuid, uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 관리자 전용: 전체 → 브랜드 → 제작자 → 펀딩
-- ---------------------------------------------------------------------------

create or replace function public.admin_buyer_filter_options()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_require('orders.pii');

  return jsonb_build_object(
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.brand_name) order by b.brand_name)
      from public.brands b
      where exists (select 1 from public.fundings f where f.brand_id = b.id)
    ), '[]'::jsonb),
    'creators', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.creator_id, 'name', c.name, 'brand_ids', c.brand_ids) order by c.name)
      from (
        select
          f.creator_id,
          coalesce(nullif(btrim(max(cp.display_name)), ''), nullif(btrim(max(pr.full_name)), ''), nullif(btrim(max(pr.username)), ''), '이름 없음') as name,
          coalesce(jsonb_agg(distinct f.brand_id) filter (where f.brand_id is not null), '[]'::jsonb) as brand_ids
        from public.fundings f
        left join public.creator_profiles cp on cp.user_id = f.creator_id
        left join public.profiles pr on pr.id = f.creator_id
        where f.creator_id is not null
        group by f.creator_id
      ) c
    ), '[]'::jsonb),
    'fundings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'name', f.product_name, 'brand_id', f.brand_id, 'creator_id', f.creator_id,
        'size_options', coalesce(to_jsonb(f.size_options), '[]'::jsonb),
        'color_options', coalesce(to_jsonb(f.color_options), '[]'::jsonb),
        'orders', (select count(*) from public.funding_participations fp where fp.funding_id = f.id)
      ) order by f.created_at desc)
      from public.fundings f
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_buyer_filter_options() from public, anon;
grant execute on function public.admin_buyer_filter_options() to authenticated;

create or replace function public.admin_list_buyers(
  p_brand_id uuid default null,
  p_creator_id uuid default null,
  p_funding_id uuid default null,
  p_search text default null,
  p_status text default 'all',
  p_size text default null,
  p_color text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_all jsonb;
  v_scope jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public._admin_require('orders.pii');

  select coalesce(jsonb_agg(to_jsonb(x) order by x.ordered_at desc), '[]'::jsonb)
  into v_all
  from public._funding_buyer_rows(p_funding_id, p_brand_id, p_creator_id, p_search, p_status, p_size, p_color) x;

  -- 사이즈/컬러 필터 선택지는 검색·상태 필터와 무관하게 선택 범위(브랜드/제작자/펀딩) 전체 기준
  select jsonb_build_object(
    'sizes', coalesce(jsonb_agg(distinct x.size) filter (where x.size is not null), '[]'::jsonb),
    'colors', coalesce(jsonb_agg(distinct x.color) filter (where x.color is not null), '[]'::jsonb)
  )
  into v_scope
  from public._funding_buyer_rows(p_funding_id, p_brand_id, p_creator_id) x;

  return jsonb_build_object(
    'total', jsonb_array_length(v_all),
    'rows', coalesce((
      select jsonb_agg(r.value order by r.ordinality)
      from jsonb_array_elements(v_all) with ordinality r
      where r.ordinality > v_offset and r.ordinality <= v_offset + v_limit
    ), '[]'::jsonb),
    'ids', coalesce((select jsonb_agg(r->'id') from jsonb_array_elements(v_all) r), '[]'::jsonb),
    'summary', public._funding_buyer_summary(v_all),
    'options', v_scope
  );
end;
$$;

revoke all on function public.admin_list_buyers(uuid, uuid, uuid, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_buyers(uuid, uuid, uuid, text, text, text, text, integer, integer) to authenticated;

create or replace function public.admin_export_buyers(
  p_brand_id uuid default null,
  p_creator_id uuid default null,
  p_funding_id uuid default null,
  p_search text default null,
  p_status text default 'all',
  p_size text default null,
  p_color text default null,
  p_ids uuid[] default null,
  p_scope text default 'filtered',
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.pii');
  v_rows jsonb;
  v_count integer;
  v_label text;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 2 then
    raise exception '다운로드 사유를 입력해주세요.';
  end if;
  if p_ids is not null and cardinality(p_ids) = 0 then
    raise exception '다운로드할 구매자를 선택해주세요.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.ordered_at desc), '[]'::jsonb), count(*)
  into v_rows, v_count
  from (
    select * from public._funding_buyer_rows(p_funding_id, p_brand_id, p_creator_id, p_search, p_status, p_size, p_color, p_ids)
    limit 20000
  ) x;

  v_label := coalesce(
    (select product_name from public.fundings where id = p_funding_id),
    (select brand_name from public.brands where id = p_brand_id),
    (select coalesce(nullif(btrim(cp.display_name), ''), nullif(btrim(pr.full_name), ''), nullif(btrim(pr.username), ''))
       from public.profiles pr left join public.creator_profiles cp on cp.user_id = pr.id where pr.id = p_creator_id),
    '전체'
  );

  insert into public.buyer_export_logs (actor_id, actor_role, scope, funding_id, brand_id, creator_id, row_count, filters)
  values (v_actor, 'admin', coalesce(nullif(p_scope, ''), 'filtered'), p_funding_id, p_brand_id, p_creator_id, v_count,
    jsonb_build_object('search', p_search, 'status', p_status, 'size', p_size, 'color', p_color,
      'requested', coalesce(cardinality(p_ids), 0)));

  perform public._admin_log(
    'buyers.export',
    case when p_funding_id is not null then 'funding' when p_creator_id is not null then 'creator'
         when p_brand_id is not null then 'brand' else 'order' end,
    coalesce(p_funding_id, p_creator_id, p_brand_id)::text,
    v_label,
    null,
    jsonb_build_object('rows', v_count),
    btrim(p_reason),
    jsonb_build_object('scope', p_scope, 'search', p_search, 'status', p_status, 'size', p_size, 'color', p_color,
      'brand_id', p_brand_id, 'creator_id', p_creator_id, 'funding_id', p_funding_id)
  );

  return jsonb_build_object(
    'rows', v_rows,
    'count', v_count,
    'label', v_label,
    'funding', case when p_funding_id is null then null else public._funding_buyer_meta(p_funding_id) end
  );
end;
$$;

revoke all on function public.admin_export_buyers(uuid, uuid, uuid, text, text, text, text, uuid[], text, text) from public, anon;
grant execute on function public.admin_export_buyers(uuid, uuid, uuid, text, text, text, text, uuid[], text, text) to authenticated;
