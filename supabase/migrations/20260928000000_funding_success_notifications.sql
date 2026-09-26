-- 펀딩 성공 자동 판정 + 제작자 사이트 알림 + SMS(알림톡) 발송 큐
--
-- 원칙
--  * 추가(additive) 전용: 기존 회원/펀딩/주문/모의결제/결제/제작자 프로필 데이터는 삭제·초기화하지 않는다.
--  * 성공 판정은 서버(DB 트리거)에서만 한다. 프론트엔드의 current >= target 비교로 알림을 보내지 않는다.
--  * 중복 방지: 펀딩 row 잠금(FOR UPDATE) + success_at IS NULL 원자적 전환 + notification_logs.idempotency_key UNIQUE.
--  * 외부 발송(SMS)은 Edge Function(dispatch-notifications)이 service_role 로 큐를 가져가(claim) 처리한다.
--    SMS API KEY/SECRET 은 Supabase Secrets 에만 둔다(이 파일·프론트엔드에 없음).
--  * 발송 실패는 펀딩 성공 상태에 영향을 주지 않는다(별도 로그 + 관리자 재발송).
--  * 기존 사이트 알림 테이블(community_notifications)을 확장해 재사용한다.

-- ---------------------------------------------------------------------------
-- 1. 휴대폰 번호 정규화 (국내 휴대폰, 숫자만 저장: 01012345678)
-- ---------------------------------------------------------------------------

