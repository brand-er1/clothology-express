create table if not exists public.site_visit_sessions (
  session_id uuid primary key,
  visitor_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  entry_path text not null default '/',
  last_path text not null default '/',
  referrer text,
  device_type text not null default 'unknown'
    check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  browser text not null default 'unknown',
  page_view_count integer not null default 1
    check (page_view_count >= 0)
);

create index if not exists site_visit_sessions_user_last_seen_idx
  on public.site_visit_sessions (user_id, last_seen_at desc);

create index if not exists site_visit_sessions_visitor_last_seen_idx
  on public.site_visit_sessions (visitor_id, last_seen_at desc);

create index if not exists site_visit_sessions_last_seen_idx
  on public.site_visit_sessions (last_seen_at desc);

alter table public.site_visit_sessions enable row level security;

revoke all on table public.site_visit_sessions from anon, authenticated;

create or replace function public.track_site_visit(
  p_session_id uuid,
  p_visitor_id uuid,
  p_path text,
  p_referrer text default null,
  p_device_type text default 'unknown',
  p_browser text default 'unknown',
  p_is_page_view boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_path text := left(coalesce(nullif(trim(p_path), ''), '/'), 300);
  v_referrer text := nullif(left(trim(coalesce(p_referrer, '')), 500), '');
  v_device_type text := case
    when p_device_type in ('desktop', 'mobile', 'tablet') then p_device_type
    else 'unknown'
  end;
  v_browser text := left(coalesce(nullif(trim(p_browser), ''), 'unknown'), 50);
begin
  if p_session_id is null or p_visitor_id is null then
    return;
  end if;

  -- 운영자가 사이트를 확인한 기록은 고객 통계에서 제외합니다.
  if v_user_id is not null and public.is_admin(v_user_id) then
    delete from public.site_visit_sessions
    where visitor_id = p_visitor_id
      and user_id is null;
    return;
  end if;

  insert into public.site_visit_sessions (
    session_id,
    visitor_id,
    user_id,
    entry_path,
    last_path,
    referrer,
    device_type,
    browser,
    page_view_count
  ) values (
    p_session_id,
    p_visitor_id,
    v_user_id,
    v_path,
    v_path,
    v_referrer,
    v_device_type,
    v_browser,
    case when coalesce(p_is_page_view, true) then 1 else 0 end
  )
  on conflict (session_id) do update
  set
    user_id = coalesce(v_user_id, site_visit_sessions.user_id),
    last_seen_at = now(),
    last_path = v_path,
    device_type = v_device_type,
    browser = v_browser,
    page_view_count = site_visit_sessions.page_view_count
      + case when coalesce(p_is_page_view, true) then 1 else 0 end;

  -- 로그인 전 익명 방문 기록도 같은 브라우저의 회원 기록으로 연결합니다.
  if v_user_id is not null then
    update public.site_visit_sessions
    set user_id = v_user_id
    where visitor_id = p_visitor_id
      and user_id is null;
  end if;
end;
$$;

revoke all on function public.track_site_visit(uuid, uuid, text, text, text, text, boolean) from public;
grant execute on function public.track_site_visit(uuid, uuid, text, text, text, text, boolean)
  to anon, authenticated;

create or replace function public.get_admin_customer_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_start timestamptz :=
    (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  v_registered_customers bigint;
  v_today_visitors bigint;
  v_active_now bigint;
  v_repeat_visitors bigint;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  select count(*)
  into v_registered_customers
  from auth.users auth_user
  where not public.is_admin(auth_user.id);

  select count(distinct visitor_id)
  into v_today_visitors
  from public.site_visit_sessions
  where last_seen_at >= v_today_start;

  select count(distinct visitor_id)
  into v_active_now
  from public.site_visit_sessions
  where last_seen_at >= now() - interval '5 minutes';

  select count(*)
  into v_repeat_visitors
  from (
    select visitor_id
    from public.site_visit_sessions
    group by visitor_id
    having count(*) >= 2
  ) repeated;

  return jsonb_build_object(
    'registered_customers', v_registered_customers,
    'today_visitors', v_today_visitors,
    'active_now', v_active_now,
    'repeat_visitors', v_repeat_visitors
  );
end;
$$;

revoke all on function public.get_admin_customer_overview() from public;
grant execute on function public.get_admin_customer_overview() to authenticated;

create or replace function public.get_admin_customers()
returns table (
  user_id uuid,
  email text,
  username text,
  full_name text,
  phone_number text,
  account_type text,
  brand_name text,
  address text,
  signed_up_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz,
  last_path text,
  session_count bigint,
  page_view_count bigint,
  generated_image_count bigint,
  order_count bigint,
  funding_count bigint,
  participation_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return query
  select
    auth_user.id,
    auth_user.email::text,
    profile.username,
    profile.full_name,
    profile.phone_number,
    coalesce(profile.account_type, 'buyer'),
    profile.brand_name,
    profile.address,
    auth_user.created_at,
    auth_user.last_sign_in_at,
    visit.last_seen_at,
    visit.last_path,
    coalesce(visit.session_count, 0),
    coalesce(visit.page_view_count, 0),
    coalesce(generated.generated_image_count, 0),
    coalesce(production_order.order_count, 0),
    coalesce(funding.funding_count, 0),
    coalesce(participation.participation_count, 0)
  from auth.users auth_user
  left join public.profiles profile on profile.id = auth_user.id
  left join (
    select
      session.user_id,
      max(session.last_seen_at) as last_seen_at,
      (array_agg(session.last_path order by session.last_seen_at desc))[1] as last_path,
      count(*) as session_count,
      sum(session.page_view_count)::bigint as page_view_count
    from public.site_visit_sessions session
    where session.user_id is not null
    group by session.user_id
  ) visit on visit.user_id = auth_user.id
  left join (
    select image.user_id, count(*) as generated_image_count
    from public.generated_images image
    where image.user_id is not null
    group by image.user_id
  ) generated on generated.user_id = auth_user.id
  left join (
    select customer_order.user_id, count(*) as order_count
    from public.orders customer_order
    where customer_order.user_id is not null
      and customer_order.status <> 'deleted'
    group by customer_order.user_id
  ) production_order on production_order.user_id = auth_user.id
  left join (
    select creator_id, count(*) as funding_count
    from public.fundings
    group by creator_id
  ) funding on funding.creator_id = auth_user.id
  left join (
    select participant_id, count(*) as participation_count
    from public.funding_participations
    group by participant_id
  ) participation on participation.participant_id = auth_user.id
  where not public.is_admin(auth_user.id)
  order by coalesce(visit.last_seen_at, auth_user.last_sign_in_at, auth_user.created_at) desc;
end;
$$;

revoke all on function public.get_admin_customers() from public;
grant execute on function public.get_admin_customers() to authenticated;

create or replace function public.get_admin_visit_sessions(p_limit integer default 200)
returns table (
  session_id uuid,
  visitor_id uuid,
  user_id uuid,
  email text,
  display_name text,
  account_type text,
  started_at timestamptz,
  last_seen_at timestamptz,
  entry_path text,
  last_path text,
  referrer text,
  device_type text,
  browser text,
  page_view_count integer,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return query
  select
    visit.session_id,
    visit.visitor_id,
    visit.user_id,
    auth_user.email::text,
    coalesce(
      nullif(profile.brand_name, ''),
      nullif(profile.username, ''),
      nullif(profile.full_name, ''),
      auth_user.email::text,
      '게스트 ' || left(visit.visitor_id::text, 8)
    ) as display_name,
    profile.account_type,
    visit.started_at,
    visit.last_seen_at,
    visit.entry_path,
    visit.last_path,
    visit.referrer,
    visit.device_type,
    visit.browser,
    visit.page_view_count,
    visit.last_seen_at >= now() - interval '5 minutes' as is_active
  from public.site_visit_sessions visit
  left join auth.users auth_user on auth_user.id = visit.user_id
  left join public.profiles profile on profile.id = visit.user_id
  order by visit.last_seen_at desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

revoke all on function public.get_admin_visit_sessions(integer) from public;
grant execute on function public.get_admin_visit_sessions(integer) to authenticated;
