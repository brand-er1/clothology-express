-- 제작자 펀딩 조기 마감
--
-- 원칙
--  * 추가(additive) 전용: 기존 펀딩/참여/주문/결제 데이터는 삭제하지 않는다.
--  * 기존 상태 체계를 그대로 쓴다. 조기 마감 = status 'closed'(기존 참여 RPC 들이 status = 'approved' 만 허용하므로
--    새 결제/참여가 서버에서 즉시 차단된다) + 조기 마감 기록 컬럼 4개.
--  * 권한은 서버에서 검증한다: 로그인 사용자(auth.uid())가 펀딩의 creator_id 와 같을 때만 마감할 수 있다.
--  * 성공/미달 판정은 기존 _evaluate_funding_success(유효 수량 = 결제완료·미취소)를 재사용한다.
--  * 참여자 알림은 기존 사이트 알림(community_notifications) + 발송 큐(notification_logs → dispatch-notifications → SOLAPI)
--    구조를 재사용하고 idempotency_key UNIQUE 로 중복 발송을 막는다.

-- ---------------------------------------------------------------------------
-- 1. 조기 마감 기록 컬럼
-- ---------------------------------------------------------------------------

alter table public.fundings
  add column if not exists early_closed boolean not null default false,
  add column if not exists early_closed_at timestamptz,
  add column if not exists early_closed_by uuid references auth.users(id) on delete set null,
  add column if not exists early_closed_quantity integer;

comment on column public.fundings.early_closed is '제작자가 종료일 전에 직접 조기 마감했는지 여부. 서버 함수(creator_early_close_funding)만 변경한다.';
comment on column public.fundings.early_closed_at is '제작자 조기 마감 시각(실제 마감 시간).';
comment on column public.fundings.early_closed_by is '조기 마감을 실행한 제작자(user_id = creator_id).';
comment on column public.fundings.early_closed_quantity is '조기 마감 시점의 유효 참여 수량(결제완료·미취소, 실결제+모의결제).';

create index if not exists fundings_early_closed_at_idx on public.fundings (early_closed_at desc) where early_closed;

-- 조기 마감 컬럼은 서버 함수(SECURITY DEFINER)만 바꿀 수 있다. 또한 조기 마감된 펀딩은 어떤 경로로도
-- 다시 'approved'(모집 중)로 돌아가지 않는다(예: 관리자 운영 중단 → 재개 시에도 closed 유지).
create or replace function public._guard_funding_early_close_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.early_closed := false;
      new.early_closed_at := null;
      new.early_closed_by := null;
      new.early_closed_quantity := null;
      return new;
    end if;
    if new.early_closed is distinct from old.early_closed
       or new.early_closed_at is distinct from old.early_closed_at
       or new.early_closed_by is distinct from old.early_closed_by
       or new.early_closed_quantity is distinct from old.early_closed_quantity then
      raise exception '조기 마감 상태는 서버에서만 변경할 수 있습니다.' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.early_closed and new.status = 'approved' then
    new.status := 'closed';
    new.closed_at := coalesce(new.closed_at, new.early_closed_at, now());
  end if;
  return new;
end;
$$;

revoke all on function public._guard_funding_early_close_columns() from public, anon, authenticated;

drop trigger if exists fundings_guard_early_close_columns on public.fundings;
create trigger fundings_guard_early_close_columns
before insert or update on public.fundings
for each row execute function public._guard_funding_early_close_columns();

-- ---------------------------------------------------------------------------
-- 2. 알림 유형 확장 (기존 값은 모두 유지)
-- ---------------------------------------------------------------------------

alter table public.community_notifications
  drop constraint if exists community_notifications_type_check,
  add constraint community_notifications_type_check check (type in (
    'like', 'comment', 'reply', 'purchase_intent', 'poll_vote', 'follow',
    'purchase_intent_goal', 'funding_started', 'funding_status_changed',
    'participation_cancelled', 'funding_cancelled', 'admin_notice',
    'funding_success', 'funding_success_participant',
    'funding_early_closed'
  ));

alter table public.notification_logs
  drop constraint if exists notification_logs_event_type_check,
  add constraint notification_logs_event_type_check check (event_type in ('funding_success', 'funding_early_closed'));

-- ---------------------------------------------------------------------------
-- 3. 종료 방식 판정 (관리자 화면 표시용 파생값)
--    creator_early = 제작자 조기 마감 / admin = 관리자 종료·운영 중단 / period_end = 기간 만료(정상 마감) / null = 진행 중
-- ---------------------------------------------------------------------------

create or replace function public._funding_close_type(p_funding public.fundings)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
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
-- 4. 참여자 알림 (사이트 알림 + SMS 발송 작업)
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
  v_message text :=
    '[브랜더] 참여하신 "' || p_funding.product_name || '" 펀딩이 제작자에 의해 조기 마감되었습니다.' || chr(10)
    || '현재 참여 결과를 기준으로 이후 제작 절차가 진행됩니다.';