create or replace function public.normalize_kr_phone(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text;
begin
  if p_value is null then
    return null;
  end if;
  v_digits := regexp_replace(p_value, '[^0-9]', '', 'g');
  -- +82 10-1234-5678 / 82 010 1234 5678 → 01012345678
  if v_digits like '82%' and char_length(v_digits) >= 11 then
    v_digits := '0' || ltrim(substr(v_digits, 3), '0');
  end if;
  if v_digits ~ '^(010[0-9]{8}|01[16789][0-9]{7,8})$' then
    return v_digits;
  end if;
  return null;
end;
$$;

grant execute on function public.normalize_kr_phone(text) to anon, authenticated, service_role;

create or replace function public.mask_kr_phone(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_value is null or char_length(p_value) < 8 then p_value
    else substr(p_value, 1, 3) || '-****-' || right(p_value, 4)
  end;
$$;

revoke all on function public.mask_kr_phone(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. 제작자 연락처/알림 수신 설정
--    creator_profiles 는 공개(anon select) 테이블이므로 개인정보(휴대폰)는 별도 비공개 테이블에 둔다.
-- ---------------------------------------------------------------------------

create table if not exists public.creator_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_number text,
  sms_notifications_enabled boolean not null default true,
  funding_success_notifications_enabled boolean not null default true,
  phone_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_notification_settings_phone_format
    check (phone_number is null or phone_number ~ '^(010[0-9]{8}|01[16789][0-9]{7,8})$')
);

comment on table public.creator_notification_settings is
  '제작자 알림 수신 설정(비공개). 휴대폰 번호는 숫자만 정규화해 저장한다. 행이 없으면 profiles.phone_number 를 대체 사용한다.';

alter table public.creator_notification_settings enable row level security;

drop policy if exists "Creators read own notification settings" on public.creator_notification_settings;
create policy "Creators read own notification settings"
  on public.creator_notification_settings for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.creator_notification_settings from anon, authenticated;
grant select on public.creator_notification_settings to authenticated;
grant all on public.creator_notification_settings to service_role;

drop trigger if exists creator_notification_settings_set_updated_at on public.creator_notification_settings;
create trigger creator_notification_settings_set_updated_at
before update on public.creator_notification_settings
for each row execute function public.set_creator_brand_updated_at();

-- 알림용 제작자 휴대폰: 설정 행이 있으면 그 번호만, 없으면 회원 프로필 번호(정규화 가능할 때)
create or replace function public._creator_notification_phone(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.creator_notification_settings s where s.user_id = p_user_id)
      then (select s.phone_number from public.creator_notification_settings s where s.user_id = p_user_id)
    else (select public.normalize_kr_phone(p.phone_number) from public.profiles p where p.id = p_user_id)
  end;
$$;

revoke all on function public._creator_notification_phone(uuid) from public, anon, authenticated;

create or replace function public.get_my_creator_notification_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.creator_notification_settings%rowtype;
  v_profile_phone text;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_row from public.creator_notification_settings where user_id = v_user;
  select public.normalize_kr_phone(phone_number) into v_profile_phone from public.profiles where id = v_user;
  return jsonb_build_object(
    'configured', v_row.user_id is not null,
    'phone_number', case when v_row.user_id is not null then v_row.phone_number else v_profile_phone end,
    'sms_notifications_enabled', coalesce(v_row.sms_notifications_enabled, true),
    'funding_success_notifications_enabled', coalesce(v_row.funding_success_notifications_enabled, true),
    'phone_source', case when v_row.user_id is not null then 'settings' when v_profile_phone is not null then 'profile' else 'none' end
  );
end;
$$;

revoke all on function public.get_my_creator_notification_settings() from public, anon;
grant execute on function public.get_my_creator_notification_settings() to authenticated;

create or replace function public.update_my_creator_notification_settings(
  p_phone_number text,
  p_sms_notifications_enabled boolean,
  p_funding_success_notifications_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_phone text;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if nullif(btrim(coalesce(p_phone_number, '')), '') is not null then
    v_phone := public.normalize_kr_phone(p_phone_number);
    if v_phone is null then
      raise exception '올바른 휴대폰 번호 형식이 아닙니다. 예: 010-1234-5678';
    end if;
  end if;

  insert into public.creator_notification_settings as s (
    user_id, phone_number, sms_notifications_enabled, funding_success_notifications_enabled, phone_updated_at
  ) values (
    v_user, v_phone, coalesce(p_sms_notifications_enabled, true), coalesce(p_funding_success_notifications_enabled, true), now()
  )
  on conflict (user_id) do update
    set phone_number = excluded.phone_number,
        sms_notifications_enabled = excluded.sms_notifications_enabled,
        funding_success_notifications_enabled = excluded.funding_success_notifications_enabled,
        phone_updated_at = case when s.phone_number is distinct from excluded.phone_number then now() else s.phone_updated_at end;

  return public.get_my_creator_notification_settings();
end;
$$;

revoke all on function public.update_my_creator_notification_settings(text, boolean, boolean) from public, anon;
grant execute on function public.update_my_creator_notification_settings(text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. 펀딩 성공 상태 컬럼 (funding → success → production)
-- ---------------------------------------------------------------------------

alter table public.fundings
  add column if not exists funding_status text not null default 'funding',
  add column if not exists success_at timestamptz,
  add column if not exists final_quantity integer,
  add column if not exists success_participant_count integer,
  add column if not exists success_backfilled boolean not null default false,
  add column if not exists success_notification_sent boolean not null default false,
  add column if not exists success_notification_sent_at timestamptz,
  add column if not exists success_sms_sent boolean not null default false,
  add column if not exists success_sms_sent_at timestamptz;

alter table public.fundings
  drop constraint if exists fundings_funding_status_check,
  add constraint fundings_funding_status_check check (funding_status in ('funding', 'success', 'production'));

create index if not exists fundings_success_at_idx on public.fundings (success_at desc) where success_at is not null;

comment on column public.fundings.funding_status is '펀딩 진행 단계(funding → success → production). 서버 트리거만 변경한다.';
comment on column public.fundings.success_at is '유효 수량(결제완료·미취소, 실결제+모의결제)이 목표 수량(moq)에 처음 도달한 시각. 한 번만 기록된다.';
comment on column public.fundings.final_quantity is '유효 참여 수량. 성공 시점에 기록되고 이후 결제/취소 시 서버가 갱신한다.';
comment on column public.fundings.success_backfilled is '이 기능 배포 전에 이미 목표를 달성한 펀딩(소급 기록, 알림/문자는 보내지 않음).';

-- 성공/알림 컬럼은 서버 함수(SECURITY DEFINER)만 바꿀 수 있다. 클라이언트(제작자·관리자 Data API) 직접 변경 차단.
create or replace function public._guard_funding_success_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.funding_status := 'funding';
    new.success_at := null;
    new.final_quantity := null;
    new.success_participant_count := null;
    new.success_backfilled := false;
    new.success_notification_sent := false;
    new.success_notification_sent_at := null;
    new.success_sms_sent := false;
    new.success_sms_sent_at := null;
    return new;
  end if;
  if new.funding_status is distinct from old.funding_status
     or new.success_at is distinct from old.success_at
     or new.final_quantity is distinct from old.final_quantity
     or new.success_participant_count is distinct from old.success_participant_count
     or new.success_backfilled is distinct from old.success_backfilled
     or new.success_notification_sent is distinct from old.success_notification_sent
     or new.success_notification_sent_at is distinct from old.success_notification_sent_at
     or new.success_sms_sent is distinct from old.success_sms_sent
     or new.success_sms_sent_at is distinct from old.success_sms_sent_at then
    raise exception '펀딩 성공/알림 상태는 서버에서만 변경할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public._guard_funding_success_columns() from public, anon, authenticated;

drop trigger if exists fundings_guard_success_columns on public.fundings;
create trigger fundings_guard_success_columns
before insert or update on public.fundings
for each row execute function public._guard_funding_success_columns();

-- ---------------------------------------------------------------------------
-- 4. 사이트 알림 확장 (community_notifications 재사용)
-- ---------------------------------------------------------------------------

alter table public.community_notifications
  add column if not exists title text,
  add column if not exists link_path text;

alter table public.community_notifications
  drop constraint if exists community_notifications_type_check,
  add constraint community_notifications_type_check check (type in (
    'like', 'comment', 'reply', 'purchase_intent', 'poll_vote', 'follow',
    'purchase_intent_goal', 'funding_started', 'funding_status_changed',
    'participation_cancelled', 'funding_cancelled', 'admin_notice',
    'funding_success', 'funding_success_participant'
  ));

alter table public.community_notifications
  drop constraint if exists community_notifications_link_path_check,
  add constraint community_notifications_link_path_check
    check (link_path is null or (link_path like '/%' and link_path not like '//%'));

-- 반환 컬럼(title, link_path)이 추가되므로 재생성한다(인자/권한 동일).
drop function if exists public.list_my_community_notifications(integer);
create function public.list_my_community_notifications(p_limit integer default 50)
returns table (
  id uuid,
  actor_id uuid,
  actor_name text,
  actor_avatar_url text,
  type text,
  message text,
  post_id uuid,
  comment_id uuid,
  funding_id uuid,
  is_read boolean,
  created_at timestamptz,
  title text,
  link_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return query
  select
    n.id, n.actor_id,
    coalesce(prof.username, prof.full_name, 'BRAND-ER'), prof.avatar_url,
    n.type, n.message, n.post_id, n.comment_id, n.funding_id, n.is_read, n.created_at,
    n.title, n.link_path
  from public.community_notifications n
  left join public.profiles prof on prof.id = n.actor_id
  where n.recipient_id = v_user_id
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke all on function public.list_my_community_notifications(integer) from public, anon;
grant execute on function public.list_my_community_notifications(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 알림 발송 로그 / 외부 발송 큐 (notification_logs)
-- ---------------------------------------------------------------------------

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  funding_id uuid references public.fundings(id) on delete set null,
  recipient_id uuid references auth.users(id) on delete set null,
  recipient_role text not null default 'creator',
  channel text not null,
  status text not null default 'pending',
  recipient_masked text,
  payload jsonb not null default '{}'::jsonb,
  notification_id uuid,
  skip_reason text,
  error_message text,
  provider text,
  provider_message_id text,
  attempt_count integer not null default 0,
  resend_count integer not null default 0,
  last_resend_by uuid references auth.users(id) on delete set null,
  last_resend_reason text,
  locked_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_logs_idempotency_key_key unique (idempotency_key),
  constraint notification_logs_event_type_check check (event_type in ('funding_success')),
  constraint notification_logs_recipient_role_check check (recipient_role in ('creator', 'participant')),
  constraint notification_logs_channel_check check (channel in ('site', 'sms', 'alimtalk')),
  constraint notification_logs_status_check check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'))
);

create index if not exists notification_logs_funding_idx on public.notification_logs (funding_id, created_at desc);
create index if not exists notification_logs_queue_idx on public.notification_logs (status, created_at)
  where status in ('pending', 'sending');

comment on table public.notification_logs is
  '알림 발송 기록 + 외부 채널(SMS/알림톡) 발송 큐. idempotency_key(이벤트:펀딩:수신자:채널) UNIQUE 로 같은 알림의 중복 생성을 막는다. 휴대폰 번호 원문은 저장하지 않는다.';

alter table public.notification_logs enable row level security;
revoke all on public.notification_logs from anon, authenticated;
grant all on public.notification_logs to service_role;

drop trigger if exists notification_logs_set_updated_at on public.notification_logs;
create trigger notification_logs_set_updated_at
before update on public.notification_logs
for each row execute function public.set_creator_brand_updated_at();

-- 참여자 알림 확장(현재 기본 꺼짐): 켜면 성공 시 참여자에게도 사이트 알림 + SMS 큐가 생성된다.
insert into public.platform_settings (key, value, description) values
  ('funding_success_notify_participants', 'false'::jsonb,
   'true 이면 펀딩 성공 시 참여자에게도 사이트 알림/SMS 를 보낸다(구조만 준비, 기본 꺼짐).')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 6. 펀딩 성공 판정 (서버)
-- ---------------------------------------------------------------------------

-- 유효 수량: 결제완료(paid) + 미취소 참여. 실결제(kakaopay)와 모의결제(mock) 모두 포함.
create or replace function public._funding_valid_totals(p_funding_id uuid, out quantity integer, out participants integer)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(fp.quantity), 0)::integer, count(distinct fp.participant_id)::integer
  from public.funding_participations fp
  where fp.funding_id = p_funding_id
    and fp.status <> 'cancelled'
    and fp.payment_status = 'paid';
$$;

revoke all on function public._funding_valid_totals(uuid) from public, anon, authenticated;

create or replace function public._funding_success_payload(p_funding public.fundings, p_quantity integer, p_participants integer)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'funding_name', p_funding.product_name,
    'target_quantity', p_funding.moq,
    'quantity', p_quantity,
    'participants', p_participants,
    'achievement_rate', case when p_funding.moq > 0 then floor(p_quantity * 100.0 / p_funding.moq)::integer else 0 end,
    'manage_path', '/fundings/' || p_funding.id || '/manage'
  );
$$;

revoke all on function public._funding_success_payload(public.fundings, integer, integer) from public, anon, authenticated;

-- 참여자 알림(확장 포인트). 설정이 켜진 경우에만 호출된다.
create or replace function public._enqueue_funding_success_participant_notifications(p_funding public.fundings, p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
  v_notification_id uuid;
  v_message text := '참여하신 "' || p_funding.product_name || '" 펀딩이 목표 수량을 달성했습니다. 이제 제작 준비가 시작됩니다.';
begin
  for v_row in
    select distinct on (fp.participant_id) fp.participant_id, public.normalize_kr_phone(coalesce(fp.orderer_phone, fp.recipient_phone)) as phone
    from public.funding_participations fp
    where fp.funding_id = p_funding.id and fp.status <> 'cancelled' and fp.payment_status = 'paid'
    order by fp.participant_id, fp.created_at desc
  loop
    v_notification_id := null;
    insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload, sent_at, idempotency_key)
    values ('funding_success', p_funding.id, v_row.participant_id, 'participant', 'site', 'sent', p_payload, now(),
            'funding_success:' || p_funding.id || ':participant:' || v_row.participant_id || ':site')
    on conflict (idempotency_key) do nothing;
    if found then
      insert into public.community_notifications (recipient_id, type, funding_id, title, message, link_path)
      values (v_row.participant_id, 'funding_success_participant', p_funding.id, '🎉 참여하신 펀딩이 성공했습니다',
              v_message, '/fundings/' || p_funding.id)
      returning id into v_notification_id;
      update public.notification_logs set notification_id = v_notification_id
      where idempotency_key = 'funding_success:' || p_funding.id || ':participant:' || v_row.participant_id || ':site';
      v_count := v_count + 1;
    end if;

    insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload,
                                          recipient_masked, skip_reason, idempotency_key)
    values ('funding_success', p_funding.id, v_row.participant_id, 'participant', 'sms',
            case when v_row.phone is null then 'skipped' else 'pending' end, p_payload,
            public.mask_kr_phone(v_row.phone),
            case when v_row.phone is null then '참여자 휴대폰 번호 없음' end,
            'funding_success:' || p_funding.id || ':participant:' || v_row.participant_id || ':sms')
    on conflict (idempotency_key) do nothing;
  end loop;
  return v_count;
end;
$$;

revoke all on function public._enqueue_funding_success_participant_notifications(public.fundings, jsonb) from public, anon, authenticated;

-- 핵심: 펀딩 row 를 잠그고 유효 수량을 다시 계산해 success_at IS NULL 일 때만 한 번 성공 처리한다.
-- 동시 결제(19→22)도 row 잠금으로 직렬화되어 정확히 한 트랜잭션만 성공 처리/알림 생성을 한다.
create or replace function public._evaluate_funding_success(p_funding_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
  v_totals record;
  v_payload jsonb;
  v_settings public.creator_notification_settings%rowtype;
  v_site_enabled boolean;
  v_sms_enabled boolean;
  v_phone text;
  v_notification_id uuid;
  v_site_key text;
  v_sms_key text;
begin
  if p_funding_id is null then
    return false;
  end if;

  select * into v_funding from public.fundings where id = p_funding_id for update;
  if not found then
    return false;
  end if;

  select * into v_totals from public._funding_valid_totals(p_funding_id);

  -- 이미 성공한 펀딩: 최종(유효) 수량만 최신화하고 알림은 다시 만들지 않는다.
  if v_funding.success_at is not null then
    if v_funding.final_quantity is distinct from v_totals.quantity then
      update public.fundings set final_quantity = v_totals.quantity where id = p_funding_id;
    end if;
    return false;
  end if;

  if v_funding.status not in ('approved', 'closed')
     or v_funding.suspended_at is not null
     or v_funding.moq is null or v_funding.moq <= 0
     or v_totals.quantity < v_funding.moq then
    return false;
  end if;

  -- 원자적 성공 전환 (success_at IS NULL 조건으로 한 번만)
  update public.fundings
  set funding_status = case when funding_status = 'production' then 'production' else 'success' end,
      success_at = now(),
      final_quantity = v_totals.quantity,
      success_participant_count = v_totals.participants
  where id = p_funding_id and success_at is null
  returning * into v_funding;
  if not found then
    return false;
  end if;

  v_payload := public._funding_success_payload(v_funding, v_totals.quantity, v_totals.participants);
  select * into v_settings from public.creator_notification_settings where user_id = v_funding.creator_id;
  v_site_enabled := coalesce(v_settings.funding_success_notifications_enabled, true);
  v_sms_enabled := v_site_enabled and coalesce(v_settings.sms_notifications_enabled, true);
  v_phone := public._creator_notification_phone(v_funding.creator_id);
  v_site_key := 'funding_success:' || p_funding_id || ':creator:' || v_funding.creator_id || ':site';
  v_sms_key := 'funding_success:' || p_funding_id || ':creator:' || v_funding.creator_id || ':sms';

  -- (1) 사이트 알림: 제작자(creator_id) 에게 1건
  if v_site_enabled then
    insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload, sent_at, idempotency_key)
    values ('funding_success', p_funding_id, v_funding.creator_id, 'creator', 'site', 'sent', v_payload, now(), v_site_key)
    on conflict (idempotency_key) do nothing;
    if found then
      insert into public.community_notifications (recipient_id, type, funding_id, title, message, link_path)
      values (
        v_funding.creator_id, 'funding_success', p_funding_id,
        '🎉 펀딩에 성공했습니다!',
        '"' || v_funding.product_name || '" 펀딩이 목표 수량 ' || v_funding.moq || '장을 달성했습니다.' || chr(10)
          || '현재 참여 수량: ' || v_totals.quantity || '장' || chr(10)
          || '펀딩 달성률: ' || (v_payload ->> 'achievement_rate') || '%' || chr(10)
          || '이제 제작 준비를 진행해주세요.',
        '/fundings/' || p_funding_id || '/manage'
      )
      returning id into v_notification_id;
      update public.notification_logs set notification_id = v_notification_id where idempotency_key = v_site_key;
      update public.fundings
      set success_notification_sent = true, success_notification_sent_at = now()
      where id = p_funding_id;
    end if;
  else
    insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload, skip_reason, idempotency_key)
    values ('funding_success', p_funding_id, v_funding.creator_id, 'creator', 'site', 'skipped', v_payload,
            '제작자가 펀딩 성공 알림 수신을 끔', v_site_key)
    on conflict (idempotency_key) do nothing;
  end if;

  -- (2) SMS 발송 작업 1건 (실제 발송은 dispatch-notifications Edge Function)
  insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload,
                                        recipient_masked, skip_reason, idempotency_key)
  values (
    'funding_success', p_funding_id, v_funding.creator_id, 'creator', 'sms',
    case when not v_sms_enabled or v_phone is null then 'skipped' else 'pending' end,
    v_payload,
    public.mask_kr_phone(v_phone),
    case
      when not v_site_enabled then '제작자가 펀딩 성공 알림 수신을 끔'
      when not v_sms_enabled then '제작자가 SMS 수신을 끔'
      when v_phone is null then '제작자 휴대폰 번호 미등록'
    end,
    v_sms_key
  )
  on conflict (idempotency_key) do nothing;

  -- (3) 참여자 알림 확장 (기본 꺼짐)
  if public._platform_setting_bool('funding_success_notify_participants', false) then
    perform public._enqueue_funding_success_participant_notifications(v_funding, v_payload);
  end if;

  return true;
