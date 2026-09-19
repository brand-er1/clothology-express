-- Recreates a migration that was applied directly to the production database without a
-- committed file, which left the remote migration history referencing a version
-- ("20260901055035") that `supabase db push` could not find locally and refused to proceed
-- past. Restores repo/schema parity for the `get_admin_visit_analytics` RPC backing
-- VisitorAnalyticsDashboard.tsx (added in the same release). Uses `create or replace` so
-- re-applying it is a no-op against the already-live function.

create or replace function public.get_admin_visit_analytics(
  p_months integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_months integer := case when p_months in (1, 3, 6) then p_months else 1 end;
  v_end_date date := (now() at time zone 'Asia/Seoul')::date;
  v_start_date date := v_end_date - (v_months * interval '1 month')::interval + interval '1 day';
  v_total_sessions bigint;
  v_unique_visitors bigint;
  v_page_views bigint;
  v_daily jsonb;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  select count(*)
  into v_total_sessions
  from public.site_visit_sessions session
  where session.started_at >= v_start_date
    and session.started_at < v_end_date + 1;

  select count(distinct session.visitor_id)
  into v_unique_visitors
  from public.site_visit_sessions session
  where session.started_at >= v_start_date
    and session.started_at < v_end_date + 1;

  select count(*)
  into v_page_views
  from public.site_visit_events event
  where event.event_name = 'page_view'
    and event.created_at >= v_start_date
    and event.created_at < v_end_date + 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', to_char(day, 'YYYY-MM-DD'),
      'sessions', coalesce(daily_sessions.sessions, 0),
      'unique_visitors', coalesce(daily_sessions.unique_visitors, 0),
      'page_views', coalesce(daily_events.page_views, 0)
    ) order by day
  ), '[]'::jsonb)
  into v_daily
  from generate_series(v_start_date, v_end_date, interval '1 day') as day
  left join lateral (
    select
      count(*) as sessions,
      count(distinct session.visitor_id) as unique_visitors
    from public.site_visit_sessions session
    where session.started_at >= day
      and session.started_at < day + interval '1 day'
  ) daily_sessions on true
  left join lateral (
    select count(*) as page_views
    from public.site_visit_events event
    where event.event_name = 'page_view'
      and event.created_at >= day
      and event.created_at < day + interval '1 day'
  ) daily_events on true;

  return jsonb_build_object(
    'months', v_months,
    'start_date', to_char(v_start_date, 'YYYY-MM-DD'),
    'end_date', to_char(v_end_date, 'YYYY-MM-DD'),
    'total_sessions', v_total_sessions,
    'unique_visitors', v_unique_visitors,
    'page_views', v_page_views,
    'daily', v_daily
  );
end;
$$;

revoke all on function public.get_admin_visit_analytics(integer) from public;
grant execute on function public.get_admin_visit_analytics(integer) to authenticated;
