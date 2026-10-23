-- 판매자 센터(Seller Center) 조회 RPC
--
-- 접근 원칙
--  * 모든 seller_* RPC 는 auth.uid() 의 펀딩(fundings.creator_id = auth.uid())만 다룬다. 다른 판매자 ID 를
--    인자로 받지 않으므로 ID 를 바꿔 남의 데이터를 조회할 수 없다. 남의 펀딩 ID 를 넣으면 오류로 거부한다.
--  * 금액은 모두 서버에서 계산한다. 모의결제(payment_provider = 'mock')는 매출·결제·정산 금액에 넣지 않고
--    mock_* 항목으로만 따로 보여준다.
--  * 주문 목록은 연락처·이름을 마스킹하고 주소를 내보내지 않는다. 배송 처리에 필요한 전체 정보는
--    seller_export_orders 로만 받을 수 있고 buyer_export_logs 에 기록된다. 취소·환불 주문은 주소를 내보내지 않는다.
--  * 새 테이블 없음. 기존 데이터를 바꾸지 않는다.

create index if not exists funding_participations_funding_approved_idx
  on public.funding_participations (funding_id, payment_approved_at);

-- ---------------------------------------------------------------------------
-- 0. 공통
-- ---------------------------------------------------------------------------

create or replace function public._seller_require()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

revoke all on function public._seller_require() from public, anon, authenticated;

create or replace function public._seller_require_funding(p_funding_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_funding_id is not null and not exists (
    select 1 from public.fundings f where f.id = p_funding_id and f.creator_id = auth.uid()
  ) then
    raise exception '본인 펀딩만 조회할 수 있습니다.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public._seller_require_funding(uuid) from public, anon, authenticated;

-- 주문 진행 요약(판매자 화면 배지용)
create or replace function public._seller_order_flags(p_fp public.funding_participations)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'is_mock', p_fp.payment_provider = 'mock',
    'is_real_paid', p_fp.payment_provider <> 'mock' and p_fp.payment_status = 'paid' and p_fp.status <> 'cancelled',
    'is_cancelled', p_fp.status = 'cancelled' or p_fp.payment_status = 'cancelled',
    'is_refunded', p_fp.payment_approved_at is not null and p_fp.payment_status = 'cancelled'
  );
$$;

revoke all on function public._seller_order_flags(public.funding_participations) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. 대시보드
-- ---------------------------------------------------------------------------
-- p_granularity: day(최근 30일) | week(최근 12주) | month(최근 12개월). p_from/p_to 로 기간을 직접 줄 수 있다.