end;
$$;

revoke all on function public._evaluate_funding_success(uuid) from public, anon, authenticated;

-- 결제/취소 트리거: 판정 오류가 결제 트랜잭션을 깨뜨리지 않도록 예외를 흡수한다(다음 이벤트/디스패처가 재판정).
create or replace function public._funding_participation_success_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public._evaluate_funding_success(new.funding_id);
  exception when others then
    raise warning '펀딩 성공 판정 실패(funding=%): %', new.funding_id, sqlerrm;
  end;
  return null;
end;
$$;

revoke all on function public._funding_participation_success_trigger() from public, anon, authenticated;

drop trigger if exists funding_participations_evaluate_success on public.funding_participations;
create trigger funding_participations_evaluate_success
after insert or update of status, payment_status, quantity on public.funding_participations
for each row execute function public._funding_participation_success_trigger();

-- 펀딩 상태/목표 변경(예: 승인 전 결제분이 있던 펀딩 재오픈, 목표 조정) 시 재판정 + 제작 시작 시 production 전환
create or replace function public._funding_success_on_funding_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.production_status is not null and new.production_status <> 'funding_success'
     and new.funding_status <> 'production' then
    update public.fundings set funding_status = 'production' where id = new.id;
  end if;
  if new.success_at is null and (new.status is distinct from old.status or new.moq is distinct from old.moq) then
    begin
      perform public._evaluate_funding_success(new.id);
    exception when others then
      raise warning '펀딩 성공 판정 실패(funding=%): %', new.id, sqlerrm;
    end;
  end if;
  return null;
