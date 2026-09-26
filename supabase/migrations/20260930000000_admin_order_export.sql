-- 관리자 주문(참여자) 엑셀 내보내기
--  * 개인정보(이름·연락처·주소) 원문이 포함되므로 orders.pii 권한만 허용하고, 내보낼 때마다 Audit Log 에 기록한다.
--  * 조회 전용. 기존 데이터는 변경하지 않는다.

create or replace function public.admin_export_orders(
  p_search text default null,
  p_state text default 'all',
  p_funding_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.pii');
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_digits text := nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '');
  v_rows jsonb;
  v_count integer;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 2 then
    raise exception '다운로드 사유를 입력해주세요.';
  end if;

  with base as (
    select
      fp.*,
      coalesce(fp.orderer_name, nullif(pr.full_name, ''), nullif(pr.username, ''), '참여 고객') as orderer_name_v,
      coalesce(fp.orderer_phone, pr.phone_number) as orderer_phone_v,
      coalesce(fp.shipping_address, pr.address) as address_v,
      f.product_name as product_name_v,
      b.brand_name as brand_name_v,
      public._order_state(fp.status, fp.payment_status, fp.payment_approved_at, fp.production_stage, fp.shipping_status) as state_v
    from public.funding_participations fp
    join public.fundings f on f.id = fp.funding_id
    left join public.brands b on b.id = f.brand_id
    left join public.profiles pr on pr.id = fp.participant_id
    where p_funding_id is null or fp.funding_id = p_funding_id
  ),
  filtered as (
    select * from base x
    where (v_search is null
        or x.partner_order_id ilike '%' || v_search || '%'
        or x.orderer_name_v ilike '%' || v_search || '%'
        or x.recipient_name ilike '%' || v_search || '%'
        or x.product_name_v ilike '%' || v_search || '%'
        or x.brand_name_v ilike '%' || v_search || '%'
        or (v_digits is not null and char_length(v_digits) >= 4 and (
          regexp_replace(coalesce(x.orderer_phone_v, ''), '\D', '', 'g') like '%' || v_digits || '%'
          or regexp_replace(coalesce(x.recipient_phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
        )))
      and (coalesce(p_state, 'all') = 'all' or x.state_v = p_state)
    order by x.created_at desc
    limit 20000
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'order_number', x.partner_order_id,
      'funding_id', x.funding_id,
      'ordered_at', x.created_at,
      'paid_at', x.payment_approved_at,
      'product_name', x.product_name_v,
      'brand_name', x.brand_name_v,
      'color', x.selected_color,
      'size', x.selected_size,
      'quantity', x.quantity,
      'unit_price', x.unit_price,
      'total_amount', x.total_amount,
      'payment_type', x.payment_type,
      'payment_provider', x.payment_provider,
      'payment_status', x.payment_status,
      'order_status', x.status,
      'order_state', x.state_v,
      'orderer_name', x.orderer_name_v,
      'orderer_phone', x.orderer_phone_v,
      'orderer_email', x.orderer_email,
      'recipient_name', coalesce(x.recipient_name, x.orderer_name_v),
      'recipient_phone', coalesce(x.recipient_phone, x.orderer_phone_v),
      'postal_code', x.postal_code,
      'address', x.address_v,
      'address_detail', x.shipping_address_detail,
      'delivery_message', x.delivery_message,
      'production_stage', x.production_stage,
      'shipping_status', x.shipping_status,
      'tracking_number', x.tracking_number
    ) order by x.created_at desc), '[]'::jsonb), count(*)
  into v_rows, v_count
  from filtered x;

  perform public._admin_log(
    'orders.export', 'order', coalesce(p_funding_id::text, 'all'),
    coalesce((select product_name from public.fundings where id = p_funding_id), '전체 주문'),
    null,
    jsonb_build_object('rows', v_count),
    btrim(p_reason),
    jsonb_build_object('search', v_search, 'state', coalesce(p_state, 'all'), 'funding_id', p_funding_id)
  );

  return jsonb_build_object('rows', v_rows, 'count', v_count);
end;
$$;

revoke all on function public.admin_export_orders(text, text, uuid, text) from public, anon;
grant execute on function public.admin_export_orders(text, text, uuid, text) to authenticated;
