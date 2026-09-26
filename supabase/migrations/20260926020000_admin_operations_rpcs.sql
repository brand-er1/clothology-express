-- BRAND-ER 관리자 백엔드 RPC
-- 모든 admin_* 함수는 SECURITY DEFINER 이며 첫 줄에서 _admin_require(권한) 로 서버측 권한을 검증한다.
-- 프런트엔드 메뉴 숨김과 무관하게 권한이 없는 호출은 42501 로 거부된다.

-- ---------------------------------------------------------------------------
-- 0. 공통 헬퍼
-- ---------------------------------------------------------------------------

create or replace function public._kst_date(p_ts timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_ts at time zone 'Asia/Seoul')::date;
$$;

create or replace function public._mask_phone(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or btrim(p_value) = '' then p_value
    when char_length(regexp_replace(p_value, '\D', '', 'g')) >= 8 then
      left(regexp_replace(p_value, '\D', '', 'g'), 3) || '-****-' || right(regexp_replace(p_value, '\D', '', 'g'), 4)
    else '****'
  end;
$$;

create or replace function public._mask_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or btrim(p_value) = '' then p_value
    when char_length(btrim(p_value)) = 1 then '*'
    else left(btrim(p_value), 1) || repeat('*', char_length(btrim(p_value)) - 1)
  end;
$$;

create or replace function public._mask_address(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or btrim(p_value) = '' then p_value
    else array_to_string((string_to_array(btrim(p_value), ' '))[1:2], ' ') || ' ***'
  end;
$$;

create or replace function public._funding_end_at(p_reviewed_at timestamptz, p_funding_days integer)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case when p_reviewed_at is null then null
    else p_reviewed_at + make_interval(days => coalesce(p_funding_days, 0)) end;
$$;

-- 펀딩 운영 단계(관리자 화면 표시용). 기존 status 컬럼은 그대로 두고 파생값으로 계산한다.
create or replace function public._funding_phase(
  p_status text,
  p_is_hidden boolean,
  p_suspended_at timestamptz,
  p_reviewed_at timestamptz,
  p_funding_days integer,
  p_current_orders integer,
  p_moq integer,
  p_production_status text
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_status = 'draft' then 'draft'
    when p_status = 'pending' then 'pending'
    when p_status = 'rejected' then 'rejected'
    when p_suspended_at is not null then 'suspended'
    when p_production_status = 'delivered' then 'completed'
    when p_production_status = 'shipping' then 'shipping'
    when p_production_status is not null and p_production_status <> 'funding_success' then 'in_production'
    when p_status = 'approved' and p_is_hidden then 'approved'
    when p_status = 'approved'
      and (p_reviewed_at is null or now() < p_reviewed_at + make_interval(days => coalesce(p_funding_days, 0)))
      then 'funding'
    when coalesce(p_current_orders, 0) >= coalesce(p_moq, 1) then 'succeeded'
    else 'failed'
  end;
$$;

-- 주문(펀딩 참여) 처리 상태(관리자 필터용 파생값).
create or replace function public._order_state(
  p_status text,
  p_payment_status text,
  p_payment_approved_at timestamptz,
  p_production_stage text,
  p_shipping_status text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_status = 'cancelled' and p_payment_approved_at is not null then 'refunded'
    when p_status = 'cancelled' or p_payment_status = 'cancelled' then 'cancelled'
    when p_payment_status in ('unpaid', 'ready', 'failed') then 'payment_pending'
    when p_shipping_status = 'delivered' then 'delivered'
    when p_shipping_status = 'shipped' then 'shipping'
    when p_production_stage = 'shipping_ready' then 'ready_to_ship'
    when p_production_stage in ('fabric_sourcing', 'sampling', 'production', 'inspection_packing') then 'in_production'
    else 'paid'
  end;
$$;

create or replace function public._production_stage_rank(p_stage text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_position(array[
    'funding_success', 'fabric_contact', 'pattern_sample', 'sample_review',
    'mass_production', 'inspection_packing', 'shipping_ready', 'shipping', 'delivered'
  ], p_stage), 0);
$$;

-- 펀딩 단위 제작 단계 → 기존 참여 건 production_stage(구매자 화면) 매핑.
create or replace function public._production_stage_to_participation(p_stage text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'funding_success' then 'funding'
    when 'fabric_contact' then 'fabric_sourcing'
    when 'pattern_sample' then 'sampling'
    when 'sample_review' then 'sampling'
    when 'mass_production' then 'production'
    when 'inspection_packing' then 'inspection_packing'
    when 'shipping_ready' then 'shipping_ready'
    when 'shipping' then 'shipping_ready'
    when 'delivered' then 'delivered'
  end;
$$;

create or replace function public._production_stage_label(p_stage text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'funding_success' then '펀딩 성공'
    when 'fabric_contact' then '원단 컨택'
    when 'pattern_sample' then '패턴/샘플 제작'
    when 'sample_review' then '샘플 확인'
    when 'mass_production' then '본생산'
    when 'inspection_packing' then '검수/포장'
    when 'shipping_ready' then '배송 준비'
    when 'shipping' then '배송중'
    when 'delivered' then '배송완료'
    else coalesce(p_stage, '-')
  end;
$$;

create or replace function public._admin_notify(
  p_recipient_id uuid,
  p_message text,
  p_funding_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_id is null then
    return;
  end if;
  insert into public.community_notifications (recipient_id, actor_id, type, funding_id, message)
  values (p_recipient_id, auth.uid(), 'admin_notice', p_funding_id, left(p_message, 1000));
end;
$$;

revoke all on function public._admin_notify(uuid, text, uuid) from public, anon, authenticated;

create or replace function public._require_reason(p_reason text, p_label text default '사유')
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) < 2 or char_length(v_reason) > 1000 then
    raise exception '%를 2자 이상 1000자 이하로 입력해주세요.', p_label;
  end if;
  return v_reason;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. 대시보드
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_dashboard(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('dashboard.view');
  v_finance boolean := public._admin_has_permission(v_actor, 'finance.view');
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  v_today timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  v_rate numeric := public._platform_setting_numeric('platform_commission_rate', 10);
  v_counts jsonb;
  v_money jsonb;
  v_series jsonb;
  v_visitors bigint;
  v_buyers bigint;
  v_succeeded bigint;
  v_failed bigint;
begin
  if v_to <= v_from then
    raise exception '조회 기간이 올바르지 않습니다.';
  end if;

  select
    count(*) filter (where phase = 'succeeded' or phase in ('in_production', 'shipping', 'completed')),
    count(*) filter (where phase in ('failed', 'suspended'))
  into v_succeeded, v_failed
  from (
    select public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days,
      f.current_orders, f.moq, f.production_status) as phase
    from public.fundings f
  ) phases;

  select count(distinct s.visitor_id) into v_visitors
  from public.site_visit_sessions s
  where s.last_seen_at >= v_from and s.started_at < v_to;

  select count(distinct fp.participant_id) into v_buyers
  from public.funding_participations fp
  where fp.payment_approved_at >= v_from and fp.payment_approved_at < v_to;

  v_counts := jsonb_build_object(
    'members', (select count(*) from auth.users u where public._admin_role_of(u.id) is null),
    'creators', (select count(*) from public.creator_profiles),
    'brands', (select count(*) from public.brands),
    'fundings_active', (
      select count(*) from public.fundings f
      where f.status = 'approved' and f.suspended_at is null and f.is_hidden = false
        and (f.reviewed_at is null or now() < public._funding_end_at(f.reviewed_at, f.funding_days))
    ),
    'fundings_pending', (select count(*) from public.fundings where status = 'pending'),
    'fundings_succeeded', v_succeeded,
    'fundings_failed', v_failed,
    'participants', (
      select count(distinct participant_id) from public.funding_participations
      where payment_status = 'paid' and status <> 'cancelled'
    ),
    'orders', (select count(*) from public.funding_participations where payment_approved_at is not null),
    'orders_in_period', (
      select count(*) from public.funding_participations
      where payment_approved_at >= v_from and payment_approved_at < v_to
    ),
    'today_signups', (select count(*) from auth.users where created_at >= v_today),
    'today_orders', (select count(*) from public.funding_participations where payment_approved_at >= v_today),
    'signups_in_period', (select count(*) from auth.users where created_at >= v_from and created_at < v_to),
    'mau', (
      select count(distinct s.visitor_id) from public.site_visit_sessions s
      where s.last_seen_at >= now() - interval '30 days'
    ),
    'period_visitors', v_visitors,
    'conversion_rate', case when v_visitors > 0 then round(v_buyers::numeric * 100 / v_visitors, 2) else null end,
    'funding_success_rate', case when v_succeeded + v_failed > 0
      then round(v_succeeded::numeric * 100 / (v_succeeded + v_failed), 1) else null end,
    'pending_refunds', (select count(*) from public.refund_requests where status in ('requested', 'reviewing', 'approved', 'processing')),
    'open_cs_tickets', (select count(*) from public.cs_tickets where status in ('open', 'in_progress', 'waiting_customer')),
    'pending_reports', (select count(*) from public.community_reports where status = 'pending'),
    'pending_brands', (select count(*) from public.brands where review_status = 'pending')
  );

  if v_finance then
    select jsonb_build_object(
      'commission_rate', v_rate,
      'gmv', coalesce(sum(fp.total_amount) filter (where fp.payment_approved_at >= v_from and fp.payment_approved_at < v_to), 0),
      'gmv_mock', coalesce(sum(fp.total_amount) filter (where fp.payment_provider = 'mock' and fp.payment_approved_at >= v_from and fp.payment_approved_at < v_to), 0),
      'gmv_real', coalesce(sum(fp.total_amount) filter (where fp.payment_provider <> 'mock' and fp.payment_approved_at >= v_from and fp.payment_approved_at < v_to), 0),
      'refunds', coalesce(sum(fp.total_amount) filter (
        where fp.payment_status = 'cancelled' and fp.payment_cancelled_at >= v_from and fp.payment_cancelled_at < v_to
      ), 0),
      'gmv_all_time', coalesce(sum(fp.total_amount), 0),
      'revenue_7d', coalesce(sum(fp.total_amount) filter (where fp.payment_approved_at >= now() - interval '7 days' and fp.payment_status = 'paid'), 0),
      'revenue_30d', coalesce(sum(fp.total_amount) filter (where fp.payment_approved_at >= now() - interval '30 days' and fp.payment_status = 'paid'), 0)
    )
    into v_money
    from public.funding_participations fp
    where fp.payment_approved_at is not null;

    v_money := v_money || jsonb_build_object(
      'net_sales', (v_money ->> 'gmv')::bigint - (v_money ->> 'refunds')::bigint,
      'platform_fee', round(((v_money ->> 'gmv')::bigint - (v_money ->> 'refunds')::bigint) * v_rate / 100),
      'settlement_scheduled', (select coalesce(sum(final_amount), 0) from public.settlements where status in ('pending', 'scheduled')),
      'settlement_completed', (select coalesce(sum(final_amount), 0) from public.settlements where status = 'completed'),
      'settled_platform_fee', (select coalesce(sum(platform_fee), 0) from public.settlements where status = 'completed')
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(d.day, 'YYYY-MM-DD'),
    'signups', (select count(*) from auth.users u where public._kst_date(u.created_at) = d.day),
    'orders', (select count(*) from public.funding_participations fp where public._kst_date(fp.payment_approved_at) = d.day),
    'gmv', case when v_finance then (
      select coalesce(sum(fp.total_amount), 0) from public.funding_participations fp
      where public._kst_date(fp.payment_approved_at) = d.day
    ) end,
    'refunds', case when v_finance then (
      select coalesce(sum(fp.total_amount), 0) from public.funding_participations fp
      where fp.payment_status = 'cancelled' and public._kst_date(fp.payment_cancelled_at) = d.day
    ) end,
    'visitors', (select count(distinct s.visitor_id) from public.site_visit_sessions s where public._kst_date(s.started_at) = d.day)
  ) order by d.day), '[]'::jsonb)
  into v_series
  from generate_series(public._kst_date(v_from), public._kst_date(v_to - interval '1 second'), interval '1 day') as d(day);

  return jsonb_build_object(
    'from', v_from, 'to', v_to,
    'finance_visible', v_finance,
    'counts', v_counts,
    'money', v_money,
    'series', v_series,
    'phase_breakdown', (
      select coalesce(jsonb_object_agg(phase, cnt), '{}'::jsonb) from (
        select public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days,
          f.current_orders, f.moq, f.production_status) as phase, count(*) as cnt
        from public.fundings f group by 1
      ) x
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. 회원 관리
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_members(
  p_search text default null,
  p_filter text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  username text,
  email text,
  created_at timestamptz,
  last_active_at timestamptz,
  account_type text,
  is_creator boolean,
  brand_id uuid,
  brand_name text,
  participated_fundings integer,
  created_fundings integer,
  order_count integer,
  order_amount bigint,
  account_status text,
  admin_role text,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('members.view');
  return query
  with base as (
    select
      u.id,
      p.full_name,
      p.username,
      u.email::text as email,
      u.created_at,
      greatest(u.last_sign_in_at, (select max(s.last_seen_at) from public.site_visit_sessions s where s.user_id = u.id)) as last_active_at,
      coalesce(p.account_type, case when u.raw_user_meta_data ->> 'account_type' = 'buyer' then 'buyer' else 'seller' end) as account_type,
      (exists (select 1 from public.creator_profiles c where c.user_id = u.id)
        or exists (select 1 from public.brands b where b.owner_user_id = u.id)) as is_creator,
      b.id as brand_id,
      coalesce(b.brand_name, nullif(p.brand_name, '')) as brand_name,
      coalesce(p.account_status, 'active') as account_status,
      public._admin_role_of(u.id) as admin_role
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.brands b on b.owner_user_id = u.id
  ), filtered as (
    select * from base
    where (
      v_search is null
      or base.full_name ilike '%' || v_search || '%'
      or base.username ilike '%' || v_search || '%'
      or base.email ilike '%' || v_search || '%'
      or base.brand_name ilike '%' || v_search || '%'
      or base.id::text = v_search
    )
    and (
      coalesce(p_filter, 'all') = 'all'
      or (p_filter = 'buyer' and not base.is_creator)
      or (p_filter = 'creator' and base.is_creator)
      or (p_filter = 'suspended' and base.account_status <> 'active')
      or (p_filter = 'staff' and base.admin_role is not null)
    )
  )
  select
    f.id, f.full_name, f.username, f.email, f.created_at, f.last_active_at, f.account_type, f.is_creator,
    f.brand_id, f.brand_name,
    (select count(distinct fp.funding_id)::integer from public.funding_participations fp where fp.participant_id = f.id),
    (select count(*)::integer from public.fundings fu where fu.creator_id = f.id),
    (select count(*)::integer from public.funding_participations fp where fp.participant_id = f.id and fp.payment_approved_at is not null),
    (select coalesce(sum(fp.total_amount), 0)::bigint from public.funding_participations fp
      where fp.participant_id = f.id and fp.payment_status = 'paid' and fp.status <> 'cancelled'),
    f.account_status, f.admin_role,
    count(*) over ()
  from filtered f
  order by f.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_get_member_detail(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('members.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'members.pii');
  v_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
begin
  select * into v_user from auth.users where id = p_user_id;
  if not found then
    raise exception '회원을 찾을 수 없습니다.';
  end if;
  select * into v_profile from public.profiles where id = p_user_id;

  -- 비밀번호/해시/토큰 등 인증 비밀값은 절대 반환하지 않는다.
  return jsonb_build_object(
    'id', v_user.id,
    'email', v_user.email,
    'created_at', v_user.created_at,
    'last_sign_in_at', v_user.last_sign_in_at,
    'banned_until', v_user.banned_until,
    'full_name', v_profile.full_name,
    'username', v_profile.username,
    'phone_number', case when v_pii then v_profile.phone_number else public._mask_phone(v_profile.phone_number) end,
    'address', case when v_pii then v_profile.address else public._mask_address(v_profile.address) end,
    'pii_visible', v_pii,
    'gender', v_profile.gender,
    'avatar_url', v_profile.avatar_url,
    'bio', v_profile.bio,
    'account_type', coalesce(v_profile.account_type, 'seller'),
    'account_status', coalesce(v_profile.account_status, 'active'),
    'account_status_reason', v_profile.account_status_reason,
    'account_status_changed_at', v_profile.account_status_changed_at,
    'creator_approved_at', v_profile.creator_approved_at,
    'admin_role', public._admin_role_of(p_user_id),
    'last_active_at', (select max(s.last_seen_at) from public.site_visit_sessions s where s.user_id = p_user_id),
    'creator_profile', (select to_jsonb(c) from public.creator_profiles c where c.user_id = p_user_id),
    'brand', (select to_jsonb(b) - 'normalized_brand_name' from public.brands b where b.owner_user_id = p_user_id),
    'fundings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'product_name', f.product_name, 'status', f.status, 'image_url', f.image_url,
        'phase', public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days, f.current_orders, f.moq, f.production_status),
        'current_orders', f.current_orders, 'moq', f.moq, 'created_at', f.created_at
      ) order by f.created_at desc)
      from public.fundings f where f.creator_id = p_user_id
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fp.id, 'order_number', fp.partner_order_id, 'funding_id', fp.funding_id,
        'product_name', f.product_name, 'quantity', fp.quantity, 'total_amount', fp.total_amount,
        'payment_provider', fp.payment_provider, 'payment_status', fp.payment_status,
        'order_state', public._order_state(fp.status, fp.payment_status, fp.payment_approved_at, fp.production_stage, fp.shipping_status),
        'created_at', fp.created_at
      ) order by fp.created_at desc)
      from public.funding_participations fp
      join public.fundings f on f.id = fp.funding_id
      where fp.participant_id = p_user_id
    ), '[]'::jsonb),
    'status_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', l.action, 'admin_name', l.admin_name, 'reason', l.reason, 'after', l.after_data, 'created_at', l.created_at
      ) order by l.created_at desc)
      from public.admin_audit_logs l
      where l.target_type = 'member' and l.target_id = p_user_id::text
    ), '[]'::jsonb),
    'cs_tickets', (select count(*) from public.cs_tickets t where t.user_id = p_user_id)
  );
