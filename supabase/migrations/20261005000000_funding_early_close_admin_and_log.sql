-- 펀딩 조기 마감 확장: 관리자 조기 마감 + 조기 마감 기록 + 결과별(목표 달성/미달) 참여자 알림 문구
--
-- 원칙 (20261002000000_creator_early_close_funding 과 동일)
--  * 상태값은 새로 만들지 않는다. 조기 마감 = status 'closed' + early_closed = true.
--    기존 참여/결제 RPC 들이 status = 'approved' 만 허용하므로 새 주문·결제는 서버에서 즉시 차단된다.
--  * 기존 주문·결제·구매자·달성률(current_orders)·매출 데이터는 삭제/초기화하지 않는다.
--  * 목표 미달 마감 시 자동 환불을 하지 않는다(결제/환불은 기존 환불 관리 정책을 따른다).
--  * 알림은 기존 사이트 알림(community_notifications) + 발송 큐(notification_logs → dispatch-notifications)를 재사용한다.

-- ---------------------------------------------------------------------------
-- 1. 조기 마감 기록
-- ---------------------------------------------------------------------------

create table if not exists public.funding_early_close_logs (
  id uuid primary key default gen_random_uuid(),
  funding_id uuid not null unique references public.fundings(id) on delete cascade,
  closed_by uuid references auth.users(id) on delete set null,
  closed_by_role text not null,
  reason text,
  original_end_date timestamptz,
  closed_at timestamptz not null,
  target_quantity integer,
  final_participant_count integer not null default 0,
  final_quantity integer not null default 0,
  final_amount bigint not null default 0,
  final_achievement_rate numeric(10, 2) not null default 0,
  succeeded boolean not null default false,
  cancelled_pending_payments integer not null default 0,
  notified_participants integer not null default 0,
  created_at timestamptz not null default now(),
  constraint funding_early_close_logs_role_check check (closed_by_role in ('creator', 'admin'))
);

create index if not exists funding_early_close_logs_closed_at_idx on public.funding_early_close_logs (closed_at desc);

comment on table public.funding_early_close_logs is
  '펀딩 조기 마감 기록(누가·언제·마감 당시 최종 수치). 조기 마감 RPC(SECURITY DEFINER)만 기록하고 관리자 RPC 로만 조회한다.';

alter table public.funding_early_close_logs enable row level security;
revoke all on table public.funding_early_close_logs from anon, authenticated;

-- 기존 제작자 조기 마감 건 이관(마감 당시 수량은 기록된 값, 금액·참여자는 현재 유효 주문 기준)
insert into public.funding_early_close_logs (
  funding_id, closed_by, closed_by_role, original_end_date, closed_at, target_quantity,
  final_participant_count, final_quantity, final_amount, final_achievement_rate, succeeded
)
select
  f.id, f.early_closed_by, 'creator', public._funding_end_at(f.reviewed_at, f.funding_days),
  coalesce(f.early_closed_at, f.closed_at, now()), f.moq,
  t.participants, coalesce(f.early_closed_quantity, t.quantity), t.amount,
  case when f.moq > 0 then round(coalesce(f.early_closed_quantity, t.quantity) * 100.0 / f.moq, 2) else 0 end,
  f.success_at is not null