end;
$$;

revoke all on function public._funding_success_on_funding_change() from public, anon, authenticated;

drop trigger if exists fundings_evaluate_success on public.fundings;
create trigger fundings_evaluate_success
after update of status, moq, production_status on public.fundings
for each row execute function public._funding_success_on_funding_change();

-- 디스패처 안전망: 트리거에서 판정이 실패했던 펀딩도 다시 판정할 수 있다(멱등).
create or replace function public.evaluate_funding_success(p_funding_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public._evaluate_funding_success(p_funding_id);
$$;

revoke all on function public.evaluate_funding_success(uuid) from public, anon, authenticated;
grant execute on function public.evaluate_funding_success(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. 기존 펀딩 소급 기록 (알림/문자는 보내지 않는다)
-- ---------------------------------------------------------------------------

create or replace function public._backfill_funding_success()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with valid as (
    select fp.funding_id, fp.participant_id, fp.quantity,
           coalesce(fp.payment_approved_at, fp.created_at) as paid_at,
           sum(fp.quantity) over (partition by fp.funding_id order by coalesce(fp.payment_approved_at, fp.created_at), fp.id) as running
    from public.funding_participations fp
    where fp.status <> 'cancelled' and fp.payment_status = 'paid'
  ),
  totals as (
    select v.funding_id, sum(v.quantity)::integer as qty, count(distinct v.participant_id)::integer as participants
    from valid v group by v.funding_id
  ),
  reached as (
    select t.funding_id, t.qty, t.participants,
           (select min(v.paid_at) from valid v where v.funding_id = t.funding_id and v.running >= f.moq) as reached_at
    from totals t join public.fundings f on f.id = t.funding_id
    where f.success_at is null and f.status in ('approved', 'closed') and f.moq > 0 and t.qty >= f.moq
  )
  update public.fundings f
  set success_at = coalesce(r.reached_at, now()),
      final_quantity = r.qty,
      success_participant_count = r.participants,
      success_backfilled = true,
      funding_status = case
        when f.production_status is not null and f.production_status <> 'funding_success' then 'production'
        else 'success' end
  from reached r
  where f.id = r.funding_id;
  get diagnostics v_count = row_count;

  -- 목표 미달이어도 이미 제작 단계로 넘어간 펀딩은 production 으로 표시
  update public.fundings
  set funding_status = 'production'
  where funding_status <> 'production'
    and production_status is not null and production_status <> 'funding_success';
  return v_count;
end;
$$;

revoke all on function public._backfill_funding_success() from public, anon, authenticated;

select public._backfill_funding_success();

-- ---------------------------------------------------------------------------
-- 8. 외부 발송 큐 처리 (service_role 전용: dispatch-notifications Edge Function)
-- ---------------------------------------------------------------------------

-- 발송할 작업을 가져가며 'sending' 으로 잠근다(FOR UPDATE SKIP LOCKED → 동시 디스패처도 같은 건을 두 번 못 가져감).
-- 휴대폰 번호는 이 시점에 서버에서만 조회해 Edge Function 으로 넘긴다(로그에는 마스킹만 저장).
create or replace function public.claim_notification_jobs(
  p_funding_id uuid default null,
  p_log_id uuid default null,
  p_limit integer default 20
)
returns table (
  log_id uuid,
  event_type text,
  recipient_role text,
  channel text,
  phone text,
  payload jsonb,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_job public.notification_logs%rowtype;
  v_phone text;
  v_settings public.creator_notification_settings%rowtype;
  v_channels jsonb := coalesce((select value from public.platform_settings where key = 'notification_channels'), '{}'::jsonb);
  v_channel_on boolean;
begin
  -- 결과를 모른 채 멈춘 발송(10분 초과 sending)은 자동 재시도하지 않고 실패로 돌려 관리자가 확인 후 재발송한다(중복 문자 방지).
  update public.notification_logs
  set status = 'failed', locked_at = null,
      error_message = '발송 결과 확인 불가(처리 시간 초과). 수신 여부 확인 후 재발송하세요.'
  where status = 'sending' and locked_at < now() - interval '10 minutes';

  for v_job in
    select * from public.notification_logs l
    where l.status = 'pending'
      and l.channel in ('sms', 'alimtalk')
      and (p_funding_id is null or l.funding_id = p_funding_id)
      and (p_log_id is null or l.id = p_log_id)
    order by l.created_at
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
    for update skip locked
  loop
    v_channel_on := coalesce((v_channels ->> case when v_job.channel = 'alimtalk' then 'kakao_alimtalk' else 'sms' end)::boolean, false);

    if v_job.recipient_role = 'creator' then
      select * into v_settings from public.creator_notification_settings where user_id = v_job.recipient_id;
      v_phone := public._creator_notification_phone(v_job.recipient_id);
      if not coalesce(v_settings.funding_success_notifications_enabled, true) or not coalesce(v_settings.sms_notifications_enabled, true) then
        update public.notification_logs
        set status = 'skipped', skip_reason = '제작자가 SMS/펀딩 성공 알림 수신을 끔', recipient_masked = public.mask_kr_phone(v_phone)
        where id = v_job.id;
        continue;
      end if;
    else
      select public.normalize_kr_phone(coalesce(fp.orderer_phone, fp.recipient_phone)) into v_phone
      from public.funding_participations fp
      where fp.funding_id = v_job.funding_id and fp.participant_id = v_job.recipient_id
      order by fp.created_at desc limit 1;
    end if;

    if v_phone is null then
      update public.notification_logs
      set status = 'skipped', skip_reason = case when v_job.recipient_role = 'creator' then '제작자 휴대폰 번호 미등록' else '참여자 휴대폰 번호 없음' end,
          recipient_masked = null
      where id = v_job.id;
      continue;
    end if;

    if not v_channel_on then
      update public.notification_logs
      set status = 'failed', recipient_masked = public.mask_kr_phone(v_phone), last_attempt_at = now(),
          error_message = '시스템 설정에서 ' || case when v_job.channel = 'alimtalk' then '알림톡' else 'SMS' end
            || ' 채널이 꺼져 있습니다(notification_channels). 연동 후 켜고 재발송하세요.'
      where id = v_job.id;
      continue;
    end if;

    update public.notification_logs
    set status = 'sending', locked_at = now(), last_attempt_at = now(), attempt_count = attempt_count + 1,
        recipient_masked = public.mask_kr_phone(v_phone), error_message = null
    where id = v_job.id;

    log_id := v_job.id;
    event_type := v_job.event_type;
    recipient_role := v_job.recipient_role;
    channel := v_job.channel;
    phone := v_phone;
    payload := v_job.payload;
    attempt_count := v_job.attempt_count + 1;
    return next;
  end loop;
end;
$$;

revoke all on function public.claim_notification_jobs(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_notification_jobs(uuid, uuid, integer) to service_role;

create or replace function public.complete_notification_job(
  p_log_id uuid,
  p_success boolean,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.notification_logs%rowtype;
begin
  select * into v_job from public.notification_logs where id = p_log_id for update;
  if not found or v_job.status <> 'sending' then
    return false;
  end if;

  update public.notification_logs
  set status = case when p_success then 'sent' else 'failed' end,
      sent_at = case when p_success then now() else sent_at end,
      provider = left(p_provider, 40),
      provider_message_id = left(p_provider_message_id, 200),
      error_message = case when p_success then null else left(coalesce(p_error, '알 수 없는 오류'), 1000) end,
      locked_at = null
  where id = p_log_id;

  if p_success and v_job.event_type = 'funding_success' and v_job.recipient_role = 'creator' and v_job.channel in ('sms', 'alimtalk') then
    update public.fundings
    set success_sms_sent = true, success_sms_sent_at = coalesce(success_sms_sent_at, now())
    where id = v_job.funding_id;
  end if;
  return true;
end;
$$;

revoke all on function public.complete_notification_job(uuid, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.complete_notification_job(uuid, boolean, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 9. 관리자: 알림 발송 내역 / 재발송 (notifications.send 권한)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_funding_success_notifications(
  p_search text default null,
  p_filter text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  funding_id uuid,
  product_name text,
  creator_id uuid,
  creator_name text,
  target_quantity integer,
  final_quantity integer,
  current_orders integer,
  success_at timestamptz,
  success_backfilled boolean,
  funding_status text,
  site_sent boolean,
  site_sent_at timestamptz,
  site_status text,
  sms_log_id uuid,
  sms_status text,
  sms_sent boolean,
  sms_sent_at timestamptz,
  sms_recipient text,
  sms_provider text,
  sms_attempts integer,
  sms_resend_count integer,
  sms_error text,
  sms_skip_reason text,
  sms_last_attempt_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_filter text := coalesce(nullif(p_filter, ''), 'all');
begin
  perform public._admin_require('notifications.send');
  return query
  with rows as (
    select
      f.id, f.product_name, f.creator_id,
      coalesce(cp.display_name, prof.username, prof.full_name, '-') as creator_name,
      f.moq, f.final_quantity, f.current_orders, f.success_at, f.success_backfilled, f.funding_status,
      f.success_notification_sent, f.success_notification_sent_at,
      site.status as site_status,
      sms.id as sms_id, sms.status as sms_status, f.success_sms_sent, f.success_sms_sent_at,
      sms.recipient_masked, sms.provider, sms.attempt_count, sms.resend_count, sms.error_message, sms.skip_reason, sms.last_attempt_at
    from public.fundings f
    left join public.creator_profiles cp on cp.user_id = f.creator_id
    left join public.profiles prof on prof.id = f.creator_id
    left join public.notification_logs site
      on site.idempotency_key = 'funding_success:' || f.id || ':creator:' || f.creator_id || ':site'
    left join public.notification_logs sms
      on sms.idempotency_key = 'funding_success:' || f.id || ':creator:' || f.creator_id || ':sms'
    where f.success_at is not null
      and (v_search is null or f.product_name ilike '%' || v_search || '%'
           or coalesce(cp.display_name, '') ilike '%' || v_search || '%')
      and (
        v_filter = 'all'
        or (v_filter = 'sms_failed' and sms.status = 'failed')
        or (v_filter = 'sms_skipped' and sms.status = 'skipped')
        or (v_filter = 'sms_pending' and sms.status in ('pending', 'sending'))
        or (v_filter = 'sms_sent' and sms.status = 'sent')
        or (v_filter = 'backfilled' and f.success_backfilled)
      )
  )
  select r.id, r.product_name, r.creator_id, r.creator_name, r.moq, r.final_quantity, r.current_orders, r.success_at,
         r.success_backfilled, r.funding_status, r.success_notification_sent, r.success_notification_sent_at, r.site_status,
         r.sms_id, r.sms_status, r.success_sms_sent, r.success_sms_sent_at, r.recipient_masked, r.provider,
         r.attempt_count, r.resend_count, r.error_message, r.skip_reason, r.last_attempt_at,
         count(*) over ()
  from rows r
  order by r.success_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_funding_success_notifications(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_funding_success_notifications(text, text, integer, integer) to authenticated;

create or replace function public.admin_get_notification_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_channels jsonb := coalesce((select value from public.platform_settings where key = 'notification_channels'), '{}'::jsonb);
begin
  perform public._admin_require('notifications.send');
  return jsonb_build_object(
    'success_fundings', (select count(*) from public.fundings where success_at is not null and not success_backfilled),
    'backfilled', (select count(*) from public.fundings where success_backfilled),
    'site_sent', (select count(*) from public.notification_logs where channel = 'site' and status = 'sent'),
    'sms_sent', (select count(*) from public.notification_logs where channel in ('sms', 'alimtalk') and status = 'sent'),
    'sms_failed', (select count(*) from public.notification_logs where channel in ('sms', 'alimtalk') and status = 'failed'),
    'sms_skipped', (select count(*) from public.notification_logs where channel in ('sms', 'alimtalk') and status = 'skipped'),
    'sms_pending', (select count(*) from public.notification_logs where channel in ('sms', 'alimtalk') and status in ('pending', 'sending')),
    'sms_channel_enabled', coalesce((v_channels ->> 'sms')::boolean, false),
    'notify_participants', public._platform_setting_bool('funding_success_notify_participants', false)
  );
end;
$$;

revoke all on function public.admin_get_notification_summary() from public, anon;
grant execute on function public.admin_get_notification_summary() to authenticated;

-- 재발송: 실패/건너뜀 건만 다시 대기열로 돌린다. 이미 발송된 건은 거부(중복 문자 방지).
-- 실제 발송은 이어서 호출되는 dispatch-notifications 가 처리한다.
create or replace function public.admin_resend_notification(p_log_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('notifications.send');
  v_job public.notification_logs%rowtype;
  v_label text;
begin
  select * into v_job from public.notification_logs where id = p_log_id for update;
  if not found then
    raise exception '발송 기록을 찾을 수 없습니다.';
  end if;
  if v_job.channel not in ('sms', 'alimtalk') then
    raise exception '외부 발송(SMS/알림톡) 건만 재발송할 수 있습니다.';
  end if;
  if v_job.status = 'sent' then
    raise exception '이미 발송된 알림입니다. 중복 발송을 막기 위해 재발송할 수 없습니다.';
  end if;
  if v_job.status in ('pending', 'sending') then
    raise exception '이미 발송 대기/처리 중인 알림입니다.';
  end if;

  update public.notification_logs
  set status = 'pending', resend_count = resend_count + 1, last_resend_by = v_actor,
      last_resend_reason = nullif(btrim(coalesce(p_reason, '')), ''), skip_reason = null, locked_at = null
  where id = p_log_id;

  select product_name into v_label from public.fundings where id = v_job.funding_id;
  perform public._admin_log(
    'notification.resend', 'notification_log', p_log_id::text, v_label,
    jsonb_build_object('status', v_job.status, 'error', v_job.error_message, 'skip_reason', v_job.skip_reason),
    jsonb_build_object('status', 'pending'),
    nullif(btrim(coalesce(p_reason, '')), ''),
    jsonb_build_object('funding_id', v_job.funding_id, 'channel', v_job.channel, 'recipient_role', v_job.recipient_role)
  );
  return jsonb_build_object('log_id', p_log_id, 'funding_id', v_job.funding_id, 'status', 'pending');
end;
$$;

revoke all on function public.admin_resend_notification(uuid, text) from public, anon;
grant execute on function public.admin_resend_notification(uuid, text) to authenticated;