end;
$$;

create or replace function public.admin_set_member_status(p_user_id uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('members.manage');
  v_reason text := public._require_reason(p_reason, '처리 사유');
  v_before jsonb;
  v_target_role text := public._admin_role_of(p_user_id);
  v_after jsonb;
begin
  if p_status not in ('active', 'restricted', 'suspended', 'archived') then
    raise exception '올바르지 않은 회원 상태입니다.';
  end if;
  if p_user_id = v_actor then
    raise exception '본인 계정의 상태는 변경할 수 없습니다.';
  end if;
  if v_target_role = 'super_admin' then
    raise exception 'Super Admin 계정은 회원 상태를 변경할 수 없습니다. 관리자 관리에서 권한을 먼저 회수해주세요.';
  end if;
  if v_target_role is not null and not public._admin_has_permission(v_actor, 'admins.manage') then
    raise exception '관리자 계정의 상태는 Super Admin 만 변경할 수 있습니다.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception '회원을 찾을 수 없습니다.';
  end if;

  insert into public.profiles (id) values (p_user_id) on conflict (id) do nothing;

  select jsonb_build_object('account_status', account_status, 'reason', account_status_reason)
  into v_before from public.profiles where id = p_user_id for update;

  update public.profiles
  set account_status = p_status,
      account_status_reason = v_reason,
      account_status_changed_at = now(),
      account_status_changed_by = v_actor,
      updated_at = now()
  where id = p_user_id;

  v_after := jsonb_build_object('account_status', p_status, 'reason', v_reason);

  perform public._admin_log(
    case p_status when 'active' then 'member.reactivate' when 'restricted' then 'member.restrict'
      when 'suspended' then 'member.suspend' else 'member.archive' end,
    'member', p_user_id::text, public._admin_display_name(p_user_id), v_before, v_after, v_reason
  );

  if p_status <> 'active' then
    perform public._admin_notify(p_user_id, case p_status
      when 'restricted' then '[이용 제한 안내] 운영 정책에 따라 일부 기능 이용이 제한되었습니다. 사유: ' || v_reason
      when 'suspended' then '[계정 정지 안내] 운영 정책에 따라 계정이 정지되었습니다. 사유: ' || v_reason
      else '[계정 보관 안내] 계정이 보관 처리되었습니다. 사유: ' || v_reason end);
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'account_status', p_status,
    -- Edge Function(admin-manage-user)이 Supabase Auth 로그인 차단 여부를 결정할 때 사용
    'auth_ban', p_status in ('suspended', 'archived')
  );
end;
$$;