from public.fundings f
cross join lateral (
  select
    coalesce(sum(fp.quantity), 0)::integer as quantity,
    count(distinct fp.participant_id)::integer as participants,
    coalesce(sum(fp.total_amount), 0)::bigint as amount
  from public.funding_participations fp
  where fp.funding_id = f.id and fp.status <> 'cancelled' and fp.payment_status = 'paid'
) t
where f.early_closed
on conflict (funding_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. 종료 방식: 관리자 조기 마감(admin_early) 구분
-- ---------------------------------------------------------------------------

create or replace function public._funding_close_type(p_funding public.fundings)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_funding.early_closed and exists (
      select 1 from public.funding_early_close_logs l where l.funding_id = p_funding.id and l.closed_by_role = 'admin'
    ) then 'admin_early'
    when p_funding.early_closed then 'creator_early'
    when p_funding.suspended_at is not null then 'admin'
    when p_funding.status = 'closed' and exists (
      select 1 from public.admin_audit_logs l
      where l.target_type = 'funding' and l.target_id = p_funding.id::text and l.action = 'funding.close'
    ) then 'admin'
    when p_funding.status = 'closed' then 'period_end'
    when p_funding.status = 'approved' and p_funding.reviewed_at is not null
      and now() >= public._funding_end_at(p_funding.reviewed_at, p_funding.funding_days) then 'period_end'
    else null
  end;
$$;

revoke all on function public._funding_close_type(public.fundings) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. 참여자 알림: 결과별 문구 (기존 함수 시그니처 유지)
-- ---------------------------------------------------------------------------

create or replace function public._enqueue_funding_early_closed_notifications(p_funding public.fundings, p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
  v_notification_id uuid;
  v_site_key text;
  v_sms_key text;
  v_channels jsonb := coalesce((select value from public.platform_settings where key = 'notification_channels'), '{}'::jsonb);
  v_sms_on boolean;
  v_succeeded boolean := coalesce((p_payload ->> 'succeeded')::boolean, false);
  v_actor uuid := coalesce(nullif(p_payload ->> 'closed_by', '')::uuid, p_funding.creator_id);
  v_title text;
  v_message text;
begin
  v_sms_on := coalesce((v_channels ->> 'sms')::boolean, false);

  if v_succeeded then
    v_title := '참여하신 펀딩이 목표 달성으로 조기 마감되었습니다';
    v_message := '참여하신 [' || p_funding.product_name || '] 펀딩이 목표 달성으로 조기 마감되었습니다. '
      || '제작 준비가 시작될 예정입니다.';
  else
    v_title := '참여하신 펀딩이 조기 마감되었습니다';
    v_message := '참여하신 [' || p_funding.product_name || '] 펀딩이 목표 수량에 도달하지 못한 상태로 조기 마감되었습니다. '
      || '주문 내역은 그대로 유지되며, 이후 진행 방법은 별도로 안내드리겠습니다.';
  end if;

  for v_row in
    select distinct on (fp.participant_id)
      fp.participant_id,
      public.normalize_kr_phone(coalesce(fp.orderer_phone, fp.recipient_phone)) as phone
    from public.funding_participations fp
    where fp.funding_id = p_funding.id
      and fp.status <> 'cancelled'
      and fp.payment_status = 'paid'
      and fp.participant_id <> p_funding.creator_id
    order by fp.participant_id, fp.created_at desc
  loop
    v_site_key := 'funding_early_closed:' || p_funding.id || ':participant:' || v_row.participant_id || ':site';
    v_sms_key := 'funding_early_closed:' || p_funding.id || ':participant:' || v_row.participant_id || ':sms';

    insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload, sent_at, idempotency_key)
    values ('funding_early_closed', p_funding.id, v_row.participant_id, 'participant', 'site', 'sent', p_payload, now(), v_site_key)
    on conflict (idempotency_key) do nothing;
    if found then
      insert into public.community_notifications (recipient_id, actor_id, type, funding_id, title, message, link_path)
      values (v_row.participant_id, v_actor, 'funding_early_closed', p_funding.id, v_title, v_message, '/fundings/' || p_funding.id)
      returning id into v_notification_id;
      update public.notification_logs set notification_id = v_notification_id where idempotency_key = v_site_key;
      v_count := v_count + 1;
    end if;

    insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload,
                                          recipient_masked, skip_reason, idempotency_key)
    values (
      'funding_early_closed', p_funding.id, v_row.participant_id, 'participant', 'sms',
      case when v_row.phone is null or not v_sms_on then 'skipped' else 'pending' end,
      p_payload,
      public.mask_kr_phone(v_row.phone),
      case
        when v_row.phone is null then '참여자 휴대폰 번호 없음'
        when not v_sms_on then 'SMS 채널 비활성화(notification_channels)'
      end,
      v_sms_key
    )
    on conflict (idempotency_key) do nothing;
  end loop;
  return v_count;
end;
$$;

