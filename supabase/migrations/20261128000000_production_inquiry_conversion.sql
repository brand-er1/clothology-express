-- 제작 의뢰 전환 구조 개편
--
-- 브랜더의 핵심 서비스인 '의류 제작 · 생산 대행'을 어디서든 바로 의뢰할 수 있도록 기존 제작 의뢰(public.orders)를 확장한다.
-- 새 테이블을 따로 만들지 않고, 관리자 콘솔 '제작 의뢰' 메뉴가 이미 보고 있는 public.orders 에 붙인다(중복 개발 없음).
--
--  1. request_source = 'production_inquiry': /production-request 간편 제작 의뢰 양식(비회원 포함)
--  2. 공통 의뢰 정보 컬럼: 연락처 · 희망 예산 · 희망 납기 · 개인정보 동의 시각 · 유입 정보
--  3. 상담 진행 상태(consult_status) 7단계: 접수 완료 → 상담 진행 → 견적 전달 → 계약 완료 → 제작 진행 → 제작 완료 / 계약 미성사
--     기존 status(pending/approved/rejected)는 고객 화면 · 기존 흐름이 그대로 쓰므로 자동으로 맞춰 둔다.
--  4. 관리자 메모는 고객이 자기 주문을 조회할 때 노출되지 않도록 별도 테이블(production_request_notes)에 둔다.
--  5. 전환 이벤트(제작 의뢰 CTA 클릭 · AI 결과 화면 CTA 클릭 · 양식 진입 · 제출 완료)를 기존 track_site_event 로 받고
--     관리자 통계 RPC(admin_get_production_conversion)로 유입 페이지별 전환율을 계산한다.
-- 기존 컬럼 · 데이터는 삭제하거나 바꾸지 않는다(consult_status 초기값만 기존 status 로부터 채운다).

-- ---------------------------------------------------------------------------
-- 1) orders 확장
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists budget_range text,
  add column if not exists desired_due_date date,
  add column if not exists privacy_consented_at timestamptz,
  add column if not exists consult_status text not null default 'received',
  add column if not exists consult_status_updated_at timestamptz,
  add column if not exists inquiry_meta jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_consult_status_check') then
    alter table public.orders add constraint orders_consult_status_check check (consult_status in (
      'received', 'consulting', 'quote_sent', 'contracted', 'in_production', 'completed', 'not_contracted'
    ));
  end if;
end $$;

comment on column public.orders.contact_name is '제작 의뢰 양식에 고객이 직접 입력한 고객명 또는 브랜드명';
comment on column public.orders.contact_phone is '제작 의뢰 양식에 고객이 직접 입력한 연락처(필수, 숫자만)';
comment on column public.orders.budget_range is '고객이 선택한 희망 예산 구간(선택)';
comment on column public.orders.desired_due_date is '고객이 입력한 희망 납기일(선택)';
comment on column public.orders.privacy_consented_at is '개인정보 수집 · 이용 동의 시각(제작 의뢰 양식 필수)';
comment on column public.orders.consult_status is
  '제작 상담 진행 상태: received(접수 완료) · consulting(상담 진행) · quote_sent(견적 전달) · contracted(계약 완료) · in_production(제작 진행) · completed(제작 완료) · not_contracted(계약 미성사)';
comment on column public.orders.inquiry_meta is '유입 정보(진입 CTA 위치, AI 디자인 첨부 여부, 품목 · 수량 선택값 등)';
comment on column public.orders.request_source is
  '제작 의뢰 유입 경로: ai_design · design_upload · ready_made_group_wear · production_inquiry(간편 제작 의뢰 양식)';

-- 기존 의뢰의 상담 상태를 기존 status 기준으로 채운다(한 번만, 이미 바뀐 값은 건드리지 않는다).
update public.orders
set consult_status = case status::text when 'approved' then 'consulting' when 'rejected' then 'not_contracted' else 'received' end
where consult_status = 'received' and status::text in ('approved', 'rejected');

create index if not exists orders_consult_status_created_idx on public.orders (consult_status, created_at desc);