create or replace function public.admin_approve_creator(p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('members.manage');
  v_reason text := public._require_reason(p_reason, '승인 메모');
  v_before text;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception '회원을 찾을 수 없습니다.';
  end if;
  insert into public.profiles (id) values (p_user_id) on conflict (id) do nothing;
  select account_type into v_before from public.profiles where id = p_user_id for update;

  update public.profiles
  set account_type = 'seller',
      creator_approved_at = now(),
      creator_approved_by = v_actor,
      updated_at = now()
  where id = p_user_id;

  perform public._admin_log('member.creator_approve', 'member', p_user_id::text, public._admin_display_name(p_user_id),
    jsonb_build_object('account_type', v_before), jsonb_build_object('account_type', 'seller'), v_reason);
  perform public._admin_notify(p_user_id, '[제작자 권한 승인] 이제 브랜드를 등록하고 펀딩을 개설할 수 있습니다.');

  return jsonb_build_object('user_id', p_user_id, 'account_type', 'seller', 'sync_auth_metadata', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 제작자 / 브랜드 관리
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_creators(p_search text default null)
returns table (
  user_id uuid,
  display_name text,
  profile_image_url text,
  bio text,
  email text,
  account_status text,
  brand_id uuid,
  brand_name text,
  brand_status text,
  brand_review_status text,
  instagram_url text,
  website_url text,
  created_at timestamptz,
  active_fundings integer,
  completed_fundings integer,
  total_fundings integer,
  total_participants integer,
  gmv bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('creators.view');
  return query
  select
    c.user_id, c.display_name, c.profile_image_url, c.bio, u.email::text,
    coalesce(p.account_status, 'active'),
    b.id, b.brand_name, b.status, b.review_status, b.instagram_url, b.website_url,
    c.created_at,
    (select count(*)::integer from public.fundings f where f.creator_id = c.user_id
      and public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days, f.current_orders, f.moq, f.production_status) in ('approved', 'funding')),
    (select count(*)::integer from public.fundings f where f.creator_id = c.user_id
      and public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days, f.current_orders, f.moq, f.production_status) in ('succeeded', 'in_production', 'shipping', 'completed', 'failed')),
    (select count(*)::integer from public.fundings f where f.creator_id = c.user_id),
    (select count(distinct fp.participant_id)::integer from public.funding_participations fp
      join public.fundings f on f.id = fp.funding_id
      where f.creator_id = c.user_id and fp.payment_status = 'paid' and fp.status <> 'cancelled'),
    (select coalesce(sum(fp.total_amount), 0)::bigint from public.funding_participations fp
      join public.fundings f on f.id = fp.funding_id
      where f.creator_id = c.user_id and fp.payment_status = 'paid' and fp.status <> 'cancelled')
  from public.creator_profiles c
  left join auth.users u on u.id = c.user_id
  left join public.profiles p on p.id = c.user_id
  left join public.brands b on b.owner_user_id = c.user_id
  where v_search is null
    or c.display_name ilike '%' || v_search || '%'
    or b.brand_name ilike '%' || v_search || '%'
    or u.email ilike '%' || v_search || '%'
  order by c.created_at desc;
end;
$$;

create or replace function public.admin_list_brands(p_search text default null, p_status text default 'all')
returns table (
  id uuid,
  brand_name text,
  brand_logo_url text,
  short_description text,
  description text,
  instagram_url text,
  website_url text,
  owner_user_id uuid,
  creator_name text,
  creator_image_url text,
  status text,
  review_status text,
  review_reason text,
  status_reason text,
  created_at timestamptz,
  funding_count integer,
  active_funding_count integer,
  follower_count integer,
  gmv bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('brands.view');
  return query
  select
    b.id, b.brand_name, b.brand_logo_url, b.short_description, b.description, b.instagram_url, b.website_url,
    b.owner_user_id, c.display_name, c.profile_image_url, b.status, b.review_status, b.review_reason, b.status_reason,
    b.created_at,
    (select count(*)::integer from public.fundings f where f.brand_id = b.id),
    (select count(*)::integer from public.fundings f where f.brand_id = b.id and f.status = 'approved' and f.suspended_at is null),
    (select count(*)::integer from public.community_follows cf where cf.following_id = b.owner_user_id),
    (select coalesce(sum(fp.total_amount), 0)::bigint from public.funding_participations fp
      join public.fundings f on f.id = fp.funding_id
      where f.brand_id = b.id and fp.payment_status = 'paid' and fp.status <> 'cancelled')
  from public.brands b
  left join public.creator_profiles c on c.user_id = b.creator_profile_user_id
  where (v_search is null or b.brand_name ilike '%' || v_search || '%' or c.display_name ilike '%' || v_search || '%')
    and (
      coalesce(p_status, 'all') = 'all'
      or (p_status = 'pending' and b.review_status = 'pending')
      or (p_status = 'rejected' and b.review_status = 'rejected')
      or (p_status = 'active' and b.status = 'active' and b.review_status <> 'rejected')
      or (p_status = 'suspended' and b.status = 'suspended')
    )
  order by b.created_at desc;
end;
$$;

create or replace function public.admin_moderate_brand(p_brand_id uuid, p_action text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('brands.manage');
  v_brand public.brands%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_after jsonb;
begin
  if p_action not in ('approve', 'reject', 'suspend', 'restore') then
    raise exception '올바르지 않은 브랜드 처리 유형입니다.';
  end if;
  if p_action in ('reject', 'suspend') then
    v_reason := public._require_reason(p_reason, case when p_action = 'reject' then '반려 사유' else '정지 사유' end);
  end if;

  select * into v_brand from public.brands where id = p_brand_id for update;
  if not found then
    raise exception '브랜드를 찾을 수 없습니다.';
  end if;

  if p_action = 'approve' then
    update public.brands
    set review_status = 'approved', review_reason = v_reason, reviewed_at = now(), reviewed_by = v_actor,
        status = case when v_brand.review_status = 'rejected' then 'active' else status end,
        status_changed_at = case when v_brand.review_status = 'rejected' then now() else status_changed_at end,
        status_changed_by = case when v_brand.review_status = 'rejected' then v_actor else status_changed_by end
    where id = p_brand_id;
  elsif p_action = 'reject' then
    update public.brands
    set review_status = 'rejected', review_reason = v_reason, reviewed_at = now(), reviewed_by = v_actor,
        status = 'suspended', status_reason = v_reason, status_changed_at = now(), status_changed_by = v_actor
    where id = p_brand_id;
  elsif p_action = 'suspend' then
    update public.brands
    set status = 'suspended', status_reason = v_reason, status_changed_at = now(), status_changed_by = v_actor
    where id = p_brand_id;
  else
    update public.brands
    set status = 'active', status_reason = v_reason, status_changed_at = now(), status_changed_by = v_actor,
        review_status = case when review_status = 'rejected' then 'approved' else review_status end
    where id = p_brand_id;
  end if;

  select jsonb_build_object('status', b.status, 'review_status', b.review_status) into v_after
  from public.brands b where b.id = p_brand_id;

  perform public._admin_log('brand.' || p_action, 'brand', p_brand_id::text, v_brand.brand_name,
    jsonb_build_object('status', v_brand.status, 'review_status', v_brand.review_status), v_after, v_reason);

  perform public._admin_notify(v_brand.owner_user_id, case p_action
    when 'approve' then format('[브랜드 승인] ''%s'' 브랜드가 승인되었습니다.', v_brand.brand_name)
    when 'reject' then format('[브랜드 반려] ''%s'' 브랜드가 반려되었습니다. 사유: %s', v_brand.brand_name, v_reason)
    when 'suspend' then format('[브랜드 정지] ''%s'' 브랜드가 정지되었습니다. 사유: %s', v_brand.brand_name, v_reason)
    else format('[브랜드 복구] ''%s'' 브랜드가 다시 활성화되었습니다.', v_brand.brand_name) end);

  return v_after;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 펀딩 관리
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_fundings(
  p_search text default null,
  p_phase text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  product_name text,
  image_url text,
  creator_id uuid,
  creator_name text,
  brand_id uuid,
  brand_name text,
  price integer,
  moq integer,
  current_orders integer,
  achievement_rate numeric,
  gmv bigint,
  participant_count integer,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  phase text,
  is_hidden boolean,
  suspended_at timestamptz,
  suspension_reason text,
  production_status text,
  admin_comment text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('fundings.view');
  return query
  with base as (
    select
      f.*,
      coalesce(c.display_name, nullif(p.username, ''), nullif(p.full_name, ''), '제작자') as creator_name_v,
      b.brand_name as brand_name_v,
      public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days,
        f.current_orders, f.moq, f.production_status) as phase_v
    from public.fundings f
    left join public.creator_profiles c on c.user_id = f.creator_id
    left join public.profiles p on p.id = f.creator_id
    left join public.brands b on b.id = f.brand_id
  )
  select
    x.id, x.product_name, x.image_url, x.creator_id, x.creator_name_v, x.brand_id, x.brand_name_v,
    x.price, x.moq, x.current_orders,
    case when x.moq > 0 then round(x.current_orders::numeric * 100 / x.moq, 1) else 0 end,
    (select coalesce(sum(fp.total_amount), 0)::bigint from public.funding_participations fp
      where fp.funding_id = x.id and fp.payment_status = 'paid' and fp.status <> 'cancelled'),
    (select count(distinct fp.participant_id)::integer from public.funding_participations fp
      where fp.funding_id = x.id and fp.payment_status = 'paid' and fp.status <> 'cancelled'),
    x.reviewed_at,
    public._funding_end_at(x.reviewed_at, x.funding_days),
    x.status, x.phase_v, x.is_hidden, x.suspended_at, x.suspension_reason, x.production_status, x.admin_comment,
    x.created_at,
    count(*) over ()
  from base x
  where (v_search is null
      or x.product_name ilike '%' || v_search || '%'
      or x.creator_name_v ilike '%' || v_search || '%'
      or x.brand_name_v ilike '%' || v_search || '%'
      or x.id::text = v_search)
    and (coalesce(p_phase, 'all') = 'all' or x.phase_v = p_phase)
  order by case when x.status = 'pending' then 0 else 1 end, x.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_get_funding_detail(p_funding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('fundings.view');
  v_f public.fundings%rowtype;
begin
  select * into v_f from public.fundings where id = p_funding_id;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;

  return jsonb_build_object(
    'funding', to_jsonb(v_f),
    'phase', public._funding_phase(v_f.status, v_f.is_hidden, v_f.suspended_at, v_f.reviewed_at, v_f.funding_days, v_f.current_orders, v_f.moq, v_f.production_status),
    'end_at', public._funding_end_at(v_f.reviewed_at, v_f.funding_days),
    'creator', (select to_jsonb(c) from public.creator_profiles c where c.user_id = v_f.creator_id),
    'creator_email', (select email from auth.users where id = v_f.creator_id),
    'brand', (select to_jsonb(b) - 'normalized_brand_name' from public.brands b where b.id = v_f.brand_id),
    'trademark', (select jsonb_build_object('decision', t.decision, 'reason', t.reason) from public.trademark_screenings t where t.id = v_f.trademark_screening_id),
    'metrics', (
      select jsonb_build_object(
        'paid_orders', count(*) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled'),
        'participants', count(distinct fp.participant_id) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled'),
        'quantity', coalesce(sum(fp.quantity) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0),
        'gmv', coalesce(sum(fp.total_amount) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0),
        'mock_amount', coalesce(sum(fp.total_amount) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.payment_provider = 'mock'), 0),
        'refunded_amount', coalesce(sum(fp.total_amount) filter (where fp.payment_status = 'cancelled' and fp.payment_approved_at is not null), 0),
        'cancelled_orders', count(*) filter (where fp.status = 'cancelled'),
        'shipped', count(*) filter (where fp.shipping_status = 'shipped' and fp.status <> 'cancelled'),
        'delivered', count(*) filter (where fp.shipping_status = 'delivered' and fp.status <> 'cancelled')
      )
      from public.funding_participations fp where fp.funding_id = p_funding_id
    ),
    'production_logs', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from public.funding_production_logs l where l.funding_id = p_funding_id
    ), '[]'::jsonb),
    'settlement', (select to_jsonb(s) from public.settlements s where s.funding_id = p_funding_id),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('action', l.action, 'admin_name', l.admin_name, 'reason', l.reason, 'created_at', l.created_at) order by l.created_at desc)
      from public.admin_audit_logs l where l.target_type = 'funding' and l.target_id = p_funding_id::text
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_review_funding(
  p_funding_id uuid,
  p_decision text,
  p_reason text default null,
  p_moq integer default null,
  p_price integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('fundings.manage');
  v_f public.fundings%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_after public.fundings%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception '승인 또는 반려만 선택할 수 있습니다.';
  end if;
  if p_decision = 'rejected' then
    v_reason := public._require_reason(p_reason, '반려 사유');
  end if;

  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if v_f.status <> 'pending' then
    raise exception '승인 대기 중인 펀딩만 승인/반려할 수 있습니다. (현재: %)', v_f.status;
  end if;

  -- 기존 검토 함수(상표 검수 연동 포함)를 그대로 재사용한다.
  perform public.review_funding_with_trademark(
    p_funding_id, p_decision, v_reason, coalesce(p_moq, v_f.moq), coalesce(p_price, v_f.price)
  );

  select * into v_after from public.fundings where id = p_funding_id;

  perform public._admin_log(
    case when p_decision = 'approved' then 'funding.approve' else 'funding.reject' end,
    'funding', p_funding_id::text, v_f.product_name,
    jsonb_build_object('status', v_f.status, 'moq', v_f.moq, 'price', v_f.price),
    jsonb_build_object('status', v_after.status, 'moq', v_after.moq, 'price', v_after.price),
    v_reason
  );

  perform public._admin_notify(v_f.creator_id, case when p_decision = 'approved'
    then format('[펀딩 승인] ''%s'' 펀딩이 승인되어 공개되었습니다.', v_f.product_name)
    else format('[펀딩 반려] ''%s'' 펀딩이 반려되었습니다. 사유: %s', v_f.product_name, v_reason) end,
    p_funding_id);

  return jsonb_build_object('status', v_after.status);
end;
$$;

create or replace function public.admin_set_funding_visibility(p_funding_id uuid, p_hidden boolean, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('fundings.manage');
  v_reason text := public._require_reason(p_reason, '처리 사유');
  v_f public.fundings%rowtype;
begin
  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;

  update public.fundings
  set is_hidden = coalesce(p_hidden, false), visibility_changed_at = now(), visibility_changed_by = v_actor, updated_at = now()
  where id = p_funding_id;

  perform public._admin_log(case when p_hidden then 'funding.hide' else 'funding.unhide' end,
    'funding', p_funding_id::text, v_f.product_name,
    jsonb_build_object('is_hidden', v_f.is_hidden), jsonb_build_object('is_hidden', p_hidden), v_reason);
  return jsonb_build_object('is_hidden', p_hidden);
end;
$$;

create or replace function public.admin_suspend_funding(
  p_funding_id uuid,
  p_reason text,
  p_notify_participants boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('fundings.manage');
  v_reason text := public._require_reason(p_reason, '중단 사유');
  v_f public.fundings%rowtype;
  v_notified integer := 0;
begin
  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if v_f.status not in ('approved', 'closed') then
    raise exception '공개된(승인/종료) 펀딩만 운영 중단할 수 있습니다. 승인 대기 펀딩은 반려해주세요.';
  end if;
  if v_f.suspended_at is not null then
    raise exception '이미 운영 중단된 펀딩입니다.';
  end if;

  -- 참여/주문/결제 데이터는 보존하고 새 참여만 막는다(status=closed).
  update public.fundings
  set status = 'closed',
      suspended_at = now(),
      suspended_by = v_actor,
      suspension_reason = v_reason,
      closed_at = coalesce(closed_at, now()),
      updated_at = now()
  where id = p_funding_id;

  perform public._admin_notify(v_f.creator_id,
    format('[펀딩 운영 중단] ''%s'' 펀딩이 운영 중단되었습니다. 사유: %s', v_f.product_name, v_reason), p_funding_id);

  if coalesce(p_notify_participants, true) then
    insert into public.community_notifications (recipient_id, actor_id, type, funding_id, message)
    select distinct fp.participant_id, v_actor, 'admin_notice', p_funding_id,
      format('[펀딩 중단 안내] 참여하신 ''%s'' 펀딩이 운영 중단되었습니다. 결제·환불 관련 안내를 드릴 예정입니다. 사유: %s', v_f.product_name, v_reason)
    from public.funding_participations fp
    where fp.funding_id = p_funding_id and fp.status <> 'cancelled' and fp.participant_id <> v_actor;
    get diagnostics v_notified = row_count;
  end if;

  perform public._admin_log('funding.suspend', 'funding', p_funding_id::text, v_f.product_name,
    jsonb_build_object('status', v_f.status), jsonb_build_object('status', 'closed', 'suspended', true),
    v_reason, jsonb_build_object('notified_participants', v_notified));

  return jsonb_build_object('status', 'closed', 'notified_participants', v_notified);
end;
$$;

create or replace function public.admin_resume_funding(p_funding_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('fundings.manage');
  v_reason text := public._require_reason(p_reason, '재개 사유');
  v_f public.fundings%rowtype;
  v_next_status text;
begin
  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if v_f.suspended_at is null then
    raise exception '운영 중단된 펀딩이 아닙니다.';
  end if;

  v_next_status := case
    when v_f.reviewed_at is not null and now() >= public._funding_end_at(v_f.reviewed_at, v_f.funding_days) then 'closed'
    else 'approved'
  end;

  update public.fundings
  set status = v_next_status,
      suspended_at = null,
      suspended_by = null,
      suspension_reason = null,
      closed_at = case when v_next_status = 'approved' then null else closed_at end,
      updated_at = now()
  where id = p_funding_id;

  perform public._admin_log('funding.resume', 'funding', p_funding_id::text, v_f.product_name,
    jsonb_build_object('status', v_f.status, 'suspension_reason', v_f.suspension_reason),
    jsonb_build_object('status', v_next_status), v_reason);
  perform public._admin_notify(v_f.creator_id,
    format('[펀딩 재개] ''%s'' 펀딩 운영이 재개되었습니다.', v_f.product_name), p_funding_id);
  return jsonb_build_object('status', v_next_status);
end;
$$;

create or replace function public.admin_close_funding(p_funding_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('fundings.manage');
  v_reason text := public._require_reason(p_reason, '종료 사유');
  v_f public.fundings%rowtype;
begin
  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if v_f.status <> 'approved' then
    raise exception '진행 중(승인)인 펀딩만 종료할 수 있습니다.';
  end if;

  update public.fundings
  set status = 'closed', closed_at = now(), updated_at = now()
  where id = p_funding_id;

  perform public._admin_log('funding.close', 'funding', p_funding_id::text, v_f.product_name,
    jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'closed'), v_reason);
  return jsonb_build_object('status', 'closed');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 주문 / 참여자 관리
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_orders(
  p_search text default null,
  p_state text default 'all',
  p_funding_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  order_number text,
  participant_id uuid,
  orderer_name text,
  orderer_phone text,
  funding_id uuid,
  product_name text,
  brand_name text,
  selected_color text,
  selected_size text,
  quantity integer,
  unit_price integer,
  total_amount integer,
  payment_provider text,
  payment_type text,
  payment_status text,
  participation_status text,
  order_state text,
  production_stage text,
  shipping_status text,
  tracking_number text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'orders.pii');
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_digits text := nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '');
begin
  return query
  with base as (
    select
      fp.*,
      coalesce(fp.orderer_name, nullif(pr.full_name, ''), nullif(pr.username, ''), '참여 고객') as orderer_name_v,
      coalesce(fp.orderer_phone, pr.phone_number) as orderer_phone_v,
      f.product_name as product_name_v,
      b.brand_name as brand_name_v,
      public._order_state(fp.status, fp.payment_status, fp.payment_approved_at, fp.production_stage, fp.shipping_status) as state_v
    from public.funding_participations fp
    join public.fundings f on f.id = fp.funding_id
    left join public.brands b on b.id = f.brand_id
    left join public.profiles pr on pr.id = fp.participant_id
    where p_funding_id is null or fp.funding_id = p_funding_id
  )
  select
    x.id, x.partner_order_id, x.participant_id,
    case when v_pii then x.orderer_name_v else public._mask_name(x.orderer_name_v) end,
    case when v_pii then x.orderer_phone_v else public._mask_phone(x.orderer_phone_v) end,
    x.funding_id, x.product_name_v, x.brand_name_v, x.selected_color, x.selected_size, x.quantity, x.unit_price,
    x.total_amount, x.payment_provider, x.payment_type, x.payment_status, x.status, x.state_v,
    x.production_stage, x.shipping_status, x.tracking_number, x.created_at,
    count(*) over ()
  from base x
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
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_get_order_detail(p_participation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'orders.pii');
  v_fp public.funding_participations%rowtype;
  v_f public.fundings%rowtype;
  v_pr public.profiles%rowtype;
begin
  select * into v_fp from public.funding_participations where id = p_participation_id;
  if not found then
    raise exception '주문을 찾을 수 없습니다.';
  end if;
  select * into v_f from public.fundings where id = v_fp.funding_id;
  select * into v_pr from public.profiles where id = v_fp.participant_id;

  return jsonb_build_object(
    'id', v_fp.id,
    'order_number', v_fp.partner_order_id,
    'participant_id', v_fp.participant_id,
    'participant_email', (select email from auth.users where id = v_fp.participant_id),
    'pii_visible', v_pii,
    'orderer_name', case when v_pii then coalesce(v_fp.orderer_name, v_pr.full_name, v_pr.username) else public._mask_name(coalesce(v_fp.orderer_name, v_pr.full_name, v_pr.username)) end,
    'orderer_phone', case when v_pii then coalesce(v_fp.orderer_phone, v_pr.phone_number) else public._mask_phone(coalesce(v_fp.orderer_phone, v_pr.phone_number)) end,
    'orderer_email', case when v_pii then v_fp.orderer_email else null end,
    'recipient_name', case when v_pii then v_fp.recipient_name else public._mask_name(v_fp.recipient_name) end,
    'recipient_phone', case when v_pii then v_fp.recipient_phone else public._mask_phone(v_fp.recipient_phone) end,
    'postal_code', case when v_pii then v_fp.postal_code else null end,
    'shipping_address', case when v_pii then v_fp.shipping_address else public._mask_address(v_fp.shipping_address) end,
    'shipping_address_detail', case when v_pii then v_fp.shipping_address_detail else null end,
    'delivery_message', case when v_pii then v_fp.delivery_message else null end,
    'funding', jsonb_build_object('id', v_f.id, 'product_name', v_f.product_name, 'image_url', v_f.image_url,
      'cloth_type', v_f.cloth_type, 'material', v_f.material, 'status', v_f.status,
      'brand_name', (select brand_name from public.brands where id = v_f.brand_id)),
    'selected_color', v_fp.selected_color,
    'selected_size', v_fp.selected_size,
    'quantity', v_fp.quantity,
    'unit_price', v_fp.unit_price,
    'total_amount', v_fp.total_amount,
    'participation_status', v_fp.status,
    'order_state', public._order_state(v_fp.status, v_fp.payment_status, v_fp.payment_approved_at, v_fp.production_stage, v_fp.shipping_status),
    'payment_provider', v_fp.payment_provider,
    'payment_type', v_fp.payment_type,
    'payment_status', v_fp.payment_status,
    'payment_method_type', v_fp.payment_method_type,
    'payment_approved_at', v_fp.payment_approved_at,
    'payment_cancelled_at', v_fp.payment_cancelled_at,
    'production_stage', v_fp.production_stage,
    'shipping_status', v_fp.shipping_status,
    'courier', v_fp.courier,
    'tracking_number', v_fp.tracking_number,
    'shipped_at', v_fp.shipped_at,
    'delivered_at', v_fp.delivered_at,
    'cancellation_reason', v_fp.cancellation_reason,
    'cancellation_source', v_fp.cancellation_source,
    'created_at', v_fp.created_at,
    'refund_requests', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'status', r.status, 'amount', r.amount, 'reason', r.reason, 'created_at', r.created_at) order by r.created_at desc)
      from public.refund_requests r where r.participation_id = v_fp.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('action', l.action, 'admin_name', l.admin_name, 'reason', l.reason, 'created_at', l.created_at) order by l.created_at desc)
      from public.admin_audit_logs l where l.target_type = 'order' and l.target_id = v_fp.id::text
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_set_order_status(p_participation_id uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.manage');
  v_reason text := public._require_reason(p_reason, '변경 사유');
  v_fp public.funding_participations%rowtype;
begin
  if p_status not in ('pledged', 'confirmed') then
    raise exception '주문 상태는 참여(pledged)/확정(confirmed)만 직접 변경할 수 있습니다. 취소는 환불 관리에서 처리해주세요.';
  end if;
  select * into v_fp from public.funding_participations where id = p_participation_id for update;
  if not found then
    raise exception '주문을 찾을 수 없습니다.';
  end if;
  if v_fp.status in ('cancelled', 'fulfilled') then
    raise exception '취소되었거나 완료된 주문은 변경할 수 없습니다.';
  end if;

  update public.funding_participations set status = p_status, updated_at = now() where id = p_participation_id;
  perform public._admin_log('order.status_change', 'order', p_participation_id::text, v_fp.partner_order_id,
    jsonb_build_object('status', v_fp.status), jsonb_build_object('status', p_status), v_reason);
  return jsonb_build_object('status', p_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. 결제 관리 (모의결제/실결제 구분, 플랫폼 상태와 PG 상태 분리)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_payments(
  p_search text default null,
  p_provider text default 'all',
  p_status text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  payment_number text,
  order_number text,
  participant_id uuid,
  user_name text,
  funding_id uuid,
  product_name text,
  amount integer,
  payment_provider text,
  payment_method text,
  is_mock boolean,
  payment_status text,
  pg_status text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  is_cancelled boolean,
  refund_status text,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('payments.view');
  return query
  with base as (
    select
      fp.*,
      coalesce(fp.orderer_name, nullif(pr.full_name, ''), nullif(pr.username, ''), '참여 고객') as user_name_v,
      f.product_name as product_name_v,
      (select r.status from public.refund_requests r where r.participation_id = fp.id order by r.created_at desc limit 1) as refund_status_v
    from public.funding_participations fp
    join public.fundings f on f.id = fp.funding_id
    left join public.profiles pr on pr.id = fp.participant_id
    where fp.payment_provider <> 'none'
  )
  select
    x.id,
    coalesce(x.payment_tid, x.partner_order_id),
    x.partner_order_id,
    x.participant_id,
    x.user_name_v,
    x.funding_id,
    x.product_name_v,
    x.total_amount,
    x.payment_provider,
    case when x.payment_provider = 'mock' then 'MOCK' else coalesce(x.payment_method_type, 'KAKAOPAY') end,
    x.payment_provider = 'mock',
    x.payment_status,
    case
      when x.payment_provider = 'mock' then 'not_applicable'
      when x.payment_tid is null then 'not_requested'
      else case x.payment_status
        when 'paid' then 'approved'
        when 'cancelled' then 'cancelled'
        when 'ready' then 'ready'
        when 'failed' then 'failed'
        else x.payment_status end
    end,
    x.payment_approved_at,
    x.payment_cancelled_at,
    x.payment_status = 'cancelled',
    x.refund_status_v,
    x.created_at,
    count(*) over ()
  from base x
  where (v_search is null
      or x.partner_order_id ilike '%' || v_search || '%'
      or x.payment_tid ilike '%' || v_search || '%'
      or x.user_name_v ilike '%' || v_search || '%'
      or x.product_name_v ilike '%' || v_search || '%')
    and (coalesce(p_provider, 'all') = 'all' or x.payment_provider = p_provider)
    and (coalesce(p_status, 'all') = 'all' or x.payment_status = p_status)
  order by x.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. 취소 / 환불 관리
-- ---------------------------------------------------------------------------

-- 관리자 환불 완료 시 참여 건을 취소 상태로 보관(삭제 아님)하고 구매자에게 알린다.
create or replace function public._admin_cancel_participation(p_participation_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp public.funding_participations%rowtype;
  v_product text;
  v_was_counted boolean;
begin
  select * into v_fp from public.funding_participations where id = p_participation_id for update;
  if not found then
    raise exception '주문을 찾을 수 없습니다.';
  end if;
  if v_fp.status = 'cancelled' and v_fp.payment_status = 'cancelled' then
    return;
  end if;

  select product_name into v_product from public.fundings where id = v_fp.funding_id for update;
  v_was_counted := v_fp.status <> 'cancelled' and v_fp.payment_status in ('unpaid', 'paid');

  update public.funding_participations
  set status = 'cancelled',
      payment_status = case when payment_status in ('paid', 'ready') then 'cancelled' else payment_status end,
      payment_cancelled_at = coalesce(payment_cancelled_at, now()),
      cancelled_by = auth.uid(),
      cancellation_reason = left(p_reason, 500),
      cancellation_source = 'admin',
      buyer_notified_at = now(),
      updated_at = now()
  where id = p_participation_id;

  if v_was_counted then
    update public.fundings
    set current_orders = greatest(0, current_orders - v_fp.quantity), updated_at = now()
    where id = v_fp.funding_id;
  end if;

  insert into public.community_notifications (recipient_id, actor_id, type, funding_id, message)
  values (v_fp.participant_id, auth.uid(), 'participation_cancelled', v_fp.funding_id,
    format('[환불 완료] ''%s'' 펀딩 주문(%s)의 환불이 완료되었습니다. 사유: %s', v_product, v_fp.partner_order_id, p_reason));
end;
$$;

revoke all on function public._admin_cancel_participation(uuid, text) from public, anon, authenticated;

create or replace function public._create_refund_request(
  p_participation_id uuid,
  p_reason text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fp public.funding_participations%rowtype;
  v_id uuid;
begin
  select * into v_fp from public.funding_participations where id = p_participation_id for update;
  if not found then
    raise exception '주문을 찾을 수 없습니다.';
  end if;
  if v_fp.payment_status <> 'paid' or v_fp.status = 'cancelled' then
    raise exception '결제 완료 상태의 주문만 환불을 요청할 수 있습니다.';
  end if;
  if exists (
    select 1 from public.refund_requests r
    where r.participation_id = p_participation_id and r.status not in ('rejected', 'completed')
  ) then
    raise exception '이미 처리 중인 환불 요청이 있습니다.';
  end if;

  insert into public.refund_requests (
    participation_id, funding_id, user_id, requested_by, requested_by_role, amount, reason,
    payment_provider, is_mock_payment, pg_refund_status
  ) values (
    v_fp.id, v_fp.funding_id, v_fp.participant_id, auth.uid(), p_role, v_fp.total_amount, p_reason,
    v_fp.payment_provider, v_fp.payment_provider = 'mock',
    case when v_fp.payment_provider = 'mock' then 'not_applicable_mock' else 'awaiting_pg_integration' end
  ) returning id into v_id;

  insert into public.refund_request_events (refund_request_id, from_status, to_status, note, actor_id, actor_name)
  values (v_id, null, 'requested', p_reason, auth.uid(), public._admin_display_name(auth.uid()));

  return v_id;
end;
$$;

revoke all on function public._create_refund_request(uuid, text, text) from public, anon, authenticated;

create or replace function public.admin_create_refund_request(p_participation_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('refunds.request');
  v_reason text := public._require_reason(p_reason, '환불 사유');
  v_id uuid;
begin
  v_id := public._create_refund_request(
    p_participation_id, v_reason,
    case when public._admin_role_of(v_actor) = 'cs_admin' then 'cs_admin' else 'admin' end
  );
  perform public._admin_log('refund.request', 'refund', v_id::text,
    (select partner_order_id from public.funding_participations where id = p_participation_id),
    null, jsonb_build_object('status', 'requested', 'participation_id', p_participation_id), v_reason);
  return v_id;
end;
$$;

-- 구매자 본인 환불 요청(향후 마이페이지 UI 연동용). 실제 환불은 관리자 승인 후 처리된다.
create or replace function public.request_my_refund(p_participation_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := public._require_reason(p_reason, '환불 사유');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (
    select 1 from public.funding_participations where id = p_participation_id and participant_id = auth.uid()
  ) then
    raise exception '본인 주문만 환불을 요청할 수 있습니다.';
  end if;
  return public._create_refund_request(p_participation_id, v_reason, 'customer');
end;
$$;

create or replace function public.admin_list_refunds(
  p_status text default 'all',
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  participation_id uuid,
  order_number text,
  funding_id uuid,
  product_name text,
  user_id uuid,
  user_name text,
  amount integer,
  reason text,
  status text,
  requested_by_role text,
  requested_by_name text,
  payment_provider text,
  is_mock_payment boolean,
  pg_refund_status text,
  admin_note text,
  rejection_reason text,
  processed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('refunds.view');
  return query
  select
    r.id, r.participation_id, fp.partner_order_id, r.funding_id, f.product_name, r.user_id,
    coalesce(fp.orderer_name, nullif(pr.full_name, ''), nullif(pr.username, ''), '참여 고객'),
    r.amount, r.reason, r.status, r.requested_by_role,
    case when r.requested_by is null then null else public._admin_display_name(r.requested_by) end,
    r.payment_provider, r.is_mock_payment, r.pg_refund_status, r.admin_note, r.rejection_reason,
    r.processed_at, r.created_at, r.updated_at,
    count(*) over ()
  from public.refund_requests r
  join public.funding_participations fp on fp.id = r.participation_id
  join public.fundings f on f.id = r.funding_id
  left join public.profiles pr on pr.id = r.user_id
  where (coalesce(p_status, 'all') = 'all' or r.status = p_status)
    and (v_search is null
      or fp.partner_order_id ilike '%' || v_search || '%'
      or f.product_name ilike '%' || v_search || '%'
      or fp.orderer_name ilike '%' || v_search || '%')
  order by case when r.status in ('requested', 'reviewing') then 0 else 1 end, r.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_get_refund_events(p_refund_id uuid)
returns table (id uuid, from_status text, to_status text, note text, actor_name text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_require('refunds.view');
  return query
  select e.id, e.from_status, e.to_status, e.note, e.actor_name, e.created_at
  from public.refund_request_events e
  where e.refund_request_id = p_refund_id
  order by e.created_at;
end;
$$;

create or replace function public.admin_transition_refund(
  p_refund_id uuid,
  p_to_status text,
  p_note text default null,
  p_pg_manual_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_r public.refund_requests%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_required text;
begin
  perform public._admin_require('refunds.view');
  select * into v_r from public.refund_requests where id = p_refund_id for update;
  if not found then
    raise exception '환불 요청을 찾을 수 없습니다.';
  end if;

  -- 허용 전이와 필요한 권한
  v_required := case
    when v_r.status = 'requested' and p_to_status = 'reviewing' then 'refunds.request'
    when v_r.status in ('requested', 'reviewing') and p_to_status in ('approved', 'rejected') then 'refunds.manage'
    when v_r.status = 'approved' and p_to_status = 'processing' then 'refunds.manage'
    when v_r.status = 'processing' and p_to_status = 'completed' then 'refunds.manage'
    else null
  end;
  if v_required is null then
    raise exception '허용되지 않는 환불 상태 변경입니다. (% → %)', v_r.status, p_to_status;
  end if;
  v_actor := public._admin_require(v_required);

  if p_to_status = 'rejected' then
    v_note := public._require_reason(p_note, '반려 사유');
  end if;

  if p_to_status = 'completed' then
    if not v_r.is_mock_payment and not coalesce(p_pg_manual_confirmed, false) then
      raise exception '실결제 건은 PG 자동 환불이 아직 연동되지 않았습니다. PG 관리자 콘솔에서 환불을 완료한 뒤 "PG 환불 완료 확인"을 체크해주세요.';
    end if;
    perform public._admin_cancel_participation(v_r.participation_id, coalesce(v_note, v_r.reason));
  end if;

  update public.refund_requests
  set status = p_to_status,
      admin_note = coalesce(v_note, admin_note),
      rejection_reason = case when p_to_status = 'rejected' then v_note else rejection_reason end,
      pg_refund_status = case
        when p_to_status = 'completed' and is_mock_payment then 'not_applicable_mock'
        when p_to_status = 'completed' then 'manual_confirmed'
        else pg_refund_status end,
      processed_by = case when p_to_status in ('completed', 'rejected') then v_actor else processed_by end,
      processed_at = case when p_to_status in ('completed', 'rejected') then now() else processed_at end,
      updated_at = now()
  where id = p_refund_id;

  insert into public.refund_request_events (refund_request_id, from_status, to_status, note, actor_id, actor_name)
  values (p_refund_id, v_r.status, p_to_status, v_note, v_actor, public._admin_display_name(v_actor));

  perform public._admin_log('refund.' || p_to_status, 'refund', p_refund_id::text,
    (select partner_order_id from public.funding_participations where id = v_r.participation_id),
    jsonb_build_object('status', v_r.status), jsonb_build_object('status', p_to_status, 'pg_manual_confirmed', p_pg_manual_confirmed),
    v_note);

  if p_to_status = 'rejected' and v_r.user_id is not null then
    perform public._admin_notify(v_r.user_id, '[환불 요청 반려] 요청하신 환불이 반려되었습니다. 사유: ' || v_note, v_r.funding_id);
  elsif p_to_status = 'approved' and v_r.user_id is not null then
    perform public._admin_notify(v_r.user_id, '[환불 승인] 요청하신 환불이 승인되어 처리 예정입니다.', v_r.funding_id);
  end if;

  return jsonb_build_object('status', p_to_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. 정산 관리
-- ---------------------------------------------------------------------------

create or replace function public._settlement_figures(p_funding_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'gross_amount', coalesce(sum(fp.total_amount) filter (where fp.payment_approved_at is not null), 0),
    'refund_amount', coalesce(sum(fp.total_amount) filter (where fp.payment_approved_at is not null and fp.payment_status = 'cancelled'), 0),
    'mock_amount', coalesce(sum(fp.total_amount) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.payment_provider = 'mock'), 0),
    'real_amount', coalesce(sum(fp.total_amount) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.payment_provider <> 'mock'), 0),
    'paid_orders', count(*) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled'),
    'refunded_orders', count(*) filter (where fp.payment_approved_at is not null and fp.payment_status = 'cancelled'),
    'net_quantity', coalesce(sum(fp.quantity) filter (where fp.payment_status = 'paid' and fp.status <> 'cancelled'), 0)
  )
  from public.funding_participations fp
  where fp.funding_id = p_funding_id;
$$;

revoke all on function public._settlement_figures(uuid) from public, anon, authenticated;

create or replace function public._settlement_recalculate(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.settlements%rowtype;
  v_fig jsonb;
  v_gross bigint;
  v_refund bigint;
  v_net bigint;
  v_fee bigint;
begin
  select * into v_s from public.settlements where id = p_settlement_id for update;
  v_fig := public._settlement_figures(v_s.funding_id);
  v_gross := (v_fig ->> 'gross_amount')::bigint;
  v_refund := (v_fig ->> 'refund_amount')::bigint;
  v_net := v_gross - v_refund;
  v_fee := round(v_net * v_s.commission_rate / 100);

  update public.settlements
  set gross_amount = v_gross,
      refund_amount = v_refund,
      net_sales = v_net,
      mock_amount = (v_fig ->> 'mock_amount')::bigint,
      real_amount = (v_fig ->> 'real_amount')::bigint,
      platform_fee = v_fee,
      final_amount = v_net - v_fee - v_s.production_cost - v_s.other_deductions,
      calculation = v_fig || jsonb_build_object(
        'formula', '최종 정산금 = (총 거래액 - 취소/환불) - 플랫폼 수수료 - 제작비 - 기타 차감',
        'net_sales', v_net,
        'commission_rate', v_s.commission_rate,
        'platform_fee', v_fee,
        'production_cost', v_s.production_cost,
        'other_deductions', v_s.other_deductions,
        'final_amount', v_net - v_fee - v_s.production_cost - v_s.other_deductions,
        'includes_mock_payments', (v_fig ->> 'mock_amount')::bigint > 0,
        'calculated_at', now()
      ),
      updated_at = now()
  where id = p_settlement_id;
end;
$$;

revoke all on function public._settlement_recalculate(uuid) from public, anon, authenticated;

create or replace function public.admin_list_settlement_candidates()
returns table (
  funding_id uuid,
  product_name text,
  brand_name text,
  creator_name text,
  phase text,
  current_orders integer,
  moq integer,
  gmv bigint,
  end_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_require('settlements.view');
  return query
  select f.id, f.product_name, b.brand_name, c.display_name,
    public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days, f.current_orders, f.moq, f.production_status),
    f.current_orders, f.moq,
    (select coalesce(sum(fp.total_amount), 0)::bigint from public.funding_participations fp
      where fp.funding_id = f.id and fp.payment_status = 'paid' and fp.status <> 'cancelled'),
    public._funding_end_at(f.reviewed_at, f.funding_days)
  from public.fundings f
  left join public.brands b on b.id = f.brand_id
  left join public.creator_profiles c on c.user_id = f.creator_id
  where not exists (select 1 from public.settlements s where s.funding_id = f.id)
    and public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days, f.current_orders, f.moq, f.production_status)
      in ('succeeded', 'in_production', 'shipping', 'completed')
  order by f.created_at desc;
end;
$$;

create or replace function public.admin_generate_settlement(
  p_funding_id uuid,
  p_production_cost bigint default null,
  p_other_deductions bigint default null,
  p_memo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('settlements.manage');
  v_f public.fundings%rowtype;
  v_existing public.settlements%rowtype;
  v_fig jsonb;
  v_default_cost bigint;
  v_id uuid;
begin
  select * into v_f from public.fundings where id = p_funding_id;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if coalesce(p_production_cost, 0) < 0 or coalesce(p_other_deductions, 0) < 0 then
    raise exception '제작비와 기타 차감액은 0원 이상이어야 합니다.';
  end if;

  select * into v_existing from public.settlements where funding_id = p_funding_id for update;
  if found and v_existing.status = 'completed' then
    raise exception '정산 완료된 건은 다시 계산할 수 없습니다.';
  end if;

  v_fig := public._settlement_figures(p_funding_id);
  v_default_cost := coalesce(v_f.estimate_direct_unit_max, v_f.estimate_direct_unit_min, 0)::bigint
    * (v_fig ->> 'net_quantity')::bigint + coalesce(v_f.estimate_development_total, 0);

  if v_existing.id is null then
    insert into public.settlements (
      funding_id, brand_id, creator_id, commission_rate, production_cost, other_deductions,
      scheduled_date, status, memo, created_by, updated_by
    ) values (
      p_funding_id, v_f.brand_id, v_f.creator_id,
      public._platform_setting_numeric('platform_commission_rate', 10),
      coalesce(p_production_cost, v_default_cost),
      coalesce(p_other_deductions, 0),
      current_date + public._platform_setting_numeric('settlement_delay_days', 7)::integer,
      'pending', nullif(btrim(coalesce(p_memo, '')), ''), v_actor, v_actor
    ) returning id into v_id;
  else
    v_id := v_existing.id;
    update public.settlements
    set production_cost = coalesce(p_production_cost, production_cost),
        other_deductions = coalesce(p_other_deductions, other_deductions),
        memo = coalesce(nullif(btrim(coalesce(p_memo, '')), ''), memo),
        updated_by = v_actor
    where id = v_id;
  end if;

  perform public._settlement_recalculate(v_id);

  perform public._admin_log(
    case when v_existing.id is null then 'settlement.create' else 'settlement.recalculate' end,
    'settlement', v_id::text, v_f.product_name,
    case when v_existing.id is null then null else to_jsonb(v_existing) - 'calculation' end,
    (select to_jsonb(s) - 'calculation' from public.settlements s where s.id = v_id),
    p_memo
  );
  return v_id;
end;
$$;

create or replace function public.admin_update_settlement(
  p_settlement_id uuid,
  p_production_cost bigint,
  p_other_deductions bigint,
  p_scheduled_date date,
  p_memo text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('settlements.manage');
  v_reason text := public._require_reason(p_reason, '수정 사유');
  v_before public.settlements%rowtype;
begin
  select * into v_before from public.settlements where id = p_settlement_id for update;
  if not found then
    raise exception '정산 내역을 찾을 수 없습니다.';
  end if;
  if v_before.status = 'completed' then
    raise exception '정산 완료된 건은 수정할 수 없습니다.';
  end if;
  if coalesce(p_production_cost, 0) < 0 or coalesce(p_other_deductions, 0) < 0 then
    raise exception '제작비와 기타 차감액은 0원 이상이어야 합니다.';
  end if;

  update public.settlements
  set production_cost = coalesce(p_production_cost, production_cost),
      other_deductions = coalesce(p_other_deductions, other_deductions),
      scheduled_date = coalesce(p_scheduled_date, scheduled_date),
      memo = coalesce(nullif(btrim(coalesce(p_memo, '')), ''), memo),
      updated_by = v_actor
  where id = p_settlement_id;
  perform public._settlement_recalculate(p_settlement_id);

  perform public._admin_log('settlement.update', 'settlement', p_settlement_id::text,
    (select product_name from public.fundings where id = v_before.funding_id),
    to_jsonb(v_before) - 'calculation',
    (select to_jsonb(s) - 'calculation' from public.settlements s where s.id = p_settlement_id),
    v_reason);
  return (select to_jsonb(s) from public.settlements s where s.id = p_settlement_id);
end;
$$;

create or replace function public.admin_set_settlement_status(p_settlement_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('settlements.manage');
  v_s public.settlements%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_status not in ('pending', 'scheduled', 'completed', 'on_hold') then
    raise exception '올바르지 않은 정산 상태입니다.';
  end if;
  select * into v_s from public.settlements where id = p_settlement_id for update;
  if not found then
    raise exception '정산 내역을 찾을 수 없습니다.';
  end if;
  if v_s.status = 'completed' then
    raise exception '정산 완료된 건은 상태를 변경할 수 없습니다.';
  end if;
  if p_status = 'on_hold' then
    v_reason := public._require_reason(p_reason, '보류 사유');
  end if;
  if p_status = 'completed' and v_s.status <> 'scheduled' then
    raise exception '정산 예정(scheduled) 상태에서만 정산 완료 처리할 수 있습니다.';
  end if;

  if p_status in ('scheduled', 'completed') then
    perform public._settlement_recalculate(p_settlement_id);
  end if;

  update public.settlements
  set status = p_status,
      hold_reason = case when p_status = 'on_hold' then v_reason else null end,
      completed_at = case when p_status = 'completed' then now() else null end,
      updated_by = v_actor,
      updated_at = now()
  where id = p_settlement_id;

  perform public._admin_log('settlement.status_' || p_status, 'settlement', p_settlement_id::text,
    (select product_name from public.fundings where id = v_s.funding_id),
    jsonb_build_object('status', v_s.status), jsonb_build_object('status', p_status,
      'final_amount', (select final_amount from public.settlements where id = p_settlement_id)),
    v_reason);

  if p_status = 'completed' and v_s.creator_id is not null then
    perform public._admin_notify(v_s.creator_id,
      format('[정산 완료] ''%s'' 펀딩 정산이 완료되었습니다.', (select product_name from public.fundings where id = v_s.funding_id)),
      v_s.funding_id);
  end if;
  return jsonb_build_object('status', p_status);
end;
$$;

create or replace function public.admin_list_settlements(p_status text default 'all', p_search text default null)
returns table (
  id uuid,
  funding_id uuid,
  product_name text,
  brand_id uuid,
  brand_name text,
  creator_id uuid,
  creator_name text,
  gross_amount bigint,
  refund_amount bigint,
  net_sales bigint,
  mock_amount bigint,
  real_amount bigint,
  commission_rate numeric,
  platform_fee bigint,
  production_cost bigint,
  other_deductions bigint,
  final_amount bigint,
  scheduled_date date,
  status text,
  hold_reason text,
  memo text,
  calculation jsonb,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('settlements.view');
  return query
  select s.id, s.funding_id, f.product_name, s.brand_id, b.brand_name, s.creator_id, c.display_name,
    s.gross_amount, s.refund_amount, s.net_sales, s.mock_amount, s.real_amount, s.commission_rate, s.platform_fee,
    s.production_cost, s.other_deductions, s.final_amount, s.scheduled_date, s.status, s.hold_reason, s.memo,
    s.calculation, s.completed_at, s.created_at, s.updated_at
  from public.settlements s
  join public.fundings f on f.id = s.funding_id
  left join public.brands b on b.id = s.brand_id
  left join public.creator_profiles c on c.user_id = s.creator_id
  where (coalesce(p_status, 'all') = 'all' or s.status = p_status)
    and (v_search is null or f.product_name ilike '%' || v_search || '%' or b.brand_name ilike '%' || v_search || '%'
      or c.display_name ilike '%' || v_search || '%')
  order by case s.status when 'pending' then 0 when 'scheduled' then 1 when 'on_hold' then 2 else 3 end, s.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. 제작 진행 관리
-- ---------------------------------------------------------------------------

create or replace function public._apply_production_stage(
  p_funding_id uuid,
  p_stage text,
  p_note text,
  p_image_urls text[],
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f public.fundings%rowtype;
  v_participation_stage text := public._production_stage_to_participation(p_stage);
begin
  select * into v_f from public.fundings where id = p_funding_id for update;

  update public.fundings
  set production_status = p_stage, production_updated_at = now(), updated_at = now()
  where id = p_funding_id;

  insert into public.funding_production_logs (
    funding_id, from_stage, to_stage, note, image_urls, changed_by, changed_by_name, changed_by_role
  ) values (
    p_funding_id, v_f.production_status, p_stage, nullif(btrim(coalesce(p_note, '')), ''),
    coalesce(p_image_urls, '{}'::text[]), auth.uid(), public._admin_display_name(auth.uid()), p_role
  );

  -- 구매자 화면(get_my_funding_participations)의 제작 단계를 함께 갱신한다. 취소/미결제 건은 제외.
  if p_stage = 'delivered' then
    update public.funding_participations
    set production_stage = 'delivered', status = 'fulfilled', updated_at = now()
    where funding_id = p_funding_id and status <> 'cancelled' and payment_status = 'paid'
      and shipping_status = 'delivered';
  else
    update public.funding_participations
    set production_stage = v_participation_stage, updated_at = now()
    where funding_id = p_funding_id and status <> 'cancelled' and payment_status = 'paid'
      and shipping_status = 'preparing'
      and production_stage is distinct from v_participation_stage;
  end if;
end;
$$;

revoke all on function public._apply_production_stage(uuid, text, text, text[], text) from public, anon, authenticated;

create or replace function public.admin_update_production_stage(
  p_funding_id uuid,
  p_stage text,
  p_note text default null,
  p_image_urls text[] default '{}'::text[],
  p_notify_participants boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('production.manage');
  v_f public.fundings%rowtype;
  v_notified integer := 0;
begin
  if public._production_stage_rank(p_stage) = 0 then
    raise exception '올바르지 않은 제작 단계입니다.';
  end if;
  if cardinality(coalesce(p_image_urls, '{}'::text[])) > 10 then
    raise exception '첨부 이미지는 최대 10장까지 등록할 수 있습니다.';
  end if;
  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if v_f.status not in ('approved', 'closed') or v_f.suspended_at is not null then
    raise exception '진행 중이거나 종료된(운영 중단 제외) 펀딩만 제작 단계를 관리할 수 있습니다.';
  end if;
  if v_f.current_orders < v_f.moq then
    raise exception '목표 수량(MOQ %장)에 도달한 펀딩만 제작 단계로 전환할 수 있습니다. (현재 %장)', v_f.moq, v_f.current_orders;
  end if;

  perform public._apply_production_stage(p_funding_id, p_stage, p_note, p_image_urls, 'admin');

  if coalesce(p_notify_participants, false) then
    insert into public.community_notifications (recipient_id, actor_id, type, funding_id, message)
    select distinct fp.participant_id, v_actor, 'funding_status_changed', p_funding_id,
      format('[제작 진행 안내] ''%s'' 제작 단계가 ''%s''(으)로 변경되었습니다.%s', v_f.product_name,
        public._production_stage_label(p_stage),
        case when nullif(btrim(coalesce(p_note, '')), '') is null then '' else ' ' || btrim(p_note) end)
    from public.funding_participations fp
    where fp.funding_id = p_funding_id and fp.status <> 'cancelled' and fp.payment_status = 'paid';
    get diagnostics v_notified = row_count;
  end if;

  perform public._admin_log('production.stage_change', 'funding', p_funding_id::text, v_f.product_name,
    jsonb_build_object('production_status', v_f.production_status),
    jsonb_build_object('production_status', p_stage), p_note,
    jsonb_build_object('image_count', cardinality(coalesce(p_image_urls, '{}'::text[])), 'notified', v_notified));

  return jsonb_build_object('production_status', p_stage, 'notified', v_notified);
end;
$$;

-- 제작자는 본인 펀딩의 "제작 공정" 단계만 앞으로 진행시킬 수 있다.
-- 펀딩 성공 선언/배송/배송완료는 관리자 전용.
create or replace function public.creator_update_production_stage(
  p_funding_id uuid,
  p_stage text,
  p_note text default null,
  p_image_urls text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f public.fundings%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_stage not in ('fabric_contact', 'pattern_sample', 'sample_review', 'mass_production', 'inspection_packing') then
    raise exception '제작자는 원단 컨택부터 검수/포장 단계까지만 변경할 수 있습니다.';
  end if;
  if cardinality(coalesce(p_image_urls, '{}'::text[])) > 10 then
    raise exception '첨부 이미지는 최대 10장까지 등록할 수 있습니다.';
  end if;
  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found or v_f.creator_id <> auth.uid() then
    raise exception '본인 펀딩의 제작 단계만 변경할 수 있습니다.';
  end if;
  if v_f.suspended_at is not null then
    raise exception '운영 중단된 펀딩입니다.';
  end if;
  if v_f.production_status is null then
    raise exception '관리자가 펀딩 성공을 확정한 뒤 제작 단계를 진행할 수 있습니다.';
  end if;
  if public._production_stage_rank(p_stage) <= public._production_stage_rank(v_f.production_status) then
    raise exception '제작 단계는 다음 단계로만 진행할 수 있습니다.';
  end if;

  perform public._apply_production_stage(p_funding_id, p_stage, p_note, p_image_urls, 'creator');
  return jsonb_build_object('production_status', p_stage);
end;
$$;

create or replace function public.list_funding_production_logs(p_funding_id uuid)
returns table (
  id uuid,
  from_stage text,
  to_stage text,
  note text,
  image_urls text[],
  changed_by_name text,
  changed_by_role text,
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
  if not public._admin_has_permission(auth.uid(), 'production.view')
    and not exists (select 1 from public.fundings f where f.id = p_funding_id and f.creator_id = auth.uid()) then
    raise exception '제작 진행 기록을 볼 권한이 없습니다.' using errcode = '42501';
  end if;
  return query
  select l.id, l.from_stage, l.to_stage, l.note, l.image_urls, l.changed_by_name, l.changed_by_role, l.created_at
  from public.funding_production_logs l
  where l.funding_id = p_funding_id
  order by l.created_at desc;
end;
$$;

create or replace function public.admin_list_production_board()
returns table (
  funding_id uuid,
  product_name text,
  image_url text,
  brand_name text,
  creator_name text,
  phase text,
  production_status text,
  production_updated_at timestamptz,
  current_orders integer,
  moq integer,
  active_orders integer,
  quantity bigint,
  invoiced integer,
  shipped integer,
  delivered integer,
  end_at timestamptz,
  last_note text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_require('production.view');
  return query
  select f.id, f.product_name, f.image_url, b.brand_name, c.display_name,
    public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days, f.current_orders, f.moq, f.production_status),
    f.production_status, f.production_updated_at, f.current_orders, f.moq,
    count(fp.id) filter (where fp.status <> 'cancelled' and fp.payment_status = 'paid')::integer,
    coalesce(sum(fp.quantity) filter (where fp.status <> 'cancelled' and fp.payment_status = 'paid'), 0)::bigint,
    count(fp.id) filter (where fp.status <> 'cancelled' and fp.payment_status = 'paid' and fp.tracking_number is not null and fp.shipping_status = 'preparing')::integer,
    count(fp.id) filter (where fp.status <> 'cancelled' and fp.payment_status = 'paid' and fp.shipping_status = 'shipped')::integer,
    count(fp.id) filter (where fp.status <> 'cancelled' and fp.payment_status = 'paid' and fp.shipping_status = 'delivered')::integer,
    public._funding_end_at(f.reviewed_at, f.funding_days),
    (select l.note from public.funding_production_logs l where l.funding_id = f.id order by l.created_at desc limit 1)
  from public.fundings f
  left join public.brands b on b.id = f.brand_id
  left join public.creator_profiles c on c.user_id = f.creator_id
  left join public.funding_participations fp on fp.funding_id = f.id
  where f.status in ('approved', 'closed')
    and (f.production_status is not null or f.current_orders >= f.moq)
  group by f.id, b.brand_name, c.display_name
  order by case when f.production_status is null then 0 else 1 end, f.production_updated_at desc nulls first;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. 배송 관리
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_shipments(
  p_funding_id uuid default null,
  p_state text default 'all',
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  order_number text,
  funding_id uuid,
  product_name text,
  recipient_name text,
  recipient_phone text,
  shipping_address text,
  selected_color text,
  selected_size text,
  quantity integer,
  production_stage text,
  shipping_state text,
  shipping_status text,
  courier text,
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('shipping.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'orders.pii');
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  return query
  with base as (
    select fp.*, f.product_name as product_name_v,
      case
        when fp.shipping_status = 'delivered' then 'delivered'
        when fp.shipping_status = 'shipped' then 'shipped'
        when fp.tracking_number is not null then 'invoiced'
        else 'preparing'
      end as state_v
    from public.funding_participations fp
    join public.fundings f on f.id = fp.funding_id
    where fp.status <> 'cancelled' and fp.payment_status = 'paid'
      and (p_funding_id is null or fp.funding_id = p_funding_id)
  )
  select x.id, x.partner_order_id, x.funding_id, x.product_name_v,
    case when v_pii then x.recipient_name else public._mask_name(x.recipient_name) end,
    case when v_pii then x.recipient_phone else public._mask_phone(x.recipient_phone) end,
    case when v_pii then concat_ws(' ', '(' || x.postal_code || ')', x.shipping_address, x.shipping_address_detail)
      else public._mask_address(x.shipping_address) end,
    x.selected_color, x.selected_size, x.quantity, x.production_stage, x.state_v, x.shipping_status,
    x.courier, x.tracking_number, x.shipped_at, x.delivered_at, x.created_at,
    count(*) over ()
  from base x
  where (coalesce(p_state, 'all') = 'all' or x.state_v = p_state)
    and (v_search is null or x.partner_order_id ilike '%' || v_search || '%'
      or x.recipient_name ilike '%' || v_search || '%'
      or x.tracking_number ilike '%' || v_search || '%'
      or x.product_name_v ilike '%' || v_search || '%')
  order by x.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_update_shipment(
  p_participation_id uuid,
  p_action text,
  p_courier text default null,
  p_tracking_number text default null,
  p_note text default null,
  p_notify boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('shipping.manage');
  v_fp public.funding_participations%rowtype;
  v_product text;
  v_courier text := nullif(btrim(coalesce(p_courier, '')), '');
  v_tracking text := nullif(btrim(coalesce(p_tracking_number, '')), '');
begin
  if p_action not in ('invoice', 'ship', 'deliver', 'revert_preparing') then
    raise exception '올바르지 않은 배송 처리 유형입니다.';
  end if;
  select * into v_fp from public.funding_participations where id = p_participation_id for update;
  if not found then
    raise exception '주문을 찾을 수 없습니다.';
  end if;
  if v_fp.status = 'cancelled' or v_fp.payment_status <> 'paid' then
    raise exception '결제 완료된 유효 주문만 배송 처리할 수 있습니다.';
  end if;
  select product_name into v_product from public.fundings where id = v_fp.funding_id;

  if p_action = 'invoice' then
    if v_courier is null or v_tracking is null then
      raise exception '택배사와 송장번호를 입력해주세요.';
    end if;
    update public.funding_participations
    set courier = v_courier, tracking_number = v_tracking,
        production_stage = case when production_stage in ('funding', 'fabric_sourcing', 'sampling', 'production', 'inspection_packing') then 'shipping_ready' else production_stage end,
        shipping_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), shipping_note),
        shipping_updated_at = now(), shipping_updated_by = v_actor, updated_at = now()
    where id = p_participation_id;
  elsif p_action = 'ship' then
    if coalesce(v_tracking, v_fp.tracking_number) is null then
      raise exception '송장번호를 먼저 등록해주세요.';
    end if;
    update public.funding_participations
    set courier = coalesce(v_courier, courier),
        tracking_number = coalesce(v_tracking, tracking_number),
        shipping_status = 'shipped',
        production_stage = case when production_stage = 'delivered' then production_stage else 'shipping_ready' end,
        shipped_at = coalesce(shipped_at, now()),
        shipping_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), shipping_note),
        shipping_updated_at = now(), shipping_updated_by = v_actor, updated_at = now()
    where id = p_participation_id;
    if coalesce(p_notify, true) then
      perform public._admin_notify(v_fp.participant_id,
        format('[배송 시작] ''%s'' 상품이 발송되었습니다. %s %s', v_product,
          coalesce(v_courier, v_fp.courier, ''), coalesce(v_tracking, v_fp.tracking_number, '')),
        v_fp.funding_id);
    end if;
  elsif p_action = 'deliver' then
    update public.funding_participations
    set shipping_status = 'delivered',
        production_stage = 'delivered',
        status = 'fulfilled',
        shipped_at = coalesce(shipped_at, now()),
        delivered_at = coalesce(delivered_at, now()),
        shipping_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), shipping_note),
        shipping_updated_at = now(), shipping_updated_by = v_actor, updated_at = now()
    where id = p_participation_id;
    if coalesce(p_notify, true) then
      perform public._admin_notify(v_fp.participant_id,
        format('[배송 완료] ''%s'' 상품 배송이 완료되었습니다.', v_product), v_fp.funding_id);
    end if;
  else
    if v_fp.shipping_status = 'delivered' then
      raise exception '배송 완료된 주문은 되돌릴 수 없습니다.';
    end if;
    update public.funding_participations
    set shipping_status = 'preparing', shipped_at = null,
        shipping_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), shipping_note),
        shipping_updated_at = now(), shipping_updated_by = v_actor, updated_at = now()
    where id = p_participation_id;
  end if;

  perform public._admin_log('shipping.' || p_action, 'order', p_participation_id::text, v_fp.partner_order_id,
    jsonb_build_object('shipping_status', v_fp.shipping_status, 'courier', v_fp.courier, 'tracking_number', v_fp.tracking_number),
    (select jsonb_build_object('shipping_status', shipping_status, 'courier', courier, 'tracking_number', tracking_number)
     from public.funding_participations where id = p_participation_id),
    p_note);

  return (select jsonb_build_object('shipping_status', shipping_status, 'tracking_number', tracking_number)
          from public.funding_participations where id = p_participation_id);
end;
$$;

create or replace function public.admin_bulk_update_shipments(p_participation_ids uuid[], p_action text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ok integer := 0;
  v_failed jsonb := '[]'::jsonb;
begin
  perform public._admin_require('shipping.manage');
  if p_action not in ('ship', 'deliver') then
    raise exception '일괄 처리는 배송중/배송완료만 지원합니다.';
  end if;
  if cardinality(coalesce(p_participation_ids, '{}'::uuid[])) > 500 then
    raise exception '한 번에 최대 500건까지 처리할 수 있습니다.';
  end if;
  foreach v_id in array coalesce(p_participation_ids, '{}'::uuid[]) loop
    begin
      perform public.admin_update_shipment(v_id, p_action, null, null, p_note, true);
      v_ok := v_ok + 1;
    exception when others then
      v_failed := v_failed || jsonb_build_object('id', v_id, 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('updated', v_ok, 'failed', v_failed);
end;
$$;

create or replace function public.admin_shipping_progress()
returns table (
  funding_id uuid,
  product_name text,
  brand_name text,
  production_status text,
  total_orders integer,
  preparing integer,
  invoiced integer,
  shipped integer,
  delivered integer,
  progress numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_require('shipping.view');
  return query
  select f.id, f.product_name, b.brand_name, f.production_status,
    count(fp.id)::integer,
    count(fp.id) filter (where fp.shipping_status = 'preparing' and fp.tracking_number is null)::integer,
    count(fp.id) filter (where fp.shipping_status = 'preparing' and fp.tracking_number is not null)::integer,
    count(fp.id) filter (where fp.shipping_status = 'shipped')::integer,
    count(fp.id) filter (where fp.shipping_status = 'delivered')::integer,
    case when count(fp.id) > 0
      then round(count(fp.id) filter (where fp.shipping_status = 'delivered')::numeric * 100 / count(fp.id), 1)
      else 0 end
  from public.fundings f
  join public.funding_participations fp on fp.funding_id = f.id
    and fp.status <> 'cancelled' and fp.payment_status = 'paid'
  left join public.brands b on b.id = f.brand_id
  where f.production_status is not null or fp.shipping_status <> 'preparing' or fp.tracking_number is not null
  group by f.id, b.brand_name
  order by f.production_updated_at desc nulls last;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. 콘텐츠 / 신고 / CS
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_reports(p_status text default 'all')
returns table (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  target_type text,
  target_id uuid,
  target_summary text,
  target_state text,
  reason text,
  status text,
  resolution_note text,
  action_taken text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_require('content.view');
  return query
  select r.id, r.reporter_id, coalesce(nullif(pr.username, ''), nullif(pr.full_name, ''), 'BRAND-ER'),
    r.target_type, r.target_id,
    case r.target_type
      when 'post' then (select p.title from public.community_posts p where p.id = r.target_id)
      when 'comment' then (select left(coalesce(nullif(c.content, ''), c.deleted_content, ''), 120) from public.community_comments c where c.id = r.target_id)
      when 'user' then (select coalesce(nullif(u.username, ''), u.full_name) from public.profiles u where u.id = r.target_id)
    end,
    case r.target_type
      when 'post' then (select p.moderation_status from public.community_posts p where p.id = r.target_id)
      when 'comment' then (select case when c.is_deleted then 'deleted' else 'visible' end from public.community_comments c where c.id = r.target_id)
      when 'user' then (select u.account_status from public.profiles u where u.id = r.target_id)
    end,
    r.reason, r.status, r.resolution_note, r.action_taken,
    case when r.reviewed_by is null then null else public._admin_display_name(r.reviewed_by) end,
    r.reviewed_at, r.created_at
  from public.community_reports r
  left join public.profiles pr on pr.id = r.reporter_id
  where coalesce(p_status, 'all') = 'all' or r.status = p_status
  order by case when r.status = 'pending' then 0 else 1 end, r.created_at desc;
end;
$$;

create or replace function public.admin_moderate_post(p_post_id uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.manage');
  v_reason text := case when p_status = 'visible' then nullif(btrim(coalesce(p_reason, '')), '') else public._require_reason(p_reason, '처리 사유') end;
  v_post public.community_posts%rowtype;
begin
  if p_status not in ('visible', 'hidden', 'removed') then
    raise exception '올바르지 않은 게시물 상태입니다.';
  end if;
  select * into v_post from public.community_posts where id = p_post_id for update;
  if not found then
    raise exception '게시물을 찾을 수 없습니다.';
  end if;

  -- removed 도 soft delete(행 보존)이다.
  update public.community_posts
  set moderation_status = p_status, admin_note = coalesce(v_reason, admin_note),
      moderated_at = now(), moderated_by = v_actor, moderation_reason = v_reason, updated_at = now()
  where id = p_post_id;

  perform public._admin_log('content.post_' || p_status, 'community_post', p_post_id::text, v_post.title,
    jsonb_build_object('moderation_status', v_post.moderation_status), jsonb_build_object('moderation_status', p_status), v_reason);
  if p_status <> 'visible' then
    perform public._admin_notify(v_post.user_id,
      format('[게시물 %s] ''%s'' 게시물이 운영 정책에 따라 %s 처리되었습니다. 사유: %s',
        case when p_status = 'hidden' then '숨김' else '삭제' end, v_post.title,
        case when p_status = 'hidden' then '숨김' else '삭제' end, v_reason));
  end if;
  return jsonb_build_object('moderation_status', p_status);
end;
$$;

create or replace function public.admin_list_comments(p_search text default null, p_include_deleted boolean default true, p_limit integer default 200)
returns table (
  id uuid,
  post_id uuid,
  post_title text,
  user_id uuid,
  author_name text,
  content text,
  is_deleted boolean,
  deleted_reason text,
  deleted_at timestamptz,
  deleted_by_name text,
  like_count integer,
  report_count integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.view');
  v_full boolean := public._admin_has_permission(v_actor, 'content.manage');
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  return query
  select c.id, c.post_id, p.title, c.user_id, c.author_name,
    case when c.is_deleted and v_full then coalesce(c.deleted_content, '') else c.content end,
    c.is_deleted, c.deleted_reason, c.deleted_at,
    case when c.deleted_by is null then null else public._admin_display_name(c.deleted_by) end,
    c.like_count,
    (select count(*)::integer from public.community_reports r where r.target_type = 'comment' and r.target_id = c.id),
    c.created_at
  from public.community_comments c
  join public.community_posts p on p.id = c.post_id
  where (coalesce(p_include_deleted, true) or not c.is_deleted)
    and (v_search is null or c.content ilike '%' || v_search || '%' or c.author_name ilike '%' || v_search || '%'
      or p.title ilike '%' || v_search || '%')
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

create or replace function public.admin_soft_delete_comment(p_comment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.manage');
  v_reason text := public._require_reason(p_reason, '삭제 사유');
  v_c public.community_comments%rowtype;
begin
  select * into v_c from public.community_comments where id = p_comment_id for update;
  if not found then
    raise exception '댓글을 찾을 수 없습니다.';
  end if;
  if v_c.is_deleted then
    raise exception '이미 삭제된 댓글입니다.';
  end if;

  update public.community_comments
  set is_deleted = true, deleted_content = v_c.content, content = '',
      deleted_at = now(), deleted_by = v_actor, deleted_reason = v_reason, updated_at = now()
  where id = p_comment_id;
  update public.community_posts set comment_count = greatest(comment_count - 1, 0) where id = v_c.post_id;

  perform public._admin_log('content.comment_delete', 'community_comment', p_comment_id::text, left(v_c.content, 80),
    jsonb_build_object('is_deleted', false), jsonb_build_object('is_deleted', true), v_reason);
  return jsonb_build_object('is_deleted', true);
end;
$$;

create or replace function public.admin_restore_comment(p_comment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.manage');
  v_reason text := public._require_reason(p_reason, '복구 사유');
  v_c public.community_comments%rowtype;
begin
  select * into v_c from public.community_comments where id = p_comment_id for update;
  if not found or not v_c.is_deleted then
    raise exception '삭제된 댓글이 아닙니다.';
  end if;
  if v_c.deleted_content is null then
    raise exception '작성자가 직접 삭제한 댓글은 원문이 없어 복구할 수 없습니다.';
  end if;

  update public.community_comments
  set is_deleted = false, content = v_c.deleted_content, deleted_content = null,
      deleted_at = null, deleted_by = null, deleted_reason = null, updated_at = now()
  where id = p_comment_id;
  update public.community_posts set comment_count = comment_count + 1 where id = v_c.post_id;

  perform public._admin_log('content.comment_restore', 'community_comment', p_comment_id::text, left(v_c.deleted_content, 80),
    jsonb_build_object('is_deleted', true), jsonb_build_object('is_deleted', false), v_reason);
  return jsonb_build_object('is_deleted', false);
end;
$$;

create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_status text,
  p_note text default null,
  p_action text default 'none'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('reports.manage');
  v_r public.community_reports%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_status not in ('reviewed', 'dismissed') then
    raise exception '처리 완료(reviewed) 또는 기각(dismissed)만 선택할 수 있습니다.';
  end if;
  if coalesce(p_action, 'none') not in ('none', 'hide_post', 'remove_post', 'delete_comment', 'restrict_user') then
    raise exception '올바르지 않은 조치 유형입니다.';
  end if;
  select * into v_r from public.community_reports where id = p_report_id for update;
  if not found then
    raise exception '신고를 찾을 수 없습니다.';
  end if;

  if p_action in ('hide_post', 'remove_post') then
    if v_r.target_type <> 'post' then raise exception '게시물 신고에만 게시물 조치를 적용할 수 있습니다.'; end if;
    perform public.admin_moderate_post(v_r.target_id, case when p_action = 'hide_post' then 'hidden' else 'removed' end,
      coalesce(v_note, '신고 처리'));
  elsif p_action = 'delete_comment' then
    if v_r.target_type <> 'comment' then raise exception '댓글 신고에만 댓글 삭제를 적용할 수 있습니다.'; end if;
    perform public.admin_soft_delete_comment(v_r.target_id, coalesce(v_note, '신고 처리'));
  elsif p_action = 'restrict_user' then
    if v_r.target_type <> 'user' then raise exception '회원 신고에만 이용 제한을 적용할 수 있습니다.'; end if;
    perform public.admin_set_member_status(v_r.target_id, 'restricted', coalesce(v_note, '신고 처리'));
  end if;

  update public.community_reports
  set status = p_status, reviewed_at = now(), reviewed_by = v_actor,
      resolution_note = v_note, action_taken = coalesce(p_action, 'none')
  where id = p_report_id;

  perform public._admin_log('report.' || p_status, 'community_report', p_report_id::text, v_r.target_type,
    jsonb_build_object('status', v_r.status), jsonb_build_object('status', p_status, 'action', p_action), v_note);
  return jsonb_build_object('status', p_status, 'action', p_action);
end;
$$;

create or replace function public.admin_list_cs_tickets(
  p_status text default 'all',
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  participation_id uuid,
  order_number text,
  funding_id uuid,
  category text,
  subject text,
  content text,
  status text,
  priority text,
  assigned_to uuid,
  assigned_to_name text,
  admin_memo text,
  source text,
  resolved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('cs.view');
  return query
  select t.id, t.user_id, coalesce(nullif(p.full_name, ''), nullif(p.username, ''), '회원'), u.email::text,
    t.participation_id, fp.partner_order_id, t.funding_id, t.category, t.subject, t.content, t.status, t.priority,
    t.assigned_to, case when t.assigned_to is null then null else public._admin_display_name(t.assigned_to) end,
    t.admin_memo, t.source, t.resolved_at, t.created_at, t.updated_at,
    count(*) over ()
  from public.cs_tickets t
  left join public.profiles p on p.id = t.user_id
  left join auth.users u on u.id = t.user_id
  left join public.funding_participations fp on fp.id = t.participation_id
  where (coalesce(p_status, 'all') = 'all'
      or (p_status = 'active' and t.status in ('open', 'in_progress', 'waiting_customer'))
      or t.status = p_status)
    and (v_search is null or t.subject ilike '%' || v_search || '%' or t.content ilike '%' || v_search || '%'
      or u.email ilike '%' || v_search || '%' or fp.partner_order_id ilike '%' || v_search || '%')
  order by case t.priority when 'urgent' then 0 when 'high' then 1 else 2 end, t.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_create_cs_ticket(
  p_user_email text,
  p_category text,
  p_subject text,
  p_content text,
  p_order_number text default null,
  p_priority text default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('cs.manage');
  v_user_id uuid;
  v_participation public.funding_participations%rowtype;
  v_id uuid;
begin
  if nullif(btrim(coalesce(p_user_email, '')), '') is not null then
    select id into v_user_id from auth.users where lower(email) = lower(btrim(p_user_email));
    if v_user_id is null then
      raise exception '해당 이메일의 회원을 찾을 수 없습니다.';
    end if;
  end if;
  if nullif(btrim(coalesce(p_order_number, '')), '') is not null then
    select * into v_participation from public.funding_participations where partner_order_id = btrim(p_order_number);
    if v_participation.id is null then
      raise exception '주문번호를 찾을 수 없습니다.';
    end if;
    v_user_id := coalesce(v_user_id, v_participation.participant_id);
  end if;

  insert into public.cs_tickets (user_id, participation_id, funding_id, category, subject, content, priority, source, created_by, assigned_to)
  values (v_user_id, v_participation.id, v_participation.funding_id, coalesce(p_category, 'other'), btrim(p_subject), btrim(p_content),
    coalesce(p_priority, 'normal'), 'admin', v_actor, v_actor)
  returning id into v_id;

  perform public._admin_log('cs.create', 'cs_ticket', v_id::text, btrim(p_subject), null,
    jsonb_build_object('category', p_category, 'priority', p_priority), null);
  return v_id;
end;
$$;

create or replace function public.admin_update_cs_ticket(
  p_ticket_id uuid,
  p_status text,
  p_admin_memo text default null,
  p_priority text default null,
  p_assign_to_me boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('cs.manage');
  v_t public.cs_tickets%rowtype;
begin
  if p_status not in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed') then
    raise exception '올바르지 않은 CS 처리 상태입니다.';
  end if;
  select * into v_t from public.cs_tickets where id = p_ticket_id for update;
  if not found then
    raise exception '문의를 찾을 수 없습니다.';
  end if;

  update public.cs_tickets
  set status = p_status,
      admin_memo = coalesce(nullif(btrim(coalesce(p_admin_memo, '')), ''), admin_memo),
      priority = coalesce(p_priority, priority),
      assigned_to = case when coalesce(p_assign_to_me, false) then v_actor else assigned_to end,
      resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end,
      updated_at = now()
  where id = p_ticket_id;

  perform public._admin_log('cs.status_change', 'cs_ticket', p_ticket_id::text, v_t.subject,
    jsonb_build_object('status', v_t.status, 'priority', v_t.priority),
    jsonb_build_object('status', p_status, 'priority', coalesce(p_priority, v_t.priority)), p_admin_memo);
  return jsonb_build_object('status', p_status);
end;
$$;

-- 고객 문의 접수(향후 고객센터 UI 연동용)
create or replace function public.create_my_cs_ticket(
  p_category text,
  p_subject text,
  p_content text,
  p_participation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_funding_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_participation_id is not null then
    select funding_id into v_funding_id from public.funding_participations
    where id = p_participation_id and participant_id = auth.uid();
    if v_funding_id is null then
      raise exception '본인 주문만 문의에 연결할 수 있습니다.';
    end if;
  end if;
  insert into public.cs_tickets (user_id, participation_id, funding_id, category, subject, content, source, created_by)
  values (auth.uid(), p_participation_id, v_funding_id, coalesce(p_category, 'other'), btrim(p_subject), btrim(p_content), 'customer', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.list_my_cs_tickets()
returns table (id uuid, category text, subject text, content text, status text, created_at timestamptz, resolved_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.category, t.subject, t.content, t.status, t.created_at, t.resolved_at
  from public.cs_tickets t
  where t.user_id = auth.uid()
  order by t.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 12. 공지 / 알림
-- ---------------------------------------------------------------------------

create or replace function public._notification_audience(p_target_type text, p_target_ref text)
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ref text := nullif(btrim(coalesce(p_target_ref, '')), '');
begin
  if p_target_type = 'all_members' then
    return query
    select u.id from auth.users u
    left join public.profiles p on p.id = u.id
    where coalesce(p.account_status, 'active') <> 'archived';
  elsif p_target_type = 'member' then
    if v_ref is null then
      raise exception '대상 회원의 이메일 또는 회원 ID 를 입력해주세요.';
    end if;
    return query
    select u.id from auth.users u
    where u.id::text = v_ref or lower(u.email) = lower(v_ref);
  elsif p_target_type = 'funding_participants' then
    if v_ref is null then
      raise exception '대상 펀딩을 선택해주세요.';
    end if;
    return query
    select distinct fp.participant_id from public.funding_participations fp
    where fp.funding_id::text = v_ref and fp.status <> 'cancelled' and fp.payment_status in ('paid', 'unpaid');
  elsif p_target_type = 'brand_followers' then
    if v_ref is null then
      raise exception '대상 브랜드를 선택해주세요.';
    end if;
    return query
    select distinct cf.follower_id from public.community_follows cf
    join public.brands b on b.owner_user_id = cf.following_id
    where b.id::text = v_ref;
  elsif p_target_type = 'creators' then
    return query select c.user_id from public.creator_profiles c;
  else
    raise exception '올바르지 않은 발송 대상입니다.';
  end if;
end;
$$;

revoke all on function public._notification_audience(text, text) from public, anon, authenticated;

create or replace function public.admin_preview_notification_audience(p_target_type text, p_target_ref text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_require('notifications.send');
  return (select count(distinct a.user_id)::integer from public._notification_audience(p_target_type, p_target_ref) a);
end;
$$;

create or replace function public.admin_send_notification(
  p_title text,
  p_message text,
  p_category text,
  p_target_type text,
  p_target_ref text default null,
  p_funding_id uuid default null,
  p_channels text[] default array['site']::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('notifications.send');
  v_title text := btrim(coalesce(p_title, ''));
  v_message text := btrim(coalesce(p_message, ''));
  v_channels jsonb := coalesce((select value from public.platform_settings where key = 'notification_channels'), '{}'::jsonb);
  v_external jsonb := '{}'::jsonb;
  v_channel text;
  v_count integer := 0;
  v_campaign_id uuid;
  v_funding_id uuid := p_funding_id;
begin
  if char_length(v_title) < 1 or char_length(v_title) > 80 then
    raise exception '제목은 1~80자로 입력해주세요.';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 900 then
    raise exception '내용은 1~900자로 입력해주세요.';
  end if;
  if p_target_type = 'funding_participants' and v_funding_id is null then
    v_funding_id := nullif(p_target_ref, '')::uuid;
  end if;

  -- 외부 채널은 연동 전이면 not_integrated 로만 기록하고 발송된 것처럼 처리하지 않는다.
  foreach v_channel in array coalesce(p_channels, array['site']::text[]) loop
    if v_channel <> 'site' then
      v_external := v_external || jsonb_build_object(v_channel,
        case when coalesce((v_channels ->> v_channel)::boolean, false) then 'queued_pending_provider' else 'not_integrated' end);
    end if;
  end loop;

  insert into public.admin_notification_campaigns (
    title, message, category, target_type, target_ref, funding_id, requested_channels, external_delivery, created_by
  ) values (
    v_title, v_message, coalesce(p_category, 'announcement'), p_target_type, nullif(btrim(coalesce(p_target_ref, '')), ''),
    v_funding_id, coalesce(p_channels, array['site']::text[]), v_external, v_actor
  ) returning id into v_campaign_id;

  insert into public.community_notifications (recipient_id, actor_id, type, funding_id, message)
  select distinct a.user_id, v_actor, 'admin_notice', v_funding_id, left('[' || v_title || '] ' || v_message, 1000)
  from public._notification_audience(p_target_type, p_target_ref) a
  where a.user_id is not null;
  get diagnostics v_count = row_count;

  update public.admin_notification_campaigns set site_recipient_count = v_count where id = v_campaign_id;

  perform public._admin_log('notification.send', 'notification_campaign', v_campaign_id::text, v_title, null,
    jsonb_build_object('target_type', p_target_type, 'target_ref', p_target_ref, 'recipients', v_count, 'external', v_external),
    null);

  return jsonb_build_object('campaign_id', v_campaign_id, 'site_recipients', v_count, 'external_delivery', v_external);
end;
$$;

create or replace function public.admin_list_notification_campaigns(p_limit integer default 100)
returns table (
  id uuid,
  title text,
  message text,
  category text,
  target_type text,
  target_ref text,
  site_recipient_count integer,
  requested_channels text[],
  external_delivery jsonb,
  created_by_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._admin_require('notifications.send');
  return query
  select c.id, c.title, c.message, c.category, c.target_type, c.target_ref, c.site_recipient_count,
    c.requested_channels, c.external_delivery,
    case when c.created_by is null then null else public._admin_display_name(c.created_by) end,
    c.created_at
  from public.admin_notification_campaigns c
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. 통계
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_analytics(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('analytics.view');
  v_finance boolean := public._admin_has_permission(v_actor, 'finance.view');
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  v_rate numeric := public._platform_setting_numeric('platform_commission_rate', 10);
  v_totals jsonb;
  v_series jsonb;
  v_rank jsonb;
  v_reviewed integer;
  v_approved integer;
  v_orders integer;
  v_gmv bigint;
  v_refund bigint;
  v_visitors bigint;
  v_buyers bigint;
  v_ended integer;
  v_succeeded integer;
begin
  if v_to <= v_from then
    raise exception '조회 기간이 올바르지 않습니다.';
  end if;

  select count(*) filter (where status in ('approved', 'rejected', 'closed')),
         count(*) filter (where status in ('approved', 'closed'))
  into v_reviewed, v_approved
  from public.fundings where reviewed_at >= v_from and reviewed_at < v_to;

  select count(*), coalesce(sum(total_amount), 0) into v_orders, v_gmv
  from public.funding_participations where payment_approved_at >= v_from and payment_approved_at < v_to;

  select coalesce(sum(total_amount), 0) into v_refund
  from public.funding_participations
  where payment_status = 'cancelled' and payment_approved_at is not null
    and payment_cancelled_at >= v_from and payment_cancelled_at < v_to;

  select count(distinct visitor_id) into v_visitors
  from public.site_visit_sessions where last_seen_at >= v_from and started_at < v_to;

  select count(distinct participant_id) into v_buyers
  from public.funding_participations where payment_approved_at >= v_from and payment_approved_at < v_to;

  select count(*) filter (where phase in ('succeeded', 'failed', 'in_production', 'shipping', 'completed')),
         count(*) filter (where phase in ('succeeded', 'in_production', 'shipping', 'completed'))
  into v_ended, v_succeeded
  from (
    select public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days,
      f.current_orders, f.moq, f.production_status) as phase
    from public.fundings f
    where public._funding_end_at(f.reviewed_at, f.funding_days) >= v_from
      and public._funding_end_at(f.reviewed_at, f.funding_days) < v_to
  ) x;

  v_totals := jsonb_build_object(
    'dau', (select count(distinct visitor_id) from public.site_visit_sessions where last_seen_at >= now() - interval '1 day'),
    'wau', (select count(distinct visitor_id) from public.site_visit_sessions where last_seen_at >= now() - interval '7 days'),
    'mau', (select count(distinct visitor_id) from public.site_visit_sessions where last_seen_at >= now() - interval '30 days'),
    'dau_members', (select count(distinct user_id) from public.site_visit_sessions where user_id is not null and last_seen_at >= now() - interval '1 day'),
    'mau_members', (select count(distinct user_id) from public.site_visit_sessions where user_id is not null and last_seen_at >= now() - interval '30 days'),
    'new_signups', (select count(*) from auth.users where created_at >= v_from and created_at < v_to),
    'new_creators', (select count(*) from public.creator_profiles where created_at >= v_from and created_at < v_to),
    'new_brands', (select count(*) from public.brands where created_at >= v_from and created_at < v_to),
    'fundings_created', (select count(*) from public.fundings where created_at >= v_from and created_at < v_to),
    'funding_approval_rate', case when v_reviewed > 0 then round(v_approved::numeric * 100 / v_reviewed, 1) else null end,
    'funding_success_rate', case when v_ended > 0 then round(v_succeeded::numeric * 100 / v_ended, 1) else null end,
    'participants', v_buyers,
    'orders', v_orders,
    'visitors', v_visitors,
    'conversion_rate', case when v_visitors > 0 then round(v_buyers::numeric * 100 / v_visitors, 2) else null end
  );

  if v_finance then
    v_totals := v_totals || jsonb_build_object(
      'gmv', v_gmv,
      'refunds', v_refund,
      'net_sales', v_gmv - v_refund,
      'platform_revenue', round((v_gmv - v_refund) * v_rate / 100),
      'commission_rate', v_rate,
      'aov', case when v_orders > 0 then round(v_gmv::numeric / v_orders) else null end,
      'refund_rate', case when v_gmv > 0 then round(v_refund::numeric * 100 / v_gmv, 2) else null end
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', to_char(d.day, 'YYYY-MM-DD'),
    'dau', (select count(distinct s.visitor_id) from public.site_visit_sessions s where public._kst_date(s.last_seen_at) = d.day),
    'signups', (select count(*) from auth.users u where public._kst_date(u.created_at) = d.day),
    'creators', (select count(*) from public.creator_profiles c where public._kst_date(c.created_at) = d.day),
    'fundings_created', (select count(*) from public.fundings f where public._kst_date(f.created_at) = d.day),
    'orders', (select count(*) from public.funding_participations fp where public._kst_date(fp.payment_approved_at) = d.day),
    'gmv', case when v_finance then (select coalesce(sum(fp.total_amount), 0) from public.funding_participations fp where public._kst_date(fp.payment_approved_at) = d.day) end,
    'refunds', case when v_finance then (select coalesce(sum(fp.total_amount), 0) from public.funding_participations fp where fp.payment_status = 'cancelled' and public._kst_date(fp.payment_cancelled_at) = d.day) end
  ) order by d.day), '[]'::jsonb)
  into v_series
  from generate_series(public._kst_date(v_from), public._kst_date(v_to - interval '1 second'), interval '1 day') as d(day);

  v_rank := jsonb_build_object(
    'brands', coalesce((
      select jsonb_agg(x) from (
        select b.id, b.brand_name as name,
          count(fp.id) as orders,
          case when v_finance then coalesce(sum(fp.total_amount), 0) end as gmv,
          coalesce(sum(fp.quantity), 0) as quantity
        from public.funding_participations fp
        join public.fundings f on f.id = fp.funding_id
        join public.brands b on b.id = f.brand_id
        where fp.payment_status = 'paid' and fp.status <> 'cancelled'
          and fp.payment_approved_at >= v_from and fp.payment_approved_at < v_to
        group by b.id, b.brand_name
        order by coalesce(sum(fp.total_amount), 0) desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'fundings', coalesce((
      select jsonb_agg(x) from (
        select f.id, f.product_name as name,
          count(fp.id) as orders,
          case when v_finance then coalesce(sum(fp.total_amount), 0) end as gmv,
          coalesce(sum(fp.quantity), 0) as quantity,
          case when f.moq > 0 then round(f.current_orders::numeric * 100 / f.moq, 1) else 0 end as achievement_rate
        from public.funding_participations fp
        join public.fundings f on f.id = fp.funding_id
        where fp.payment_status = 'paid' and fp.status <> 'cancelled'
          and fp.payment_approved_at >= v_from and fp.payment_approved_at < v_to
        group by f.id
        order by coalesce(sum(fp.total_amount), 0) desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'creators', coalesce((
      select jsonb_agg(x) from (
        select c.user_id as id, c.display_name as name,
          count(distinct f.id) as fundings,
          count(fp.id) as orders,
          case when v_finance then coalesce(sum(fp.total_amount), 0) end as gmv,
          count(distinct fp.participant_id) as participants
        from public.creator_profiles c
        join public.fundings f on f.creator_id = c.user_id
        join public.funding_participations fp on fp.funding_id = f.id
          and fp.payment_status = 'paid' and fp.status <> 'cancelled'
          and fp.payment_approved_at >= v_from and fp.payment_approved_at < v_to
        group by c.user_id, c.display_name
        order by coalesce(sum(fp.total_amount), 0) desc
        limit 10
      ) x
    ), '[]'::jsonb)
  );

  return jsonb_build_object('from', v_from, 'to', v_to, 'finance_visible', v_finance,
    'totals', v_totals, 'series', v_series, 'rankings', v_rank);
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. 실행 권한 정리
-- ---------------------------------------------------------------------------

do $$
declare
  v_fn regprocedure;
begin
  -- 관리자 RPC: 로그인 사용자만 호출 가능(내부에서 권한 재검증)
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'admin\_%' or p.proname in (
        'request_my_refund', 'creator_update_production_stage', 'list_funding_production_logs',
        'create_my_cs_ticket', 'list_my_cs_tickets'
      ))
      and p.proname <> 'admin_role_permissions'
  loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;

  -- 내부 헬퍼: 클라이언트 직접 호출 금지
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        '_admin_notify', '_admin_cancel_participation', '_create_refund_request', '_settlement_figures',
        '_settlement_recalculate', '_apply_production_stage', '_notification_audience', '_funding_phase',
        '_order_state', '_production_stage_rank', '_production_stage_to_participation', '_production_stage_label',
        '_mask_phone', '_mask_name', '_mask_address', '_funding_end_at', '_kst_date', '_require_reason'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