create or replace function public.seller_get_dashboard(
  p_granularity text default 'day',
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := public._seller_require();
  v_unit text := case when p_granularity in ('day', 'week', 'month') then p_granularity else 'day' end;
  v_to date := coalesce(p_to, public._kst_date(now()));
  v_from date;
  v_step interval;
begin
  v_step := case v_unit when 'day' then interval '1 day' when 'week' then interval '1 week' else interval '1 month' end;
  v_from := coalesce(p_from, case v_unit
    when 'day' then v_to - 29
    when 'week' then (date_trunc('week', v_to::timestamp) - interval '11 weeks')::date
    else (date_trunc('month', v_to::timestamp) - interval '11 months')::date
  end);
  if v_from > v_to then
    raise exception '조회 시작일이 종료일보다 늦습니다.';
  end if;
  if v_to - v_from > 800 then
    raise exception '조회 기간은 최대 800일입니다.';
  end if;

  return (
    with f as (
      select f.*, b.brand_name,
        public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days,
          f.current_orders, f.moq, f.production_status) as phase
      from public.fundings f
      left join public.brands b on b.id = f.brand_id
      where f.creator_id = v_user
    ),
    fp as (
      select p.*, (p.payment_provider = 'mock') as is_mock
      from public.funding_participations p
      join f on f.id = p.funding_id
    ),
    reviews as (
      select r.*, p.payment_provider
      from public.funding_reviews r
      join f on f.id = r.funding_id
      join public.funding_participations p on p.id = r.participation_id
    ),
    public_reviews as (
      select * from reviews r
      where r.status = 'visible'
        and exists (select 1 from public.funding_participations p
                    where p.id = r.participation_id and p.status <> 'cancelled' and p.payment_status = 'paid')
    ),
    buckets as (
      select g::date as bucket
      from generate_series(
        date_trunc(v_unit, v_from::timestamp), date_trunc(v_unit, v_to::timestamp), v_step
      ) g
    ),
    approved as (
      select date_trunc(v_unit, public._kst_date(fp.payment_approved_at)::timestamp)::date as bucket, fp.*
      from fp
      where fp.payment_approved_at is not null
        and public._kst_date(fp.payment_approved_at) between v_from and v_to
    ),
    refunded as (
      select date_trunc(v_unit, public._kst_date(fp.payment_cancelled_at)::timestamp)::date as bucket, fp.*
      from fp
      where fp.payment_approved_at is not null and fp.payment_status = 'cancelled' and fp.payment_cancelled_at is not null
        and public._kst_date(fp.payment_cancelled_at) between v_from and v_to
    )
    select jsonb_build_object(
      'range', jsonb_build_object('from', v_from, 'to', v_to, 'granularity', v_unit),
      'kpis', jsonb_build_object(
        -- 총 판매금액: 실결제 승인 누계(이후 환불 포함)
        'total_sales', coalesce((select sum(total_amount) from fp where payment_approved_at is not null and not is_mock), 0),
        -- 실제 결제 완료 금액: 실결제 중 현재 결제 유지
        'paid_amount', coalesce((select sum(total_amount) from fp where not is_mock and payment_status = 'paid' and status <> 'cancelled'), 0),
        'refunded_amount', coalesce((select sum(total_amount) from fp where not is_mock and payment_approved_at is not null and payment_status = 'cancelled'), 0),
        'mock_amount', coalesce((select sum(total_amount) from fp where is_mock and payment_status = 'paid' and status <> 'cancelled'), 0),
        'mock_orders', (select count(*) from fp where is_mock and payment_status = 'paid' and status <> 'cancelled'),
        'settlement_scheduled', coalesce((select sum(s.final_amount) from public.settlements s
          where s.creator_id = v_user and s.status in ('pending', 'scheduled', 'on_hold')), 0),
        'settlement_completed', coalesce((select sum(s.final_amount) from public.settlements s
          where s.creator_id = v_user and s.status = 'completed'), 0),
        -- 정산서가 아직 없는 펀딩의 실결제 금액(수수료 차감 전)
        'unsettled_paid_amount', coalesce((select sum(fp.total_amount) from fp
          where not fp.is_mock and fp.payment_status = 'paid' and fp.status <> 'cancelled'
            and not exists (select 1 from public.settlements s where s.funding_id = fp.funding_id)), 0),
        'active_fundings', (select count(*) from f where phase = 'funding'),
        'ended_fundings', (select count(*) from f where phase in ('succeeded', 'failed', 'in_production', 'shipping', 'completed')),
        'pending_fundings', (select count(*) from f where phase in ('draft', 'pending', 'rejected')),
        'total_fundings', (select count(*) from f),
        'total_orders', (select count(*) from fp where payment_approved_at is not null and not is_mock),
        'active_orders', (select count(*) from fp where not is_mock and payment_status = 'paid' and status <> 'cancelled'),
        'cancelled_orders', (select count(*) from fp where status = 'cancelled' or payment_status = 'cancelled'),
        'refunded_orders', (select count(*) from fp where not is_mock and payment_approved_at is not null and payment_status = 'cancelled'),
        'open_refund_requests', (select count(*) from public.refund_requests rr join f on f.id = rr.funding_id
          where rr.status in ('requested', 'reviewing', 'approved', 'processing')),
        'paid_quantity', coalesce((select sum(quantity) from fp where not is_mock and payment_status = 'paid' and status <> 'cancelled'), 0),
        'average_rating', coalesce((select round(avg(rating)::numeric, 2) from public_reviews), 0),
        'review_count', (select count(*) from public_reviews),
        'new_reviews_7d', (select count(*) from reviews where created_at >= now() - interval '7 days'),
        'unanswered_reviews', (select count(*) from reviews where seller_reply is null and status = 'visible'),
        'pending_inquiries', (select count(*) from public.funding_inquiries i join f on f.id = i.funding_id
          where i.status = 'pending' and not i.is_hidden)
      ),
      'series', coalesce((
        select jsonb_agg(jsonb_build_object(
          'date', b.bucket,
          'real_amount', coalesce((select sum(a.total_amount) from approved a where a.bucket = b.bucket and not a.is_mock), 0),
          'mock_amount', coalesce((select sum(a.total_amount) from approved a where a.bucket = b.bucket and a.is_mock), 0),
          'orders', (select count(*) from approved a where a.bucket = b.bucket and not a.is_mock),
          'quantity', coalesce((select sum(a.quantity) from approved a where a.bucket = b.bucket and not a.is_mock), 0),
          'refunded_amount', coalesce((select sum(r.total_amount) from refunded r where r.bucket = b.bucket and not r.is_mock), 0)
        ) order by b.bucket)
        from buckets b
      ), '[]'::jsonb),
      'products', coalesce((
        select jsonb_agg(x.item order by x.real_amount desc, x.created_at desc)
        from (
          select f.created_at,
            coalesce((select sum(fp.total_amount) from fp where fp.funding_id = f.id and not fp.is_mock and fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0) as real_amount,
            jsonb_build_object(
              'funding_id', f.id,
              'product_name', f.product_name,
              'brand_name', f.brand_name,
              'image_url', f.image_url,
              'phase', f.phase,
              'price', f.price,
              'moq', f.moq,
              'current_orders', f.current_orders,
              'progress', case when f.moq > 0 then round(f.current_orders::numeric * 100 / f.moq, 1) else 0 end,
              'real_amount', coalesce((select sum(fp.total_amount) from fp where fp.funding_id = f.id and not fp.is_mock and fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0),
              'mock_amount', coalesce((select sum(fp.total_amount) from fp where fp.funding_id = f.id and fp.is_mock and fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0),
              'paid_quantity', coalesce((select sum(fp.quantity) from fp where fp.funding_id = f.id and not fp.is_mock and fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0),
              'orders', (select count(*) from fp where fp.funding_id = f.id and not fp.is_mock and fp.payment_status = 'paid' and fp.status <> 'cancelled'),
              'average_rating', coalesce((select round(avg(r.rating)::numeric, 1) from public_reviews r where r.funding_id = f.id), 0),
              'review_count', (select count(*) from public_reviews r where r.funding_id = f.id),
              'series', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'date', b.bucket,
                  'real_amount', coalesce((select sum(a.total_amount) from approved a where a.funding_id = f.id and a.bucket = b.bucket and not a.is_mock), 0),
                  'quantity', coalesce((select sum(a.quantity) from approved a where a.funding_id = f.id and a.bucket = b.bucket and not a.is_mock), 0)
                ) order by b.bucket) from buckets b
              ), '[]'::jsonb)
            ) as item
          from f
        ) x
      ), '[]'::jsonb),
      'brands', coalesce((
        select jsonb_agg(jsonb_build_object(
          'brand_id', g.brand_id,
          'brand_name', coalesce(g.brand_name, '브랜드 미지정'),
          'fundings', g.fundings,
          'real_amount', g.real_amount,
          'paid_quantity', g.paid_quantity
        ) order by g.real_amount desc)
        from (
          select f.brand_id, f.brand_name, count(distinct f.id) as fundings,
            coalesce(sum(fp.total_amount) filter (where not fp.is_mock and fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0) as real_amount,
            coalesce(sum(fp.quantity) filter (where not fp.is_mock and fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0) as paid_quantity
          from f left join fp on fp.funding_id = f.id
          group by f.brand_id, f.brand_name
        ) g
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.seller_get_dashboard(text, date, date) from public, anon;
grant execute on function public.seller_get_dashboard(text, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 상품 · 펀딩 목록 (관리 화면용)
-- ---------------------------------------------------------------------------

create or replace function public.seller_list_products()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := public._seller_require();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id,
      'product_name', f.product_name,
      'brand_id', f.brand_id,
      'brand_name', b.brand_name,
      'image_url', f.image_url,
      'cloth_type', f.cloth_type,
      'material', f.material,
      'price', f.price,
      'color_options', to_jsonb(coalesce(f.color_options, '{}'::text[])),
      'size_options', to_jsonb(coalesce(f.size_options, '{}'::text[])),
      'color_count', (select count(*) from public.funding_colors c where c.funding_id = f.id),
      'moq', f.moq,
      'current_orders', f.current_orders,
      'progress', case when f.moq > 0 then round(f.current_orders::numeric * 100 / f.moq, 1) else 0 end,
      'funding_days', f.funding_days,
      'status', f.status,
      'admin_comment', f.admin_comment,
      'phase', public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days,
        f.current_orders, f.moq, f.production_status),
      'start_at', f.reviewed_at,
      'end_at', public._funding_end_at(f.reviewed_at, f.funding_days),
      'early_closed', f.early_closed,
      'early_closed_at', f.early_closed_at,
      'closed_at', f.closed_at,
      'suspended_at', f.suspended_at,
      'production_status', f.production_status,
      'production_label', public._production_stage_label(f.production_status),
      'production_updated_at', f.production_updated_at,
      'success_at', f.success_at,
      'created_at', f.created_at,
      'updated_at', f.updated_at,
      'real_paid_orders', (select count(*) from public.funding_participations fp
        where fp.funding_id = f.id and fp.payment_provider <> 'mock' and fp.payment_status = 'paid' and fp.status <> 'cancelled'),
      'real_amount', coalesce((select sum(fp.total_amount) from public.funding_participations fp
        where fp.funding_id = f.id and fp.payment_provider <> 'mock' and fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0),
      'mock_orders', (select count(*) from public.funding_participations fp
        where fp.funding_id = f.id and fp.payment_provider = 'mock' and fp.payment_status = 'paid' and fp.status <> 'cancelled'),
      'pending_payment_orders', (select count(*) from public.funding_participations fp
        where fp.funding_id = f.id and fp.payment_status = 'ready'),
      'review_count', (select count(*) from public.funding_reviews r where r.funding_id = f.id and r.status = 'visible'),
      'average_rating', coalesce((select round(avg(r.rating)::numeric, 1) from public.funding_reviews r
        where r.funding_id = f.id and r.status = 'visible'), 0),
      'pending_inquiries', (select count(*) from public.funding_inquiries i
        where i.funding_id = f.id and i.status = 'pending' and not i.is_hidden),
      -- 화면 버튼 표시용. 실제 허용 여부는 각 RPC(update_creator_funding, creator_early_close_funding,
      -- creator_update_production_stage)가 다시 검증한다.
      'can_edit', f.status in ('draft', 'pending', 'rejected', 'approved') and f.suspended_at is null,
      'can_request_early_close', f.status = 'approved' and f.suspended_at is null and not f.early_closed
        and f.closed_at is null
        and public._funding_end_at(f.reviewed_at, f.funding_days) > now(),
      'can_advance_production', f.production_status is not null and f.suspended_at is null
        and public._production_stage_rank(f.production_status) < public._production_stage_rank('inspection_packing')
    ) order by f.created_at desc)
    from public.fundings f
    left join public.brands b on b.id = f.brand_id
    where f.creator_id = v_user
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.seller_list_products() from public, anon;
grant execute on function public.seller_list_products() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. 주문 관리 (마스킹 목록 · 기록되는 엑셀 다운로드)
-- ---------------------------------------------------------------------------

create or replace function public._seller_order_rows(
  p_user uuid,
  p_funding_id uuid,
  p_search text,
  p_status text,
  p_payment_type text
)
returns table (data jsonb, ordered_at timestamptz, is_cancelled boolean, is_mock boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    to_jsonb(x) || jsonb_build_object(
      'refund_request_status', rr.status,
      'refund_requested_at', rr.created_at,
      'pg_refund_status', rr.pg_refund_status,
      'payment_cancelled_at', fp.payment_cancelled_at,
      'cancellation_reason', fp.cancellation_reason
    ) || public._seller_order_flags(fp),
    x.ordered_at,
    (fp.status = 'cancelled' or fp.payment_status = 'cancelled'),
    fp.payment_provider = 'mock'
  from public._funding_buyer_rows(p_funding_id, null, p_user, p_search, 'all', null, null, null) x
  join public.funding_participations fp on fp.id = x.id
  left join lateral (
    select r.status, r.created_at, r.pg_refund_status
    from public.refund_requests r where r.participation_id = fp.id
    order by r.created_at desc limit 1
  ) rr on true
  where x.creator_id = p_user
    and (case coalesce(nullif(p_status, ''), 'all')
      when 'all' then fp.payment_status <> 'failed'
      when 'paid' then fp.payment_status = 'paid' and fp.status <> 'cancelled'
      when 'pending' then fp.payment_status in ('ready', 'unpaid') and fp.status <> 'cancelled'
      when 'cancelled' then fp.status = 'cancelled' or fp.payment_status = 'cancelled'
      when 'refund_requested' then rr.status in ('requested', 'reviewing', 'approved', 'processing')
      when 'preparing' then fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.shipping_status = 'preparing'
      when 'shipped' then fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.shipping_status = 'shipped'
      when 'delivered' then fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.shipping_status = 'delivered'
      when 'failed' then fp.payment_status = 'failed'
      else false
    end)
    and (case coalesce(nullif(p_payment_type, ''), 'all')
      when 'all' then true
      when 'real' then fp.payment_provider <> 'mock'
      when 'mock' then fp.payment_provider = 'mock'
      else false
    end);
$$;

revoke all on function public._seller_order_rows(uuid, uuid, text, text, text) from public, anon, authenticated;

create or replace function public.seller_list_orders(
  p_funding_id uuid default null,
  p_search text default null,
  p_status text default 'all',
  p_payment_type text default 'all',
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := public._seller_require();
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  perform public._seller_require_funding(p_funding_id);

  return (
    with all_rows as (
      select * from public._seller_order_rows(v_user, p_funding_id, p_search, p_status, p_payment_type)
    ),
    page as (
      select * from all_rows order by ordered_at desc limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from all_rows),
      'counts', (
        select jsonb_build_object(
          'all', count(*) filter (where fp.payment_status <> 'failed'),
          'paid', count(*) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled'),
          'pending', count(*) filter (where fp.payment_status in ('ready', 'unpaid') and fp.status <> 'cancelled'),
          'cancelled', count(*) filter (where fp.status = 'cancelled' or fp.payment_status = 'cancelled'),
          'mock', count(*) filter (where fp.payment_provider = 'mock' and fp.payment_status = 'paid')
        )
        from public.funding_participations fp
        join public.fundings f on f.id = fp.funding_id
        where f.creator_id = v_user and (p_funding_id is null or fp.funding_id = p_funding_id)
      ),
      -- 목록은 주문 확인용이다. 이름·연락처는 마스킹하고 주소·이메일은 내보내지 않는다.
      'rows', coalesce((
        select jsonb_agg(
          (p.data - 'buyer_phone' - 'buyer_email' - 'recipient_phone' - 'postal_code' - 'address'
            - 'address_detail' - 'delivery_message' - 'participant_id' - 'creator_id' - 'creator_name')
          || jsonb_build_object(
            'buyer_name', public._mask_name(p.data->>'buyer_name'),
            'recipient_name', public._mask_name(p.data->>'recipient_name'),
            'buyer_phone_masked', public._mask_phone(p.data->>'buyer_phone')
          )
          order by p.ordered_at desc)
        from page p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.seller_list_orders(uuid, text, text, text, integer, integer) from public, anon;
grant execute on function public.seller_list_orders(uuid, text, text, text, integer, integer) to authenticated;

-- 배송 처리용 다운로드. 조건은 목록과 같고, 다운로드할 때마다 buyer_export_logs 에 남는다.
create or replace function public.seller_export_orders(
  p_funding_id uuid default null,
  p_search text default null,
  p_status text default 'all',
  p_payment_type text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public._seller_require();
  v_rows jsonb;
  v_count integer;
begin
  perform public._seller_require_funding(p_funding_id);

  select
    coalesce(jsonb_agg(
      case when r.is_cancelled
        -- 취소·환불 주문은 배송하지 않으므로 연락처·주소를 내보내지 않는다(개인정보 최소화).
        then (r.data - 'buyer_phone' - 'buyer_email' - 'recipient_phone' - 'postal_code' - 'address'
          - 'address_detail' - 'delivery_message')
          || jsonb_build_object('buyer_name', public._mask_name(r.data->>'buyer_name'),
                                'recipient_name', public._mask_name(r.data->>'recipient_name'))
        else r.data
      end - 'participant_id' - 'creator_id'
      order by r.ordered_at desc), '[]'::jsonb),
    count(*)
  into v_rows, v_count
  from public._seller_order_rows(v_user, p_funding_id, p_search, p_status, p_payment_type) r;

  if v_count > 20000 then
    raise exception '한 번에 20,000건까지 다운로드할 수 있습니다. 펀딩이나 상태로 범위를 좁혀주세요.';
  end if;

  insert into public.buyer_export_logs (actor_id, actor_role, scope, funding_id, creator_id, row_count, filters)
  values (v_user, 'creator', 'seller_center', p_funding_id, v_user, v_count, jsonb_build_object(
    'search', p_search, 'status', p_status, 'payment_type', p_payment_type));

  return jsonb_build_object('rows', v_rows, 'count', v_count);
end;
$$;

revoke all on function public.seller_export_orders(uuid, text, text, text) from public, anon;
grant execute on function public.seller_export_orders(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 고객 문의 (내 모든 펀딩 · 비공개 포함). 답변은 기존 answer_funding_inquiry 를 쓴다.
-- ---------------------------------------------------------------------------

create or replace function public.seller_list_inquiries(
  p_filter text default 'all',
  p_funding_id uuid default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := public._seller_require();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_filter text := case when p_filter in ('all', 'pending', 'answered') then p_filter else 'all' end;
begin
  perform public._seller_require_funding(p_funding_id);

  return (
    with mine as (
      select i, f.product_name
      from public.funding_inquiries i
      join public.fundings f on f.id = i.funding_id
      where f.creator_id = v_user and (p_funding_id is null or i.funding_id = p_funding_id)
    ),
    filtered as (
      select * from mine m where v_filter = 'all' or (m.i).status = v_filter
    ),
    page as (
      select * from filtered x
      order by ((x.i).status = 'pending') desc, (x.i).created_at desc
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'all', (select count(*) from mine),
        'pending', (select count(*) from mine m where (m.i).status = 'pending'),
        'answered', (select count(*) from mine m where (m.i).status = 'answered')
      ),
      'rows', coalesce((
        select jsonb_agg(public._funding_inquiry_json(p.i, v_user) || jsonb_build_object(
          'funding_id', (p.i).funding_id, 'funding_name', p.product_name
        ) order by ((p.i).status = 'pending') desc, (p.i).created_at desc)
        from page p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.seller_list_inquiries(text, uuid, integer, integer) from public, anon;
grant execute on function public.seller_list_inquiries(text, uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 정산 (관리자 내부 메모 제외)
-- ---------------------------------------------------------------------------

create or replace function public.seller_list_settlements()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := public._seller_require();
begin
  return jsonb_build_object(
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'funding_id', s.funding_id,
        'funding_name', f.product_name,
        'gross_amount', s.gross_amount,
        'refund_amount', s.refund_amount,
        'net_sales', s.net_sales,
        'mock_amount', s.mock_amount,
        'commission_rate', s.commission_rate,
        'platform_fee', s.platform_fee,
        'production_cost', s.production_cost,
        'other_deductions', s.other_deductions,
        'final_amount', s.final_amount,
        'scheduled_date', s.scheduled_date,
        'status', s.status,
        'hold_reason', s.hold_reason,
        'completed_at', s.completed_at,
        'created_at', s.created_at
      ) order by s.created_at desc)
      from public.settlements s
      join public.fundings f on f.id = s.funding_id
      where s.creator_id = v_user or f.creator_id = v_user
    ), '[]'::jsonb),
    -- 정산서가 아직 만들어지지 않은 펀딩의 실결제 현황(예상치, 수수료·제작비 차감 전)
    'unsettled', coalesce((
      select jsonb_agg(jsonb_build_object(
        'funding_id', f.id,
        'funding_name', f.product_name,
        'phase', public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days,
          f.current_orders, f.moq, f.production_status),
        'real_amount', x.real_amount,
        'mock_amount', x.mock_amount,
        'paid_orders', x.paid_orders
      ) order by f.created_at desc)
      from public.fundings f
      cross join lateral (
        select
          coalesce(sum(fp.total_amount) filter (where fp.payment_provider <> 'mock' and fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0) as real_amount,
          coalesce(sum(fp.total_amount) filter (where fp.payment_provider = 'mock' and fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0) as mock_amount,
          count(*) filter (where fp.payment_provider <> 'mock' and fp.payment_status = 'paid' and fp.status <> 'cancelled') as paid_orders
        from public.funding_participations fp where fp.funding_id = f.id
      ) x
      where f.creator_id = v_user
        and not exists (select 1 from public.settlements s where s.funding_id = f.id)
        and (x.real_amount > 0 or x.mock_amount > 0)
    ), '[]'::jsonb),
    'commission_rate', public._platform_setting_numeric('platform_commission_rate', 10)
  );
end;
$$;

revoke all on function public.seller_list_settlements() from public, anon;
grant execute on function public.seller_list_settlements() to authenticated;

notify pgrst, 'reload schema';
