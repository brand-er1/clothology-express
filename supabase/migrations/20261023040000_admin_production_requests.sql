-- 관리자 콘솔 '제작 의뢰' 메뉴 (public.orders: AI 디자인 의뢰 · 디자인 업로드 의뢰 · 기성품 단체복 빠른 제작)
--
-- 기존에는 Super Admin 전용 '기타 운영 도구' 안에서만 볼 수 있었다. 콘솔 RBAC 에 맞춰 조회 · 처리 RPC 를 둔다.
--  * 조회: orders.view (Super · Operations · CS). 고객 연락처는 orders.pii 가 있어야 원문, 없으면 마스킹
--  * 상태 변경(검토 대기 / 승인 / 반려): orders.manage, Audit Log 기록. 반려는 사유 필수
-- 테이블 구조 · 데이터는 바꾸지 않는다.

create index if not exists orders_status_created_idx on public.orders (status, created_at desc);

create or replace function public.admin_list_production_requests(
  p_status text default 'pending',
  p_source text default 'all',
  p_search text default null,
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
  v_actor uuid := public._admin_require('orders.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'orders.pii');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_status text := case when p_status in ('all', 'pending', 'approved', 'rejected') then p_status else 'pending' end;
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_digits text := nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '');
begin
  return (
    with base as (
      select o.*,
        coalesce(nullif(btrim(pr.full_name), ''), nullif(btrim(o.guest_name), ''), nullif(btrim(pr.username), '')) as customer_name,
        coalesce(nullif(btrim(pr.phone_number), ''), nullif(btrim(o.guest_phone), '')) as customer_phone,
        u.email as customer_email
      from public.orders o
      left join public.profiles pr on pr.id = o.user_id
      left join auth.users u on u.id = o.user_id
      where o.status::text not in ('draft', 'deleted')
        and (coalesce(p_source, 'all') = 'all' or o.request_source = p_source)
        and (v_search is null
          or o.id::text ilike v_search || '%'
          or o.request_title ilike '%' || v_search || '%'
          or o.cloth_type ilike '%' || v_search || '%'
          or o.detail_description ilike '%' || v_search || '%'
          or o.guest_name ilike '%' || v_search || '%'
          or pr.full_name ilike '%' || v_search || '%'
          or (v_pii and u.email ilike '%' || v_search || '%')
          or (v_pii and v_digits is not null and char_length(v_digits) >= 4 and (
            regexp_replace(coalesce(pr.phone_number, ''), '\D', '', 'g') like '%' || v_digits || '%'
            or regexp_replace(coalesce(o.guest_phone, ''), '\D', '', 'g') like '%' || v_digits || '%')))
    ),
    filtered as (select * from base where v_status = 'all' or status::text = v_status),
    page as (select * from filtered order by created_at desc limit v_limit offset v_offset)
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'all', (select count(*) from base),
        'pending', (select count(*) from base where status::text = 'pending'),
        'approved', (select count(*) from base where status::text = 'approved'),
        'rejected', (select count(*) from base where status::text = 'rejected')
      ),
      'can_manage', public._admin_has_permission(v_actor, 'orders.manage'),
      'can_view_pii', v_pii,
      'rows', coalesce((
        select jsonb_agg(
          (to_jsonb(p) - 'customer_name' - 'customer_phone' - 'customer_email' - 'guest_phone' - 'guest_name')
          || jsonb_build_object(
            'customer_name', case when v_pii then p.customer_name else public._mask_name(p.customer_name) end,
            'customer_phone', case when v_pii then p.customer_phone else public._mask_phone(p.customer_phone) end,
            'customer_email', case when v_pii then p.customer_email else null end,
            'guest_name', case when v_pii then p.guest_name else public._mask_name(p.guest_name) end,
            'guest_phone', case when v_pii then p.guest_phone else public._mask_phone(p.guest_phone) end,
            'is_guest', p.user_id is null
          )
          order by p.created_at desc)
        from page p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_production_requests(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_production_requests(text, text, text, integer, integer) to authenticated;

-- p_status: pending(검토 대기로 되돌림) | approved(승인 · 제작 진행) | rejected(반려, 사유 필수)
create or replace function public.admin_set_production_request_status(p_order_id uuid, p_status text, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.manage');
  v_row public.orders%rowtype;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception '제작 의뢰 상태는 검토 대기 · 승인 · 반려만 선택할 수 있습니다.';
  end if;
  if p_status = 'rejected' and v_comment is null then
    raise exception '반려 사유를 입력해주세요.';
  end if;
  if char_length(coalesce(v_comment, '')) > 2000 then
    raise exception '관리자 메모는 2000자까지 입력할 수 있습니다.';
  end if;

  select * into v_row from public.orders where id = p_order_id for update;
  if not found or v_row.status::text in ('draft', 'deleted') then
    raise exception '제작 의뢰를 찾을 수 없습니다.';
  end if;

  perform set_config('brander.admin_rpc', 'on', true);
  update public.orders
  set status = p_status::public.order_status,
      admin_comment = coalesce(v_comment, admin_comment),
      reviewed_at = case when p_status = 'pending' then null else now() end,
      reviewed_by = case when p_status = 'pending' then null else v_actor end,
      updated_at = now()
  where id = p_order_id;

  perform public._admin_log(
    'production_request.' || p_status, 'order', p_order_id::text,
    coalesce(v_row.request_title, v_row.cloth_type),
    jsonb_build_object('status', v_row.status, 'admin_comment', v_row.admin_comment),
    jsonb_build_object('status', p_status, 'admin_comment', coalesce(v_comment, v_row.admin_comment)),
    v_comment,
    jsonb_build_object('request_source', v_row.request_source)
  );

  return jsonb_build_object('id', p_order_id, 'status', p_status);
end;
$$;

revoke all on function public.admin_set_production_request_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_production_request_status(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
