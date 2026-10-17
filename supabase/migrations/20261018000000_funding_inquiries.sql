-- 펀딩 상품 문의 (고객 ↔ 제작자 · BRAND-ER 관리자) + 문의 알림
--
-- 원칙
--  * 추가(additive) 전용: 기존 테이블·데이터는 삭제/초기화하지 않는다.
--    기존 펀딩 문의(cs_tickets, category = 'funding')는 그대로 두고 관리자 CS 화면에서 계속 처리한다.
--  * 문의는 로그인 회원이면 구매 여부와 관계없이 작성할 수 있다(본인 펀딩 제외).
--  * 답변 권한은 서버에서만 판단한다: 해당 펀딩의 제작자(fundings.creator_id) 또는 cs.manage 권한 관리자.
--  * 비공개 문의의 제목·내용·사진·답변은 작성자 / 담당 제작자 / cs.view 관리자에게만 내려간다(RPC + RLS + Storage 정책).
--  * 알림은 기존 community_notifications(사이트 알림) + notification_logs(SMS 큐, idempotency_key UNIQUE)를 재사용한다.
--    - 문의 등록 → 담당 제작자: 사이트 알림 + SMS(시스템 SMS 채널 ON · 제작자 SMS 수신 ON · 번호 등록 시에만 발송)
--    - 답변 등록 → 문의 작성자: 사이트 알림만. 고객 SMS 수신 동의 항목이 DB 에 없으므로 고객에게 SMS 를 보내지 않는다.
--    - 답변 수정 시에는 다시 알리지 않는다(문의당 1회).

-- ---------------------------------------------------------------------------
-- 1. 문의 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.funding_inquiries (
  id uuid primary key default gen_random_uuid(),
  funding_id uuid not null references public.fundings(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  inquiry_type text not null default 'other',
  title text not null,
  content text not null,
  image_paths text[] not null default '{}'::text[],
  is_private boolean not null default false,
  status text not null default 'pending',
  answer_content text,
  answer_author_id uuid references auth.users(id) on delete set null,
  answer_role text,
  answered_at timestamptz,
  answer_updated_at timestamptz,
  is_hidden boolean not null default false,
  hidden_reason text,
  hidden_by uuid references auth.users(id) on delete set null,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_inquiries_type_check check (inquiry_type in (
    'size_fit', 'fabric', 'production', 'shipping', 'exchange_refund', 'other'
  )),
  constraint funding_inquiries_status_check check (status in ('pending', 'answered')),
  constraint funding_inquiries_answer_role_check check (answer_role is null or answer_role in ('creator', 'admin')),
  constraint funding_inquiries_title_length check (char_length(btrim(title)) between 2 and 100),
  constraint funding_inquiries_content_length check (char_length(btrim(content)) between 5 and 3000),
  constraint funding_inquiries_answer_length check (answer_content is null or char_length(btrim(answer_content)) between 2 and 3000),
  constraint funding_inquiries_images_max check (coalesce(array_length(image_paths, 1), 0) <= 5),
  constraint funding_inquiries_answered_has_answer check (status = 'pending' or answer_content is not null),
  constraint funding_inquiries_hidden_reason_length check (hidden_reason is null or char_length(hidden_reason) <= 500)
);

comment on table public.funding_inquiries is
  '펀딩 상품 문의. 작성/수정/삭제/답변은 RPC 로만 한다. 비공개 문의는 작성자·담당 제작자·관리자(cs.view)만 내용을 본다.';
comment on column public.funding_inquiries.answer_role is
  'creator = 제작자 답변, admin = BRAND-ER 관리자 답변 (고객 화면 표시용)';

create index if not exists funding_inquiries_funding_idx on public.funding_inquiries (funding_id, created_at desc);
create index if not exists funding_inquiries_author_idx on public.funding_inquiries (author_id, created_at desc);
create index if not exists funding_inquiries_status_idx on public.funding_inquiries (status, created_at desc);

drop trigger if exists funding_inquiries_set_updated_at on public.funding_inquiries;
create trigger funding_inquiries_set_updated_at
before update on public.funding_inquiries
for each row execute function public.set_creator_brand_updated_at();

-- RLS: 직접 조회는 SELECT 만 허용하고 행 단위로 권한을 나눈다. 쓰기는 모두 SECURITY DEFINER RPC 로만 한다.
alter table public.funding_inquiries enable row level security;
revoke all on public.funding_inquiries from anon, authenticated;
-- 답변자 · 숨김 처리자 계정 ID 와 숨김 사유는 직접 조회에서 제외한다(관리자 RPC 로만 확인).
grant select (
  id, funding_id, author_id, nickname, inquiry_type, title, content, image_paths, is_private, status,
  answer_content, answer_role, answered_at, answer_updated_at, is_hidden, created_at, updated_at
) on public.funding_inquiries to authenticated;
grant all on public.funding_inquiries to service_role;

drop policy if exists "Funding inquiries visible by role" on public.funding_inquiries;
create policy "Funding inquiries visible by role"
  on public.funding_inquiries for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or (not is_private and not is_hidden)
    or exists (select 1 from public.fundings f where f.id = funding_id and f.creator_id = (select auth.uid()))
    or public.has_admin_permission('cs.view')
  );