-- consult_status ↔ status 동기화 + 고객이 직접 상담 상태를 바꾸지 못하게 막는다.
create or replace function public._orders_sync_consult_status()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_trusted boolean := coalesce(current_setting('brander.admin_rpc', true), '') = 'on'
    or coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if tg_op = 'INSERT' then
    if not v_trusted then new.consult_status := 'received'; end if;
    return new;
  end if;

  if new.consult_status is distinct from old.consult_status then
    if not v_trusted then
      new.consult_status := old.consult_status;
    else
      new.consult_status_updated_at := now();
    end if;
  elsif new.status is distinct from old.status then
    -- 기존 승인 · 반려 경로(기타 운영 도구 등)로 status 만 바뀐 경우 상담 상태를 맞춘다.
    new.consult_status := case new.status::text
      when 'pending' then 'received'
      when 'rejected' then 'not_contracted'
      when 'approved' then case when old.consult_status in ('received', 'not_contracted') then 'consulting' else old.consult_status end
      else old.consult_status
    end;
    if new.consult_status is distinct from old.consult_status then new.consult_status_updated_at := now(); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_sync_consult_status on public.orders;
create trigger orders_sync_consult_status
  before insert or update on public.orders
  for each row execute function public._orders_sync_consult_status();

-- ---------------------------------------------------------------------------
-- 2) 관리자 메모(내부용) — 고객의 orders 조회에 섞이지 않도록 분리
-- ---------------------------------------------------------------------------
create table if not exists public.production_request_notes (
  order_id uuid primary key references public.orders(id) on delete cascade,
  memo text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.production_request_notes enable row level security;
revoke all on table public.production_request_notes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) 관리자 목록 RPC(같은 이름 · 같은 인자). p_status 는 상담 상태 키 또는 'all'.
--    예전 값(pending/approved/rejected)도 계속 받는다.
-- ---------------------------------------------------------------------------
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
  v_status text := coalesce(p_status, 'all');
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_digits text := nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '');
begin
  return (
    with base as (
      select o.*,
        coalesce(nullif(btrim(o.contact_name), ''), nullif(btrim(pr.brand_name), ''), nullif(btrim(pr.full_name), ''),
          nullif(btrim(o.guest_name), ''), nullif(btrim(pr.username), '')) as customer_name,
        coalesce(nullif(btrim(o.contact_phone), ''), nullif(btrim(pr.phone_number), ''), nullif(btrim(o.guest_phone), '')) as customer_phone,
        u.email as customer_email,
        n.memo as admin_memo,
        n.updated_at as memo_updated_at
      from public.orders o
      left join public.profiles pr on pr.id = o.user_id
      left join auth.users u on u.id = o.user_id
      left join public.production_request_notes n on n.order_id = o.id
      where o.status::text not in ('draft', 'deleted')
        and (coalesce(p_source, 'all') = 'all' or o.request_source = p_source)
        and (v_search is null
          or o.id::text ilike v_search || '%'
          or o.request_title ilike '%' || v_search || '%'
          or o.cloth_type ilike '%' || v_search || '%'
          or o.detail_description ilike '%' || v_search || '%'
          or o.guest_name ilike '%' || v_search || '%'
          or o.contact_name ilike '%' || v_search || '%'
          or pr.full_name ilike '%' || v_search || '%'
          or pr.brand_name ilike '%' || v_search || '%'
          or (v_pii and u.email ilike '%' || v_search || '%')
          or (v_pii and v_digits is not null and char_length(v_digits) >= 4 and (
            regexp_replace(coalesce(pr.phone_number, ''), '\D', '', 'g') like '%' || v_digits || '%'
            or regexp_replace(coalesce(o.contact_phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
            or regexp_replace(coalesce(o.guest_phone, ''), '\D', '', 'g') like '%' || v_digits || '%')))
    ),
    filtered as (
      select * from base
      where v_status = 'all'
        or consult_status = v_status
        or (v_status in ('pending', 'approved', 'rejected') and status::text = v_status)
    ),
    page as (select * from filtered order by created_at desc limit v_limit offset v_offset)
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', (
        select jsonb_build_object(
          'all', count(*),
          'received', count(*) filter (where consult_status = 'received'),
          'consulting', count(*) filter (where consult_status = 'consulting'),
          'quote_sent', count(*) filter (where consult_status = 'quote_sent'),
          'contracted', count(*) filter (where consult_status = 'contracted'),
          'in_production', count(*) filter (where consult_status = 'in_production'),
          'completed', count(*) filter (where consult_status = 'completed'),
          'not_contracted', count(*) filter (where consult_status = 'not_contracted'),
          -- 예전 화면 호환
          'pending', count(*) filter (where status::text = 'pending'),
          'approved', count(*) filter (where status::text = 'approved'),
          'rejected', count(*) filter (where status::text = 'rejected')
        ) from base
      ),
      'can_manage', public._admin_has_permission(v_actor, 'orders.manage'),
      'can_view_pii', v_pii,
      'rows', coalesce((
        select jsonb_agg(
          (to_jsonb(p) - 'customer_name' - 'customer_phone' - 'customer_email' - 'guest_phone' - 'guest_name'
            - 'contact_name' - 'contact_phone')
          || jsonb_build_object(
            'customer_name', case when v_pii then p.customer_name else public._mask_name(p.customer_name) end,
            'customer_phone', case when v_pii then p.customer_phone else public._mask_phone(p.customer_phone) end,
            'customer_email', case when v_pii then p.customer_email else null end,
            'guest_name', case when v_pii then p.guest_name else public._mask_name(p.guest_name) end,
            'guest_phone', case when v_pii then p.guest_phone else public._mask_phone(p.guest_phone) end,
            'contact_name', case when v_pii then p.contact_name else public._mask_name(p.contact_name) end,
            'contact_phone', case when v_pii then p.contact_phone else public._mask_phone(p.contact_phone) end,
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

-- ---------------------------------------------------------------------------
-- 4) 상담 상태 · 관리자 메모 저장 RPC (orders.manage). 상태와 메모는 따로 또는 함께 바꿀 수 있다.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_production_request(
  p_order_id uuid,
  p_consult_status text default null,
  p_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.manage');
  v_row public.orders%rowtype;
  v_old_memo text;
  v_next text := nullif(btrim(coalesce(p_consult_status, '')), '');
  v_status text;
begin
  if v_next is not null and v_next not in ('received', 'consulting', 'quote_sent', 'contracted', 'in_production', 'completed', 'not_contracted') then
    raise exception '알 수 없는 상담 상태입니다.';
  end if;
  if char_length(coalesce(p_memo, '')) > 5000 then
    raise exception '관리자 메모는 5000자까지 입력할 수 있습니다.';
  end if;

  select * into v_row from public.orders where id = p_order_id for update;
  if not found or v_row.status::text in ('draft', 'deleted') then
    raise exception '제작 의뢰를 찾을 수 없습니다.';
  end if;
  select memo into v_old_memo from public.production_request_notes where order_id = p_order_id;

  perform set_config('brander.admin_rpc', 'on', true);

  if v_next is not null and v_next is distinct from v_row.consult_status then
    v_status := case v_next when 'received' then 'pending' when 'not_contracted' then 'rejected' else 'approved' end;
    update public.orders
    set consult_status = v_next,
        status = v_status::public.order_status,
        reviewed_at = case when v_status = 'pending' then null else now() end,
        reviewed_by = case when v_status = 'pending' then null else v_actor end,
        updated_at = now()
    where id = p_order_id;
  end if;

  if p_memo is not null and p_memo is distinct from coalesce(v_old_memo, '') then
    insert into public.production_request_notes (order_id, memo, updated_by, updated_at)
    values (p_order_id, p_memo, v_actor, now())
    on conflict (order_id) do update set memo = excluded.memo, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  end if;

  perform public._admin_log(
    'production_request.update', 'order', p_order_id::text,
    coalesce(v_row.request_title, v_row.cloth_type),
    jsonb_build_object('consult_status', v_row.consult_status, 'memo_changed', false),
    jsonb_build_object('consult_status', coalesce(v_next, v_row.consult_status),
      'memo_changed', p_memo is not null and p_memo is distinct from coalesce(v_old_memo, '')),
    null,
    jsonb_build_object('request_source', v_row.request_source)
  );

  return jsonb_build_object('id', p_order_id, 'consult_status', coalesce(v_next, v_row.consult_status));
end;
$$;

revoke all on function public.admin_update_production_request(uuid, text, text) from public, anon;
grant execute on function public.admin_update_production_request(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) 전환 이벤트 허용 목록 확장 (기존 함수 본문 그대로 + 이벤트 추가)
--    ready_made_group_wear_submitted 는 클라이언트가 이미 보내고 있었지만 허용 목록에 없어 버려지던 이벤트다.
-- ---------------------------------------------------------------------------
create or replace function public.track_site_event(
  p_session_id uuid,
  p_visitor_id uuid,
  p_event_name text,
  p_path text default '/',
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_name text := left(trim(coalesce(p_event_name, '')), 80);
  v_path text := left(coalesce(nullif(trim(p_path), ''), '/'), 300);
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_allowed_events text[] := array[
    'design_generated',
    'design_modified',
    'funding_draft_created',
    'production_request_submitted',
    'design_quote_submitted',
    'fabric_swatch_submitted',
    'funding_checkout_started',
    'ready_made_group_wear_submitted',
    'production_cta_clicked',
    'ai_result_production_cta_clicked',
    'production_form_viewed',
    'production_inquiry_submitted'
  ];
begin
  if p_session_id is null
    or p_visitor_id is null
    or not (v_event_name = any(v_allowed_events)) then
    return;
  end if;

  if v_user_id is not null and public.is_admin(v_user_id) then
    return;
  end if;

  if octet_length(v_metadata::text) > 2000 then
    v_metadata := '{}'::jsonb;
  end if;

  if not exists (
    select 1
    from public.site_visit_sessions session
    where session.session_id = p_session_id
      and session.visitor_id = p_visitor_id
  ) then
    return;
  end if;

  insert into public.site_visit_events (
    session_id,
    visitor_id,
    user_id,
    event_name,
    path,
    metadata
  ) values (
    p_session_id,
    p_visitor_id,
    v_user_id,
    v_event_name,
    v_path,
    v_metadata
  );

  update public.site_visit_sessions
  set
    user_id = coalesce(v_user_id, user_id),
    last_seen_at = now(),
    last_path = v_path,
    last_event_name = v_event_name
  where session_id = p_session_id
    and visitor_id = p_visitor_id;
end;
$$;

revoke all on function public.track_site_event(uuid, uuid, text, text, jsonb) from public;
grant execute on function public.track_site_event(uuid, uuid, text, text, jsonb) to anon, authenticated;

create index if not exists site_visit_events_name_created_idx
  on public.site_visit_events (event_name, created_at desc);

-- ---------------------------------------------------------------------------
-- 6) 제작 의뢰 전환 통계 (analytics.view 또는 orders.view)
--    * funnel: 방문 세션 → CTA 클릭 세션 → 양식 진입 세션 → 제출 세션
--    * by_entry: 유입(랜딩) 페이지별 세션 · 제출 세션 · 전환율
--    * by_cta: CTA 위치별 클릭 수 · 클릭 세션 중 제출 세션
--    * consult: 기간 내 접수된 의뢰의 상담 상태 분포(계약 전환율 계산용)
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_production_conversion(
  p_from timestamptz default now() - interval '30 days',
  p_to timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
begin
  if v_actor is null or not (public._admin_has_permission(v_actor, 'analytics.view') or public._admin_has_permission(v_actor, 'orders.view')) then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;

  return (
    with sessions as (
      select s.session_id, s.entry_path
      from public.site_visit_sessions s
      where s.started_at >= v_from and s.started_at < v_to
    ),
    events as (
      select e.session_id, e.event_name, e.path, e.metadata
      from public.site_visit_events e
      where e.created_at >= v_from and e.created_at < v_to
        and e.event_name in ('production_cta_clicked', 'ai_result_production_cta_clicked', 'production_form_viewed',
          'production_inquiry_submitted', 'production_request_submitted', 'design_quote_submitted', 'ready_made_group_wear_submitted')
    ),
    flags as (
      select s.session_id, s.entry_path,
        bool_or(e.event_name in ('production_cta_clicked', 'ai_result_production_cta_clicked')) as clicked,
        bool_or(e.event_name = 'ai_result_production_cta_clicked') as ai_clicked,
        bool_or(e.event_name = 'production_form_viewed') as viewed,
        bool_or(e.event_name = 'production_inquiry_submitted') as submitted,
        bool_or(e.event_name in ('production_inquiry_submitted', 'production_request_submitted', 'design_quote_submitted', 'ready_made_group_wear_submitted')) as any_submitted
      from sessions s
      left join events e on e.session_id = s.session_id
      group by s.session_id, s.entry_path
    ),
    inquiries as (
      select o.consult_status, o.request_source
      from public.orders o
      where o.created_at >= v_from and o.created_at < v_to and o.status::text not in ('draft', 'deleted')
    )
    select jsonb_build_object(
      'from', v_from,
      'to', v_to,
      'funnel', (
        select jsonb_build_object(
          'sessions', count(*),
          'cta_sessions', count(*) filter (where clicked),
          'ai_cta_sessions', count(*) filter (where ai_clicked),
          'form_sessions', count(*) filter (where viewed),
          'submit_sessions', count(*) filter (where submitted),
          'any_submit_sessions', count(*) filter (where any_submitted)
        ) from flags
      ),
      'events', (
        select jsonb_build_object(
          'cta_clicks', count(*) filter (where event_name = 'production_cta_clicked'),
          'ai_cta_clicks', count(*) filter (where event_name = 'ai_result_production_cta_clicked'),
          'form_views', count(*) filter (where event_name = 'production_form_viewed'),
          'submits', count(*) filter (where event_name = 'production_inquiry_submitted')
        ) from events
      ),
      'by_entry', coalesce((
        select jsonb_agg(row_to_json(r) order by r.sessions desc)
        from (
          select coalesce(nullif(entry_path, ''), '/') as entry_path,
            count(*) as sessions,
            count(*) filter (where clicked) as cta_sessions,
            count(*) filter (where viewed) as form_sessions,
            count(*) filter (where submitted) as submit_sessions,
            round(100.0 * count(*) filter (where submitted) / nullif(count(*), 0), 2) as conversion_rate
          from flags
          group by coalesce(nullif(entry_path, ''), '/')
          order by count(*) desc
          limit 15
        ) r
      ), '[]'::jsonb),
      'by_cta', coalesce((
        select jsonb_agg(row_to_json(r) order by r.clicks desc)
        from (
          select coalesce(nullif(e.metadata ->> 'source', ''), case when e.event_name = 'ai_result_production_cta_clicked' then 'ai_result' else 'unknown' end) as source,
            count(*) as clicks,
            count(distinct e.session_id) as sessions,
            count(distinct e.session_id) filter (where f.submitted) as submit_sessions,
            round(100.0 * count(distinct e.session_id) filter (where f.submitted) / nullif(count(distinct e.session_id), 0), 2) as conversion_rate
          from events e
          join flags f on f.session_id = e.session_id
          where e.event_name in ('production_cta_clicked', 'ai_result_production_cta_clicked')
          group by 1
          order by count(*) desc
          limit 20
        ) r
      ), '[]'::jsonb),
      'by_form_source', coalesce((
        select jsonb_agg(row_to_json(r) order by r.submits desc)
        from (
          select coalesce(nullif(e.metadata ->> 'from', ''), 'direct') as source,
            count(*) filter (where e.event_name = 'production_form_viewed') as views,
            count(*) filter (where e.event_name = 'production_inquiry_submitted') as submits,
            round(100.0 * count(*) filter (where e.event_name = 'production_inquiry_submitted')
              / nullif(count(*) filter (where e.event_name = 'production_form_viewed'), 0), 2) as conversion_rate
          from events e
          where e.event_name in ('production_form_viewed', 'production_inquiry_submitted')
          group by 1
          limit 20
        ) r
      ), '[]'::jsonb),
      'consult', (
        select jsonb_build_object(
          'requests', count(*),
          'inquiries', count(*) filter (where request_source = 'production_inquiry'),
          'received', count(*) filter (where consult_status = 'received'),
          'consulting', count(*) filter (where consult_status = 'consulting'),
          'quote_sent', count(*) filter (where consult_status = 'quote_sent'),
          'contracted', count(*) filter (where consult_status = 'contracted'),
          'in_production', count(*) filter (where consult_status = 'in_production'),
          'completed', count(*) filter (where consult_status = 'completed'),
          'not_contracted', count(*) filter (where consult_status = 'not_contracted'),
          'contract_rate', round(100.0 * count(*) filter (where consult_status in ('contracted', 'in_production', 'completed')) / nullif(count(*), 0), 2)
        ) from inquiries
      )
    )
  );
end;
$$;

revoke all on function public.admin_get_production_conversion(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_get_production_conversion(timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