revoke all on function public._enqueue_funding_early_closed_notifications(public.fundings, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. 조기 마감 공통 처리 (내부 전용 — 권한 확인은 호출하는 RPC 가 먼저 한다)
-- ---------------------------------------------------------------------------

create or replace function public._early_close_funding(
  p_funding_id uuid,
  p_actor uuid,
  p_role text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_f public.fundings%rowtype;
  v_totals record;
  v_amount bigint;
  v_end_at timestamptz;
  v_rate numeric(10, 2);
  v_payload jsonb;
  v_notified integer := 0;
  v_cancelled_pending integer := 0;
  v_now timestamptz := now();
begin
  -- 펀딩 row 잠금: 동시에 들어오는 결제(create_*_payment / create_mock_funding_order 도 FOR UPDATE)와 직렬화된다.
  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if v_f.early_closed then
    raise exception '이미 조기 마감된 펀딩입니다.';
  end if;
  if v_f.status <> 'approved' or v_f.suspended_at is not null then
    raise exception '모집 중인 펀딩만 조기 마감할 수 있습니다.';
  end if;
  v_end_at := public._funding_end_at(v_f.reviewed_at, v_f.funding_days);
  if v_end_at is not null and v_now >= v_end_at then
    raise exception '이미 펀딩 기간이 종료되었습니다.';
  end if;

  -- 결제창만 열고 승인되지 않은 결제(ready)만 닫는다. 결제 완료 건은 건드리지 않는다.
  update public.funding_participations
  set status = 'cancelled',
      payment_status = 'cancelled',
      payment_cancelled_at = v_now,
      updated_at = v_now
  where funding_id = p_funding_id
    and payment_status = 'ready'
    and status <> 'cancelled';
  get diagnostics v_cancelled_pending = row_count;

  select * into v_totals from public._funding_valid_totals(p_funding_id);
  select coalesce(sum(fp.total_amount), 0)::bigint into v_amount
  from public.funding_participations fp
  where fp.funding_id = p_funding_id and fp.status <> 'cancelled' and fp.payment_status = 'paid';

  -- current_orders(달성률 기준값)는 건드리지 않는다.
  update public.fundings
  set status = 'closed',
      closed_at = v_now,
      early_closed = true,
      early_closed_at = v_now,
      early_closed_by = p_actor,
      early_closed_quantity = v_totals.quantity,
      updated_at = v_now
  where id = p_funding_id
  returning * into v_f;

  -- 목표 달성 판정은 기존 로직 재사용(멱등). 달성 시 funding_status = success → 제작 준비 단계.
  perform public._evaluate_funding_success(p_funding_id);
  select * into v_f from public.fundings where id = p_funding_id;

  v_rate := case when v_f.moq > 0 then round(v_totals.quantity * 100.0 / v_f.moq, 2) else 0 end;

  v_payload := jsonb_build_object(
    'funding_name', v_f.product_name,
    'target_quantity', v_f.moq,
    'quantity', v_totals.quantity,
    'participants', v_totals.participants,
    'succeeded', v_f.success_at is not null,
    'early_closed_at', v_now,
    'closed_by', p_actor,
    'closed_by_role', p_role
  );

  v_notified := public._enqueue_funding_early_closed_notifications(v_f, v_payload);

  insert into public.funding_early_close_logs (
    funding_id, closed_by, closed_by_role, reason, original_end_date, closed_at, target_quantity,
    final_participant_count, final_quantity, final_amount, final_achievement_rate, succeeded,
    cancelled_pending_payments, notified_participants
  ) values (
    p_funding_id, p_actor, p_role, nullif(btrim(coalesce(p_reason, '')), ''), v_end_at, v_now, v_f.moq,
    v_totals.participants, v_totals.quantity, v_amount, v_rate, v_f.success_at is not null,
    v_cancelled_pending, v_notified
  );

  return jsonb_build_object(
    'funding_id', p_funding_id,
    'status', v_f.status,
    'early_closed', true,
    'early_closed_at', v_now,
    'closed_by_role', p_role,
    'quantity', v_totals.quantity,
    'participants', v_totals.participants,
    'amount', v_amount,
    'achievement_rate', v_rate,
    'target_quantity', v_f.moq,
    'result', case when v_f.success_at is not null then 'success' else 'unmet' end,
    'notified_participants', v_notified,
    'cancelled_pending_payments', v_cancelled_pending
  );
end;
$$;

revoke all on function public._early_close_funding(uuid, uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. 제작자 조기 마감 (본인 펀딩만) — 기존 RPC 이름·반환 형식 유지
-- ---------------------------------------------------------------------------

create or replace function public.creator_early_close_funding(p_funding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_creator uuid;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  select creator_id into v_creator from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if v_creator is distinct from v_user then
    raise exception '본인이 등록한 펀딩만 조기 마감할 수 있습니다.' using errcode = '42501';
  end if;
  return public._early_close_funding(p_funding_id, v_user, 'creator', null);
end;
$$;

revoke all on function public.creator_early_close_funding(uuid) from public, anon;
grant execute on function public.creator_early_close_funding(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 관리자 조기 마감 (모든 펀딩, fundings.manage 권한 + 사유 + Audit Log)
-- ---------------------------------------------------------------------------

create or replace function public.admin_early_close_funding(p_funding_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('fundings.manage');
  v_reason text := public._require_reason(p_reason, '조기 마감 사유');
  v_result jsonb;
  v_name text;
begin
  v_result := public._early_close_funding(p_funding_id, v_actor, 'admin', v_reason);
  select product_name into v_name from public.fundings where id = p_funding_id;
  perform public._admin_log('funding.early_close', 'funding', p_funding_id::text, v_name,
    jsonb_build_object('status', 'approved'),
    jsonb_build_object('status', 'closed', 'early_closed', true, 'result', v_result ->> 'result',
      'quantity', v_result -> 'quantity', 'achievement_rate', v_result -> 'achievement_rate'),
    v_reason);
  return v_result;
end;
$$;

revoke all on function public.admin_early_close_funding(uuid, text) from public, anon;
grant execute on function public.admin_early_close_funding(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 관리자: 종료 방식 + 조기 마감 기록 조회 (반환 컬럼 추가로 재생성)
-- ---------------------------------------------------------------------------

drop function if exists public.admin_list_funding_closures(uuid[]);

create function public.admin_list_funding_closures(p_funding_ids uuid[])
returns table (
  funding_id uuid,
  close_type text,
  closed_at timestamptz,
  early_closed boolean,
  early_closed_at timestamptz,
  early_closed_quantity integer,
  early_closed_by uuid,
  early_closed_by_name text,
  early_closed_by_email text,
  target_quantity integer,
  succeeded boolean,
  closed_by_role text,
  close_reason text,
  original_end_date timestamptz,
  final_participant_count integer,
  final_quantity integer,
  final_amount bigint,
  final_achievement_rate numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._admin_require('fundings.view');
  return query
  select
    f.id,
    public._funding_close_type(f),
    coalesce(f.early_closed_at, f.closed_at, case
      when f.status = 'approved' and f.reviewed_at is not null
        and now() >= public._funding_end_at(f.reviewed_at, f.funding_days)
      then public._funding_end_at(f.reviewed_at, f.funding_days) end),
    f.early_closed,
    f.early_closed_at,
    f.early_closed_quantity,
    f.early_closed_by,
    case when f.early_closed_by is null then null
      else coalesce(nullif(cp.display_name, ''), nullif(p.username, ''), nullif(p.full_name, ''),
        case when l.closed_by_role = 'admin' then '관리자' else '제작자' end) end,
    (select u.email::text from auth.users u where u.id = f.early_closed_by),
    f.moq,
    f.success_at is not null,
    l.closed_by_role,
    l.reason,
    l.original_end_date,
    l.final_participant_count,
    l.final_quantity,
    l.final_amount,
    l.final_achievement_rate
  from public.fundings f
  left join public.funding_early_close_logs l on l.funding_id = f.id
  left join public.creator_profiles cp on cp.user_id = f.early_closed_by
  left join public.profiles p on p.id = f.early_closed_by
  where f.id = any(coalesce(p_funding_ids, array[]::uuid[]));
end;
$$;

revoke all on function public.admin_list_funding_closures(uuid[]) from public, anon;
grant execute on function public.admin_list_funding_closures(uuid[]) to authenticated;

-- 관리자: 조기 마감 기록 전체 목록
create or replace function public.admin_list_early_close_logs(p_limit integer default 50, p_offset integer default 0)
returns table (
  funding_id uuid,
  product_name text,
  brand_name text,
  closed_by uuid,
  closed_by_name text,
  closed_by_role text,
  reason text,
  original_end_date timestamptz,
  closed_at timestamptz,
  target_quantity integer,
  final_participant_count integer,
  final_quantity integer,
  final_amount bigint,
  final_achievement_rate numeric,
  succeeded boolean,
  notified_participants integer,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._admin_require('fundings.view');
  return query
  select
    l.funding_id, f.product_name, b.brand_name, l.closed_by,
    coalesce(nullif(cp.display_name, ''), nullif(p.username, ''), nullif(p.full_name, ''),
      case when l.closed_by_role = 'admin' then '관리자' else '제작자' end),
    l.closed_by_role, l.reason, l.original_end_date, l.closed_at, l.target_quantity,
    l.final_participant_count, l.final_quantity, l.final_amount, l.final_achievement_rate, l.succeeded,
    l.notified_participants, count(*) over ()
  from public.funding_early_close_logs l
  join public.fundings f on f.id = l.funding_id
  left join public.brands b on b.id = f.brand_id
  left join public.creator_profiles cp on cp.user_id = l.closed_by
  left join public.profiles p on p.id = l.closed_by
  order by l.closed_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_early_close_logs(integer, integer) from public, anon;
grant execute on function public.admin_list_early_close_logs(integer, integer) to authenticated;

notify pgrst, 'reload schema';