-- ---------------------------------------------------------------------------
-- 2. 권한 헬퍼 (내부 전용)
-- ---------------------------------------------------------------------------

-- 문의 작성자 표시 닉네임: 프로필 아이디(이메일 형태 제외) → 이름 마스킹 → '고객'
create or replace function public._inquiry_nickname(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(btrim(p.username), '') from public.profiles p
      where p.id = p_user and p.username is not null and position('@' in p.username) = 0),
    (select case
        when char_length(n) <= 1 then n || '*'
        when char_length(n) = 2 then left(n, 1) || '*'
        else left(n, 1) || repeat('*', char_length(n) - 2) || right(n, 1)
      end
      from (select nullif(btrim(p.full_name), '') as n from public.profiles p where p.id = p_user) x
      where n is not null),
    '고객'
  );
$$;

revoke all on function public._inquiry_nickname(uuid) from public, anon, authenticated;

-- 문의 내용(비공개 포함)을 볼 수 있는가: 작성자 · 담당 제작자 · cs.view 관리자, 또는 공개(숨김 아님) 문의
create or replace function public._can_view_funding_inquiry(p_inquiry public.funding_inquiries, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (p_user is not null and p_inquiry.author_id = p_user)
    or (not p_inquiry.is_private and not p_inquiry.is_hidden)
    or (p_user is not null and exists (
      select 1 from public.fundings f where f.id = p_inquiry.funding_id and f.creator_id = p_user))
    or public._admin_has_permission(p_user, 'cs.view');
$$;

revoke all on function public._can_view_funding_inquiry(public.funding_inquiries, uuid) from public, anon, authenticated;

-- 답변자 역할: 담당 제작자면 'creator', cs.manage 관리자면 'admin', 둘 다 아니면 null(권한 없음)
create or replace function public._funding_inquiry_answer_role(p_funding_id uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user is null then null
    when exists (select 1 from public.fundings f where f.id = p_funding_id and f.creator_id = p_user) then 'creator'
    when public._admin_has_permission(p_user, 'cs.manage') then 'admin'
    else null
  end;
$$;

revoke all on function public._funding_inquiry_answer_role(uuid, uuid) from public, anon, authenticated;

-- 첨부 사진 검증: 본인 폴더(<uid>/...)에 실제로 업로드된 파일만, 최대 5장
create or replace function public._validate_inquiry_images(p_paths text[], p_user uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paths text[] := coalesce(p_paths, '{}'::text[]);
  v_path text;
begin
  if coalesce(array_length(v_paths, 1), 0) > 5 then
    raise exception '사진은 최대 5장까지 첨부할 수 있습니다.';
  end if;
  foreach v_path in array v_paths loop
    if v_path is null or v_path not like p_user::text || '/%' or v_path like '%..%' then
      raise exception '본인이 업로드한 사진만 첨부할 수 있습니다.' using errcode = '42501';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'funding-inquiries' and o.name = v_path) then
      raise exception '첨부 사진을 찾을 수 없습니다. 다시 업로드해주세요.';
    end if;
  end loop;
  return v_paths;
end;
$$;

revoke all on function public._validate_inquiry_images(text[], uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. 첨부 사진 Storage (비공개 버킷: 본인 폴더 업로드, 문의 열람 권한이 있는 사람만 읽기)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('funding-inquiries', 'funding-inquiries', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

create or replace function public.can_read_funding_inquiry_image(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.funding_inquiries i
    where p_name = any(i.image_paths)
      and public._can_view_funding_inquiry(i, auth.uid())
  );
$$;

revoke all on function public.can_read_funding_inquiry_image(text) from public;
grant execute on function public.can_read_funding_inquiry_image(text) to anon, authenticated;

drop policy if exists "Members can upload own inquiry images" on storage.objects;
create policy "Members can upload own inquiry images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'funding-inquiries'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Members can delete own inquiry images" on storage.objects;
create policy "Members can delete own inquiry images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'funding-inquiries'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Inquiry images readable by allowed viewers" on storage.objects;
create policy "Inquiry images readable by allowed viewers"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'funding-inquiries'
    and (
      (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text)
      or public.can_read_funding_inquiry_image(name)
    )
  );

-- ---------------------------------------------------------------------------
-- 4. 알림 (사이트 알림 + SMS 큐) — 기존 테이블 확장
-- ---------------------------------------------------------------------------

alter table public.community_notifications
  drop constraint if exists community_notifications_type_check,
  add constraint community_notifications_type_check check (type in (
    'like', 'comment', 'reply', 'purchase_intent', 'poll_vote', 'follow',
    'purchase_intent_goal', 'funding_started', 'funding_status_changed',
    'participation_cancelled', 'funding_cancelled', 'admin_notice',
    'funding_success', 'funding_success_participant',
    'funding_early_closed',
    'funding_inquiry', 'funding_inquiry_answer'
  ));

alter table public.notification_logs
  drop constraint if exists notification_logs_event_type_check,
  add constraint notification_logs_event_type_check check (event_type in (
    'funding_success', 'funding_early_closed', 'funding_inquiry_created', 'funding_inquiry_answered'
  ));

alter table public.notification_logs
  drop constraint if exists notification_logs_recipient_role_check,
  add constraint notification_logs_recipient_role_check check (recipient_role in ('creator', 'participant', 'customer'));

-- 문의 등록 → 담당 제작자 (사이트 알림 1회 + SMS 작업 1회)
create or replace function public._enqueue_funding_inquiry_created(p_inquiry public.funding_inquiries)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
  v_payload jsonb;
  v_site_key text;
  v_sms_key text;
  v_notification_id uuid;
  v_phone text;
  v_settings public.creator_notification_settings%rowtype;
  v_channels jsonb := coalesce((select value from public.platform_settings where key = 'notification_channels'), '{}'::jsonb);
  v_sms_on boolean;
  v_skip text;
begin
  select * into v_funding from public.fundings where id = p_inquiry.funding_id;
  if not found or v_funding.creator_id is null or v_funding.creator_id = p_inquiry.author_id then
    return;
  end if;

  v_payload := jsonb_build_object(
    'funding_name', v_funding.product_name,
    'inquiry_id', p_inquiry.id,
    'inquiry_type', p_inquiry.inquiry_type,
    'is_private', p_inquiry.is_private
  );
  v_site_key := 'funding_inquiry_created:' || p_inquiry.id || ':creator:' || v_funding.creator_id || ':site';
  v_sms_key := 'funding_inquiry_created:' || p_inquiry.id || ':creator:' || v_funding.creator_id || ':sms';

  insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload, sent_at, idempotency_key)
  values ('funding_inquiry_created', v_funding.id, v_funding.creator_id, 'creator', 'site', 'sent', v_payload, now(), v_site_key)
  on conflict (idempotency_key) do nothing;
  if found then
    insert into public.community_notifications (recipient_id, actor_id, type, funding_id, title, message, link_path)
    values (
      v_funding.creator_id, p_inquiry.author_id, 'funding_inquiry', v_funding.id,
      '새 상품 문의가 등록되었습니다',
      '[' || v_funding.product_name || '] 펀딩에 새 상품 문의가 등록되었습니다. 답변을 남겨주세요.',
      '/fundings/' || v_funding.id || '?tab=inquiry'
    )
    returning id into v_notification_id;
    update public.notification_logs set notification_id = v_notification_id where idempotency_key = v_site_key;
  end if;

  -- SMS: 시스템 채널 · 제작자 수신 설정 · 번호를 지금 확인하고, 실제 발송 직전(claim)에 한 번 더 확인한다.
  v_sms_on := coalesce((v_channels ->> 'sms')::boolean, false);
  select * into v_settings from public.creator_notification_settings where user_id = v_funding.creator_id;
  v_phone := public._creator_notification_phone(v_funding.creator_id);
  v_skip := case
    when not v_sms_on then 'SMS 채널 비활성화(notification_channels)'
    when not coalesce(v_settings.sms_notifications_enabled, true) then '제작자가 SMS 수신을 끔'
    when v_phone is null then '제작자 휴대폰 번호 미등록'
  end;

  insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload,
                                        recipient_masked, skip_reason, idempotency_key)
  values ('funding_inquiry_created', v_funding.id, v_funding.creator_id, 'creator', 'sms',
          case when v_skip is null then 'pending' else 'skipped' end, v_payload,
          public.mask_kr_phone(v_phone), v_skip, v_sms_key)
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke all on function public._enqueue_funding_inquiry_created(public.funding_inquiries) from public, anon, authenticated;

-- 첫 답변 → 문의 작성자 (사이트 알림 1회). 고객 SMS 수신 동의 항목이 없으므로 SMS 는 만들지 않는다.
create or replace function public._enqueue_funding_inquiry_answered(p_inquiry public.funding_inquiries)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
  v_key text := 'funding_inquiry_answered:' || p_inquiry.id || ':customer:' || p_inquiry.author_id || ':site';
  v_notification_id uuid;
  v_label text := case when p_inquiry.answer_role = 'admin' then 'BRAND-ER 관리자' else '제작자' end;
begin
  if p_inquiry.answer_author_id = p_inquiry.author_id then
    return;
  end if;
  select * into v_funding from public.fundings where id = p_inquiry.funding_id;
  if not found then
    return;
  end if;

  insert into public.notification_logs (event_type, funding_id, recipient_id, recipient_role, channel, status, payload, sent_at, idempotency_key)
  values ('funding_inquiry_answered', v_funding.id, p_inquiry.author_id, 'customer', 'site', 'sent',
          jsonb_build_object('funding_name', v_funding.product_name, 'inquiry_id', p_inquiry.id, 'answer_role', p_inquiry.answer_role),
          now(), v_key)
  on conflict (idempotency_key) do nothing;
  if found then
    insert into public.community_notifications (recipient_id, actor_id, type, funding_id, title, message, link_path)
    values (
      p_inquiry.author_id, p_inquiry.answer_author_id, 'funding_inquiry_answer', v_funding.id,
      '문의에 ' || v_label || ' 답변이 등록되었습니다',
      '[' || v_funding.product_name || '] 펀딩에 남기신 문의 "' || left(p_inquiry.title, 40) || '"에 ' || v_label || ' 답변이 등록되었습니다.',
      '/fundings/' || v_funding.id || '?tab=inquiry'
    )
    returning id into v_notification_id;
    update public.notification_logs set notification_id = v_notification_id where idempotency_key = v_key;
  end if;
end;
$$;

revoke all on function public._enqueue_funding_inquiry_answered(public.funding_inquiries) from public, anon, authenticated;

-- 발송 직전 확인(claim)에서 '펀딩 성공 알림 수신' 설정은 펀딩 성공 알림에만 적용한다(문의 알림은 SMS 수신 설정만 확인).
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
      v_settings := null;
      select * into v_settings from public.creator_notification_settings where user_id = v_job.recipient_id;
      v_phone := public._creator_notification_phone(v_job.recipient_id);
      if not coalesce(v_settings.sms_notifications_enabled, true)
        or (v_job.event_type = 'funding_success' and not coalesce(v_settings.funding_success_notifications_enabled, true)) then
        update public.notification_logs
        set status = 'skipped',
            skip_reason = case when v_job.event_type = 'funding_success' then '제작자가 SMS/펀딩 성공 알림 수신을 끔' else '제작자가 SMS 수신을 끔' end,
            recipient_masked = public.mask_kr_phone(v_phone)
        where id = v_job.id;
        continue;
      end if;
    elsif v_job.recipient_role = 'participant' then
      select public.normalize_kr_phone(coalesce(fp.orderer_phone, fp.recipient_phone)) into v_phone
      from public.funding_participations fp
      where fp.funding_id = v_job.funding_id and fp.participant_id = v_job.recipient_id
      order by fp.created_at desc limit 1;
    else
      -- 고객(문의 작성자) SMS 는 수신 동의 정보가 없어 발송하지 않는다.
      update public.notification_logs
      set status = 'skipped', skip_reason = '고객 SMS 수신 동의 정보 없음'
      where id = v_job.id;
      continue;
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

-- ---------------------------------------------------------------------------
-- 5. 고객 · 제작자 RPC
-- ---------------------------------------------------------------------------

-- 행 하나를 화면용 JSON 으로. 열람 권한이 없으면 비공개 내용(제목·내용·사진·답변)을 지운다.
create or replace function public._funding_inquiry_json(p_inquiry public.funding_inquiries, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_can_view boolean := public._can_view_funding_inquiry(p_inquiry, p_user);
  v_is_mine boolean := p_user is not null and p_inquiry.author_id = p_user;
begin
  return jsonb_build_object(
    'id', p_inquiry.id,
    'inquiry_type', p_inquiry.inquiry_type,
    'title', case when v_can_view then p_inquiry.title else '비공개 문의입니다.' end,
    'content', case when v_can_view then p_inquiry.content end,
    'image_paths', case when v_can_view then to_jsonb(p_inquiry.image_paths) else '[]'::jsonb end,
    'is_private', p_inquiry.is_private,
    'is_hidden', p_inquiry.is_hidden,
    'status', p_inquiry.status,
    'nickname', p_inquiry.nickname,
    'is_mine', v_is_mine,
    'can_view', v_can_view,
    'can_edit', v_is_mine and p_inquiry.answer_content is null,
    'created_at', p_inquiry.created_at,
    'updated_at', p_inquiry.updated_at,
    'answer', case when v_can_view and p_inquiry.answer_content is not null then jsonb_build_object(
      'content', p_inquiry.answer_content,
      'role', p_inquiry.answer_role,
      'answered_at', p_inquiry.answered_at,
      'updated_at', p_inquiry.answer_updated_at
    ) end
  );
end;
$$;

revoke all on function public._funding_inquiry_json(public.funding_inquiries, uuid) from public, anon, authenticated;

-- 펀딩 상세 [상품 문의] 목록. 비로그인도 공개 문의를 볼 수 있다.
--  p_filter: all | mine | pending | answered,  p_type: 문의 유형 또는 null
create or replace function public.list_funding_inquiries(
  p_funding_id uuid,
  p_filter text default 'all',
  p_type text default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_filter text := case when p_filter in ('all', 'mine', 'pending', 'answered') then p_filter else 'all' end;
  v_funding public.fundings%rowtype;
  v_found boolean;
  v_is_creator boolean;
  v_is_staff boolean;
begin
  select * into v_funding from public.fundings where id = p_funding_id;
  v_found := found;
  v_is_creator := v_found and v_user is not null and v_funding.creator_id = v_user;
  v_is_staff := public._admin_has_permission(v_user, 'cs.view');
  if not v_found or (v_funding.status not in ('approved', 'closed') and not v_is_creator and not v_is_staff) then
    return jsonb_build_object('total', 0, 'pending', 0, 'rows', '[]'::jsonb,
      'viewer', jsonb_build_object('logged_in', v_user is not null, 'is_creator', false, 'can_answer', false, 'can_ask', false));
  end if;

  return (
    with base as (
      select i.* from public.funding_inquiries i
      where i.funding_id = p_funding_id
        -- 숨김 문의는 작성자 · 담당 제작자 · 관리자에게만 남긴다
        and (not i.is_hidden or i.author_id = v_user or v_is_creator or v_is_staff)
        and (p_type is null or i.inquiry_type = p_type)
    ),
    filtered as (
      select b.* from base b
      where v_filter = 'all'
         or (v_filter = 'mine' and b.author_id = v_user)
         or (v_filter = 'pending' and b.status = 'pending')
         or (v_filter = 'answered' and b.status = 'answered')
    ),
    page as (
      select f.* from filtered f order by f.created_at desc limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'pending', (select count(*) from base where status = 'pending'),
      'rows', coalesce((select jsonb_agg(public._funding_inquiry_json(p, v_user) order by p.created_at desc) from page p), '[]'::jsonb),
      'viewer', jsonb_build_object(
        'logged_in', v_user is not null,
        'is_creator', v_is_creator,
        'can_answer', public._funding_inquiry_answer_role(p_funding_id, v_user) is not null,
        'can_ask', v_user is not null and not v_is_creator and v_funding.status in ('approved', 'closed')
      )
    )
  );
end;
$$;

revoke all on function public.list_funding_inquiries(uuid, text, text, integer, integer) from public;
grant execute on function public.list_funding_inquiries(uuid, text, text, integer, integer) to anon, authenticated;

create or replace function public.create_funding_product_inquiry(
  p_funding_id uuid,
  p_inquiry_type text,
  p_title text,
  p_content text,
  p_image_paths text[] default '{}'::text[],
  p_is_private boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_funding public.fundings%rowtype;
  v_row public.funding_inquiries%rowtype;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  select * into v_funding from public.fundings where id = p_funding_id;
  if not found or v_funding.status not in ('approved', 'closed') then
    raise exception '문의할 수 없는 펀딩입니다.';
  end if;
  if v_funding.creator_id = v_user then
    raise exception '본인이 등록한 펀딩에는 문의를 남길 수 없습니다.';
  end if;
  if (select count(*) from public.funding_inquiries
      where author_id = v_user and created_at > now() - interval '1 day') >= 20 then
    raise exception '하루에 남길 수 있는 문의 수(20건)를 초과했습니다. 내일 다시 시도해주세요.';
  end if;

  insert into public.funding_inquiries (funding_id, author_id, nickname, inquiry_type, title, content, image_paths, is_private)
  values (
    p_funding_id, v_user, public._inquiry_nickname(v_user),
    coalesce(p_inquiry_type, 'other'), btrim(coalesce(p_title, '')), btrim(coalesce(p_content, '')),
    public._validate_inquiry_images(p_image_paths, v_user), coalesce(p_is_private, false)
  )
  returning * into v_row;

  perform public._enqueue_funding_inquiry_created(v_row);
  return v_row.id;
end;
$$;

revoke all on function public.create_funding_product_inquiry(uuid, text, text, text, text[], boolean) from public, anon;
grant execute on function public.create_funding_product_inquiry(uuid, text, text, text, text[], boolean) to authenticated;

-- 답변 전 문의만 본인이 수정 · 삭제할 수 있다.
create or replace function public.update_my_funding_inquiry(
  p_inquiry_id uuid,
  p_inquiry_type text,
  p_title text,
  p_content text,
  p_image_paths text[],
  p_is_private boolean
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.funding_inquiries%rowtype;
  v_paths text[];
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  select * into v_row from public.funding_inquiries where id = p_inquiry_id for update;
  if not found or v_row.author_id <> v_user then
    raise exception '본인이 작성한 문의만 수정할 수 있습니다.' using errcode = '42501';
  end if;
  if v_row.answer_content is not null then
    raise exception '답변이 등록된 문의는 수정할 수 없습니다.';
  end if;

  v_paths := public._validate_inquiry_images(p_image_paths, v_user);
  update public.funding_inquiries
  set inquiry_type = coalesce(p_inquiry_type, inquiry_type),
      title = btrim(coalesce(p_title, '')),
      content = btrim(coalesce(p_content, '')),
      image_paths = v_paths,
      is_private = coalesce(p_is_private, is_private)
  where id = p_inquiry_id;

  -- 더 이상 쓰지 않는 사진 경로(클라이언트가 Storage 에서 지운다)
  return array(select unnest(v_row.image_paths) except select unnest(v_paths));
end;
$$;

revoke all on function public.update_my_funding_inquiry(uuid, text, text, text, text[], boolean) from public, anon;
grant execute on function public.update_my_funding_inquiry(uuid, text, text, text, text[], boolean) to authenticated;

create or replace function public.delete_my_funding_inquiry(p_inquiry_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.funding_inquiries%rowtype;
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  select * into v_row from public.funding_inquiries where id = p_inquiry_id for update;
  if not found or v_row.author_id <> v_user then
    raise exception '본인이 작성한 문의만 삭제할 수 있습니다.' using errcode = '42501';
  end if;
  if v_row.answer_content is not null then
    raise exception '답변이 등록된 문의는 삭제할 수 없습니다.';
  end if;
  delete from public.funding_inquiries where id = p_inquiry_id;
  return v_row.image_paths;
end;
$$;

revoke all on function public.delete_my_funding_inquiry(uuid) from public, anon;
grant execute on function public.delete_my_funding_inquiry(uuid) to authenticated;

-- 답변 등록 · 수정: 담당 제작자(제작자 답변) 또는 cs.manage 관리자(BRAND-ER 관리자 답변)만.
--  제작자는 제작자 답변만 고칠 수 있고, 관리자는 어떤 답변이든 고칠 수 있다(관리자 답변으로 바뀐다).
create or replace function public.answer_funding_inquiry(p_inquiry_id uuid, p_content text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.funding_inquiries%rowtype;
  v_role text;
  v_first boolean;
  v_content text := btrim(coalesce(p_content, ''));
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  select * into v_row from public.funding_inquiries where id = p_inquiry_id for update;
  if not found then
    raise exception '문의를 찾을 수 없습니다.';
  end if;
  v_role := public._funding_inquiry_answer_role(v_row.funding_id, v_user);
  if v_role is null then
    raise exception '이 문의에 답변할 권한이 없습니다.' using errcode = '42501';
  end if;
  if v_role = 'creator' and v_row.answer_role = 'admin' then
    raise exception 'BRAND-ER 관리자가 답변한 문의는 제작자가 수정할 수 없습니다.' using errcode = '42501';
  end if;
  if char_length(v_content) < 2 or char_length(v_content) > 3000 then
    raise exception '답변은 2자 이상 3000자 이하로 입력해주세요.';
  end if;

  v_first := v_row.answer_content is null;
  update public.funding_inquiries
  set answer_content = v_content,
      answer_author_id = v_user,
      answer_role = v_role,
      answered_at = coalesce(answered_at, now()),
      answer_updated_at = now(),
      status = 'answered'
  where id = p_inquiry_id
  returning * into v_row;

  if v_role = 'admin' then
    perform set_config('brander.admin_rpc', 'on', true);
    perform public._admin_log(
      case when v_first then 'inquiry.answer' else 'inquiry.answer_update' end,
      'funding_inquiry', v_row.id::text, left(v_row.title, 80),
      null, jsonb_build_object('answer', left(v_content, 500)), null,
      jsonb_build_object('funding_id', v_row.funding_id)
    );
  end if;

  if v_first then
    perform public._enqueue_funding_inquiry_answered(v_row);
  end if;
  return jsonb_build_object('status', v_row.status, 'answer_role', v_row.answer_role, 'first_answer', v_first);
end;
$$;

revoke all on function public.answer_funding_inquiry(uuid, text) from public, anon;
grant execute on function public.answer_funding_inquiry(uuid, text) to authenticated;

-- 답변 완료 여부 관리: 답변이 있는 문의를 '미답변(추가 확인 필요)'으로 되돌리거나 다시 '답변 완료'로.
create or replace function public.set_funding_inquiry_status(p_inquiry_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.funding_inquiries%rowtype;
  v_role text;
begin
  if p_status not in ('pending', 'answered') then
    raise exception '알 수 없는 상태입니다.';
  end if;
  select * into v_row from public.funding_inquiries where id = p_inquiry_id for update;
  if not found then
    raise exception '문의를 찾을 수 없습니다.';
  end if;
  v_role := public._funding_inquiry_answer_role(v_row.funding_id, v_user);
  if v_role is null then
    raise exception '이 문의의 상태를 바꿀 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_status = 'answered' and v_row.answer_content is null then
    raise exception '답변을 먼저 등록해주세요.';
  end if;
  update public.funding_inquiries set status = p_status where id = p_inquiry_id;
  if v_role = 'admin' then
    perform set_config('brander.admin_rpc', 'on', true);
    perform public._admin_log('inquiry.status', 'funding_inquiry', v_row.id::text, left(v_row.title, 80),
      jsonb_build_object('status', v_row.status), jsonb_build_object('status', p_status));
  end if;
  return p_status;
end;
$$;

revoke all on function public.set_funding_inquiry_status(uuid, text) from public, anon;
grant execute on function public.set_funding_inquiry_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 관리자 RPC (cs.view 조회 / cs.manage 답변·상태 / cs.manage 또는 reports.manage 숨김)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_funding_inquiries(
  p_status text default 'all',
  p_creator_id uuid default null,
  p_brand_id uuid default null,
  p_funding_id uuid default null,
  p_type text default null,
  p_from date default null,
  p_to date default null,
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
  v_actor uuid := public._admin_require('cs.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'members.pii');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  return (
    with base as (
      select i.*, f.product_name, f.creator_id, f.brand_id, f.status as funding_status_raw,
             b.brand_name,
             coalesce(nullif(btrim(cp.display_name), ''), nullif(btrim(cprof.username), ''), nullif(btrim(cprof.full_name), '')) as creator_name,
             aprof.username as author_username, aprof.full_name as author_full_name
      from public.funding_inquiries i
      join public.fundings f on f.id = i.funding_id
      left join public.brands b on b.id = f.brand_id
      left join public.creator_profiles cp on cp.user_id = f.creator_id
      left join public.profiles cprof on cprof.id = f.creator_id
      left join public.profiles aprof on aprof.id = i.author_id
      where (p_creator_id is null or f.creator_id = p_creator_id)
        and (p_brand_id is null or f.brand_id = p_brand_id)
        and (p_funding_id is null or i.funding_id = p_funding_id)
        and (p_type is null or i.inquiry_type = p_type)
        and (p_from is null or i.created_at >= (p_from::timestamp at time zone 'Asia/Seoul'))
        and (p_to is null or i.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Seoul'))
        and (v_search is null
          or i.nickname ilike '%' || v_search || '%'
          or aprof.username ilike '%' || v_search || '%'
          or (v_pii and aprof.full_name ilike '%' || v_search || '%')
          or i.title ilike '%' || v_search || '%')
    ),
    filtered as (
      select * from base
      where coalesce(p_status, 'all') = 'all'
         or (p_status = 'pending' and status = 'pending' and not is_hidden)
         or (p_status = 'answered' and status = 'answered' and not is_hidden)
         or (p_status = 'hidden' and is_hidden)
    ),
    page as (
      select * from filtered order by created_at desc limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'all', (select count(*) from base),
        'pending', (select count(*) from base where status = 'pending' and not is_hidden),
        'answered', (select count(*) from base where status = 'answered' and not is_hidden),
        'hidden', (select count(*) from base where is_hidden)
      ),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'funding_id', p.funding_id,
        'funding_name', p.product_name,
        'brand_name', p.brand_name,
        'creator_id', p.creator_id,
        'creator_name', p.creator_name,
        'author_id', p.author_id,
        'nickname', p.nickname,
        'author_username', p.author_username,
        'author_name', case when v_pii then p.author_full_name else public._mask_name(p.author_full_name) end,
        'inquiry_type', p.inquiry_type,
        'title', p.title,
        'is_private', p.is_private,
        'is_hidden', p.is_hidden,
        'status', p.status,
        'answer_role', p.answer_role,
        'image_count', coalesce(array_length(p.image_paths, 1), 0),
        'created_at', p.created_at,
        'answered_at', p.answered_at
      ) order by p.created_at desc) from page p), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_funding_inquiries(text, uuid, uuid, uuid, text, date, date, text, integer, integer) from public, anon;
grant execute on function public.admin_list_funding_inquiries(text, uuid, uuid, uuid, text, date, date, text, integer, integer) to authenticated;

create or replace function public.admin_get_funding_inquiry(p_inquiry_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('cs.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'members.pii');
  v_row public.funding_inquiries%rowtype;
  v_result jsonb;
begin
  select * into v_row from public.funding_inquiries where id = p_inquiry_id;
  if not found then
    raise exception '문의를 찾을 수 없습니다.';
  end if;

  select jsonb_build_object(
    'id', v_row.id,
    'funding_id', v_row.funding_id,
    'funding_name', f.product_name,
    'funding_status', f.status,
    'brand_name', b.brand_name,
    'creator_id', f.creator_id,
    'creator_name', coalesce(nullif(btrim(cp.display_name), ''), nullif(btrim(cprof.username), ''), nullif(btrim(cprof.full_name), '')),
    'author_id', v_row.author_id,
    'nickname', v_row.nickname,
    'author_username', aprof.username,
    'author_name', case when v_pii then aprof.full_name else public._mask_name(aprof.full_name) end,
    'inquiry_type', v_row.inquiry_type,
    'title', v_row.title,
    'content', v_row.content,
    'image_paths', to_jsonb(v_row.image_paths),
    'is_private', v_row.is_private,
    'status', v_row.status,
    'is_hidden', v_row.is_hidden,
    'hidden_reason', v_row.hidden_reason,
    'hidden_at', v_row.hidden_at,
    'hidden_by_name', case when v_row.hidden_by is not null then public._admin_display_name(v_row.hidden_by) end,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'answer', case when v_row.answer_content is not null then jsonb_build_object(
      'content', v_row.answer_content,
      'role', v_row.answer_role,
      'author_name', case when v_row.answer_author_id is not null then public._admin_display_name(v_row.answer_author_id) end,
      'answered_at', v_row.answered_at,
      'updated_at', v_row.answer_updated_at
    ) end,
    'can_manage', public._admin_has_permission(v_actor, 'cs.manage'),
    'can_moderate', public._admin_has_permission(v_actor, 'cs.manage') or public._admin_has_permission(v_actor, 'reports.manage')
  )
  into v_result
  from public.fundings f
  left join public.brands b on b.id = f.brand_id
  left join public.creator_profiles cp on cp.user_id = f.creator_id
  left join public.profiles cprof on cprof.id = f.creator_id
  left join public.profiles aprof on aprof.id = v_row.author_id
  where f.id = v_row.funding_id;
  return v_result;
end;
$$;

revoke all on function public.admin_get_funding_inquiry(uuid) from public, anon;
grant execute on function public.admin_get_funding_inquiry(uuid) to authenticated;

-- 부적절한 문의 숨김/해제 (삭제하지 않는다)
create or replace function public.admin_set_funding_inquiry_hidden(p_inquiry_id uuid, p_hidden boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.funding_inquiries%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not (public._admin_has_permission(v_actor, 'cs.manage') or public._admin_has_permission(v_actor, 'reports.manage')) then
    raise exception '이 작업을 수행할 관리자 권한이 없습니다. (cs.manage / reports.manage)' using errcode = '42501';
  end if;
  if coalesce(p_hidden, false) and v_reason is null then
    raise exception '숨김 사유를 입력해주세요.';
  end if;
  select * into v_row from public.funding_inquiries where id = p_inquiry_id for update;
  if not found then
    raise exception '문의를 찾을 수 없습니다.';
  end if;

  perform set_config('brander.admin_rpc', 'on', true);
  update public.funding_inquiries
  set is_hidden = coalesce(p_hidden, false),
      hidden_reason = case when coalesce(p_hidden, false) then left(v_reason, 500) end,
      hidden_by = case when coalesce(p_hidden, false) then v_actor end,
      hidden_at = case when coalesce(p_hidden, false) then now() end
  where id = p_inquiry_id;

  perform public._admin_log(
    case when coalesce(p_hidden, false) then 'inquiry.hide' else 'inquiry.unhide' end,
    'funding_inquiry', v_row.id::text, left(v_row.title, 80),
    jsonb_build_object('is_hidden', v_row.is_hidden), jsonb_build_object('is_hidden', coalesce(p_hidden, false)), v_reason
  );
end;
$$;

revoke all on function public.admin_set_funding_inquiry_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_funding_inquiry_hidden(uuid, boolean, text) to authenticated;

-- 필터 선택지: 문의가 있는 제작자 · 브랜드 · 펀딩
create or replace function public.admin_inquiry_filter_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._admin_require('cs.view');
  return jsonb_build_object(
    'creators', coalesce((
      select jsonb_agg(x order by x ->> 'name') from (
        select distinct jsonb_build_object('id', f.creator_id,
          'name', coalesce(nullif(btrim(cp.display_name), ''), nullif(btrim(p.username), ''), nullif(btrim(p.full_name), ''), '제작자')) as x
        from public.funding_inquiries i
        join public.fundings f on f.id = i.funding_id
        left join public.creator_profiles cp on cp.user_id = f.creator_id
        left join public.profiles p on p.id = f.creator_id
      ) s), '[]'::jsonb),
    'brands', coalesce((
      select jsonb_agg(x order by x ->> 'name') from (
        select distinct jsonb_build_object('id', b.id, 'name', b.brand_name) as x
        from public.funding_inquiries i
        join public.fundings f on f.id = i.funding_id
        join public.brands b on b.id = f.brand_id
      ) s), '[]'::jsonb),
    'fundings', coalesce((
      select jsonb_agg(x order by x ->> 'name') from (
        select distinct jsonb_build_object('id', f.id, 'name', f.product_name) as x
        from public.funding_inquiries i
        join public.fundings f on f.id = i.funding_id
      ) s), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_inquiry_filter_options() from public, anon;
grant execute on function public.admin_inquiry_filter_options() to authenticated;

notify pgrst, 'reload schema';