begin
  v_sms_on := coalesce((v_channels ->> 'sms')::boolean, false);

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

    -- (1) 사이트 알림: 참여자당 1건
    insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload, sent_at, idempotency_key)
    values ('funding_early_closed', p_funding.id, v_row.participant_id, 'participant', 'site', 'sent', p_payload, now(), v_site_key)
    on conflict (idempotency_key) do nothing;
    if found then
      insert into public.community_notifications (recipient_id, actor_id, type, funding_id, title, message, link_path)
      values (v_row.participant_id, p_funding.creator_id, 'funding_early_closed', p_funding.id,
              '참여하신 펀딩이 조기 마감되었습니다', v_message, '/fundings/' || p_funding.id)
      returning id into v_notification_id;
      update public.notification_logs set notification_id = v_notification_id where idempotency_key = v_site_key;
      v_count := v_count + 1;
    end if;

    -- (2) SMS 발송 작업: notification_channels.sms 가 켜져 있을 때만 대기열에 넣는다.
    --     실제 발송은 dispatch-notifications(SOLAPI) 가 claim_notification_jobs 로 가져가 한 번만 처리한다.
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
-- 5. 제작자 조기 마감 RPC
-- ---------------------------------------------------------------------------

create or replace function public.creator_early_close_funding(p_funding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_f public.fundings%rowtype;
  v_totals record;
  v_end_at timestamptz;
  v_payload jsonb;
  v_notified integer := 0;
  v_cancelled_pending integer := 0;
  v_now timestamptz := now();
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  -- 펀딩 row 잠금: 동시에 들어오는 결제(create_*_payment / create_mock_funding_order 도 FOR UPDATE)와 직렬화된다.
  select * into v_f from public.fundings where id = p_funding_id for update;
  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;

  -- 권한: 본인이 등록한 펀딩만 (관리자도 이 함수로는 마감할 수 없다 → 관리자 종료 기능 사용)
  if v_f.creator_id is distinct from v_user then
    raise exception '본인이 등록한 펀딩만 조기 마감할 수 있습니다.' using errcode = '42501';
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

  -- 결제창만 열고 승인되지 않은 결제(ready)는 더 이상 승인되지 않도록 닫는다.
  -- 결제 완료 건은 건드리지 않는다. 마감 직후 카카오페이 승인이 들어오면 finalize 가 거부되고
  -- kakaopay-approve 가 기존 로직대로 결제를 자동 취소한다.
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

  update public.fundings
  set status = 'closed',
      closed_at = v_now,
      early_closed = true,
      early_closed_at = v_now,
      early_closed_by = v_user,
      early_closed_quantity = v_totals.quantity,
      updated_at = v_now
  where id = p_funding_id
  returning * into v_f;

  -- 목표 달성 판정은 기존 로직을 재사용한다(멱등: 이미 성공한 펀딩은 다시 알림을 만들지 않음).
  perform public._evaluate_funding_success(p_funding_id);
  select * into v_f from public.fundings where id = p_funding_id;

  v_payload := jsonb_build_object(
    'funding_name', v_f.product_name,
    'target_quantity', v_f.moq,
    'quantity', v_totals.quantity,
    'participants', v_totals.participants,
    'succeeded', v_f.success_at is not null,
    'early_closed_at', v_now
  );

  v_notified := public._enqueue_funding_early_closed_notifications(v_f, v_payload);

  return jsonb_build_object(
    'funding_id', p_funding_id,
    'status', v_f.status,
    'early_closed', true,
    'early_closed_at', v_now,
    'quantity', v_totals.quantity,
    'participants', v_totals.participants,
    'target_quantity', v_f.moq,
    'result', case when v_f.success_at is not null then 'success' else 'unmet' end,
    'notified_participants', v_notified,
    'cancelled_pending_payments', v_cancelled_pending
  );
end;
$$;

revoke all on function public.creator_early_close_funding(uuid) from public, anon;
grant execute on function public.creator_early_close_funding(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 관리자: 종료 방식 조회 (fundings.view 권한)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_funding_closures(p_funding_ids uuid[])
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
  succeeded boolean
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
      else coalesce(cp.display_name, nullif(p.username, ''), nullif(p.full_name, ''), '제작자') end,
    (select u.email::text from auth.users u where u.id = f.early_closed_by),
    f.moq,
    f.success_at is not null
  from public.fundings f
  left join public.creator_profiles cp on cp.user_id = f.early_closed_by
  left join public.profiles p on p.id = f.early_closed_by
  where f.id = any(coalesce(p_funding_ids, array[]::uuid[]));
end;
$$;

revoke all on function public.admin_list_funding_closures(uuid[]) from public, anon;
grant execute on function public.admin_list_funding_closures(uuid[]) to authenticated;

notify pgrst, 'reload schema';
