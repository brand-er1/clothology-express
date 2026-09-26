-- BRAND-ER 관리자 운영 스키마 (비파괴적)
--  * 기존 컬럼/행은 수정·삭제하지 않고 nullable 또는 기본값이 있는 컬럼만 추가한다.
--  * 기존 CHECK 제약은 "기존 값을 모두 포함하는 상위 집합"으로만 넓힌다.
--  * 새 거래 관련 테이블(환불/정산/제작로그)은 FK 를 ON DELETE RESTRICT 로 걸어
--    주문·결제·정산 기록이 연쇄 삭제되지 않게 한다.

-- ---------------------------------------------------------------------------
-- 1. 회원 상태 (active → suspended/restricted → archived)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists account_status text not null default 'active',
  add column if not exists account_status_reason text,
  add column if not exists account_status_changed_at timestamptz,
  add column if not exists account_status_changed_by uuid references auth.users(id) on delete set null,
  add column if not exists creator_approved_at timestamptz,
  add column if not exists creator_approved_by uuid references auth.users(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_account_status_check,
  add constraint profiles_account_status_check
    check (account_status in ('active', 'restricted', 'suspended', 'archived'));

comment on column public.profiles.account_status is
  'active=정상, restricted=이용제한(펀딩 참여·개설·커뮤니티 작성 불가), suspended=정지(+로그인 차단), archived=보관.';

-- 회원 본인이 Data API 로 자신의 상태 컬럼을 바꾸지 못하게 한다.
-- (SECURITY DEFINER 관리자 RPC 는 함수 소유자 권한으로 실행되므로 current_user 가 authenticated 가 아니다.)
create or replace function public._guard_profile_admin_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
    and (
      new.account_status is distinct from old.account_status
      or new.account_status_reason is distinct from old.account_status_reason
      or new.account_status_changed_at is distinct from old.account_status_changed_at
      or new.account_status_changed_by is distinct from old.account_status_changed_by
      or new.creator_approved_at is distinct from old.creator_approved_at
      or new.creator_approved_by is distinct from old.creator_approved_by
    ) then
    raise exception '계정 상태는 관리자만 변경할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_admin_columns on public.profiles;
create trigger profiles_guard_admin_columns
before update on public.profiles
for each row execute function public._guard_profile_admin_columns();

create or replace function public._account_is_blocked(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.account_status in ('restricted', 'suspended', 'archived')
  );
$$;

revoke all on function public._account_is_blocked(uuid) from public, anon, authenticated;

create or replace function public._enforce_account_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  -- NEW 의 필드는 테이블마다 다르므로 CASE 식이 아닌 분기로 읽는다.
  if tg_table_name = 'funding_participations' then
    v_user_id := new.participant_id;
  elsif tg_table_name = 'fundings' then
    v_user_id := new.creator_id;
  else
    v_user_id := new.user_id;
  end if;
  if public._account_is_blocked(v_user_id) then
    raise exception '이용이 제한된 계정입니다. 고객센터로 문의해주세요.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public._enforce_account_status() from public, anon, authenticated;

drop trigger if exists funding_participations_enforce_account_status on public.funding_participations;
create trigger funding_participations_enforce_account_status
before insert on public.funding_participations
for each row execute function public._enforce_account_status();

drop trigger if exists fundings_enforce_account_status on public.fundings;
create trigger fundings_enforce_account_status
before insert on public.fundings
for each row execute function public._enforce_account_status();

drop trigger if exists community_posts_enforce_account_status on public.community_posts;
create trigger community_posts_enforce_account_status
before insert on public.community_posts
for each row execute function public._enforce_account_status();

drop trigger if exists community_comments_enforce_account_status on public.community_comments;
create trigger community_comments_enforce_account_status
before insert on public.community_comments
for each row execute function public._enforce_account_status();

-- ---------------------------------------------------------------------------
-- 2. 브랜드 검수 / 상태
-- ---------------------------------------------------------------------------

alter table public.brands
  add column if not exists review_status text not null default 'approved',
  add column if not exists review_reason text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null;

alter table public.brands
  drop constraint if exists brands_review_status_check,
  add constraint brands_review_status_check
    check (review_status in ('pending', 'approved', 'rejected'));

alter table public.brands
  drop constraint if exists brands_status_check,
  add constraint brands_status_check check (status in ('active', 'suspended', 'archived'));

comment on column public.brands.review_status is
  '관리자 검수 상태. 기존 브랜드는 approved. 반려 시 status 도 suspended 로 바뀌어 새 펀딩에 사용할 수 없다.';

-- 브랜드 소유자가 Data API 로 status/검수 컬럼을 바꿔 정지를 스스로 해제하지 못하게 한다.
-- current_user 로 호출 경로를 구분해야 하므로 SECURITY INVOKER 로 둔다.
create or replace function public._guard_brand_admin_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') then
      new.review_status := case
        when public._platform_setting_bool('brand_requires_review', false) then 'pending'
        else 'approved'
      end;
      new.review_reason := null;
      new.reviewed_at := null;
      new.reviewed_by := null;
      new.status_reason := null;
      new.status_changed_at := null;
      new.status_changed_by := null;
    end if;
    return new;
  end if;

  if current_user in ('authenticated', 'anon')
    and not public.is_admin(auth.uid())
    and (
      new.status is distinct from old.status
      or new.review_status is distinct from old.review_status
      or new.review_reason is distinct from old.review_reason
      or new.reviewed_at is distinct from old.reviewed_at
      or new.reviewed_by is distinct from old.reviewed_by
      or new.status_reason is distinct from old.status_reason
      or new.status_changed_at is distinct from old.status_changed_at
      or new.status_changed_by is distinct from old.status_changed_by
    ) then
    raise exception '브랜드 상태는 관리자만 변경할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

grant execute on function public._platform_setting_bool(text, boolean) to authenticated;

drop trigger if exists brands_guard_admin_columns on public.brands;
create trigger brands_guard_admin_columns
before insert or update on public.brands
for each row execute function public._guard_brand_admin_columns();

-- ---------------------------------------------------------------------------
-- 3. 펀딩 운영 컬럼 (공개/비공개, 운영 중단, 펀딩 단위 제작 단계)
-- ---------------------------------------------------------------------------

alter table public.fundings
  add column if not exists is_hidden boolean not null default false,
  add column if not exists visibility_changed_at timestamptz,
  add column if not exists visibility_changed_by uuid references auth.users(id) on delete set null,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references auth.users(id) on delete set null,
  add column if not exists suspension_reason text,
  add column if not exists closed_at timestamptz,
  add column if not exists production_status text,
  add column if not exists production_updated_at timestamptz;

alter table public.fundings
  drop constraint if exists fundings_production_status_check,
  add constraint fundings_production_status_check
    check (production_status is null or production_status in (
      'funding_success', 'fabric_contact', 'pattern_sample', 'sample_review',
      'mass_production', 'inspection_packing', 'shipping_ready', 'shipping', 'delivered'
    ));

comment on column public.fundings.is_hidden is '관리자 비공개 처리. true 이면 제작자/관리자 외에는 목록·상세에서 보이지 않는다.';
comment on column public.fundings.suspended_at is '관리자 운영 중단 시각. 중단 시 status=closed 로 새 참여만 막고 참여/주문 데이터는 보존한다.';
comment on column public.fundings.production_status is '펀딩 단위 실제 제작 진행 단계. 참여 건의 production_stage 로 매핑되어 구매자 화면에 반영된다.';

-- 공개 조회 정책: 비공개 처리된 펀딩은 제작자/관리자만 볼 수 있다(기본값 false 라 기존 노출은 동일).
drop policy if exists "Approved fundings are public" on public.fundings;
create policy "Approved fundings are public"
  on public.fundings for select
  using (
    (status in ('approved', 'closed') and is_hidden = false)
    or creator_id = (select auth.uid())
    or public.is_admin((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 4. 주문(펀딩 참여) 배송 컬럼
-- ---------------------------------------------------------------------------

alter table public.funding_participations
  add column if not exists courier text,
  add column if not exists shipping_note text,
  add column if not exists shipping_updated_at timestamptz,
  add column if not exists shipping_updated_by uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 5. 삭제 보호: 결제 이력이 있는 주문/펀딩은 영구 삭제 불가
-- ---------------------------------------------------------------------------

create or replace function public._guard_paid_participation_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.payment_approved_at is not null or old.payment_status in ('ready', 'paid') then
    raise exception '결제 이력이 있는 주문(참여) 기록은 삭제할 수 없습니다. 취소/환불 처리 후 보관됩니다.'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists funding_participations_guard_paid_delete on public.funding_participations;
create trigger funding_participations_guard_paid_delete
before delete on public.funding_participations
for each row execute function public._guard_paid_participation_delete();

create or replace function public._guard_funding_with_payments_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.funding_participations p
    where p.funding_id = old.id
      and (p.payment_approved_at is not null or p.payment_status in ('ready', 'paid'))
  ) then
    raise exception '결제 이력이 있는 펀딩은 삭제할 수 없습니다. 관리자에게 운영 중단(보관)을 요청해주세요.'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

revoke all on function public._guard_funding_with_payments_delete() from public, anon, authenticated;

drop trigger if exists fundings_guard_payment_history_delete on public.fundings;
create trigger fundings_guard_payment_history_delete
before delete on public.fundings
for each row execute function public._guard_funding_with_payments_delete();

-- ---------------------------------------------------------------------------
-- 6. 제작 진행 로그
-- ---------------------------------------------------------------------------

create table if not exists public.funding_production_logs (
  id uuid primary key default gen_random_uuid(),
  funding_id uuid not null references public.fundings(id) on delete restrict,
  from_stage text,
  to_stage text not null,
  note text,
  image_urls text[] not null default '{}'::text[],
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text,
  changed_by_role text not null,
  created_at timestamptz not null default now(),
  constraint funding_production_logs_role_check check (changed_by_role in ('admin', 'creator', 'system')),
  constraint funding_production_logs_note_length check (note is null or char_length(note) <= 2000),
  constraint funding_production_logs_images_limit check (cardinality(image_urls) <= 10)
);

create index if not exists funding_production_logs_funding_idx
  on public.funding_production_logs(funding_id, created_at desc);

alter table public.funding_production_logs enable row level security;
revoke all on table public.funding_production_logs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. 취소/환불 요청
-- ---------------------------------------------------------------------------

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.funding_participations(id) on delete restrict,
  funding_id uuid not null references public.fundings(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  requested_by_role text not null default 'customer',
  amount integer not null check (amount >= 0),
  reason text not null,
  status text not null default 'requested',
  payment_provider text not null,
  is_mock_payment boolean not null,
  pg_refund_status text not null default 'not_started',
  admin_note text,
  rejection_reason text,
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_requests_status_check check (status in (
    'requested', 'reviewing', 'approved', 'rejected', 'processing', 'completed'
  )),
  constraint refund_requests_role_check check (requested_by_role in ('customer', 'cs_admin', 'admin')),
  constraint refund_requests_pg_status_check check (pg_refund_status in (
    'not_started', 'not_applicable_mock', 'awaiting_pg_integration', 'manual_confirmed', 'pg_refunded'
  )),
  constraint refund_requests_reason_length check (char_length(reason) between 2 and 1000)
);

comment on column public.refund_requests.status is '플랫폼 환불 처리 상태(요청→검토→승인/반려→처리중→완료).';
comment on column public.refund_requests.pg_refund_status is
  'PG 사 실제 환불 상태. 플랫폼 상태와 분리한다. 모의결제는 not_applicable_mock, 실결제는 PG 연동 전까지 manual_confirmed(관리자가 PG 관리자 콘솔에서 직접 환불 후 확인) 로만 완료할 수 있다.';

create unique index if not exists refund_requests_one_open_per_participation
  on public.refund_requests(participation_id)
  where status not in ('rejected', 'completed');
create index if not exists refund_requests_status_idx on public.refund_requests(status, created_at desc);

create table if not exists public.refund_request_events (
  id uuid primary key default gen_random_uuid(),
  refund_request_id uuid not null references public.refund_requests(id) on delete restrict,
  from_status text,
  to_status text not null,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now()
);

create index if not exists refund_request_events_request_idx
  on public.refund_request_events(refund_request_id, created_at);

alter table public.refund_requests enable row level security;
alter table public.refund_request_events enable row level security;
revoke all on table public.refund_requests from anon, authenticated;
revoke all on table public.refund_request_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. 정산
-- ---------------------------------------------------------------------------

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  funding_id uuid not null references public.fundings(id) on delete restrict,
  brand_id uuid references public.brands(id) on delete restrict,
  creator_id uuid references auth.users(id) on delete restrict,
  gross_amount bigint not null default 0,
  refund_amount bigint not null default 0,
  net_sales bigint not null default 0,
  mock_amount bigint not null default 0,
  real_amount bigint not null default 0,
  commission_rate numeric(5, 2) not null,
  platform_fee bigint not null default 0,
  production_cost bigint not null default 0,
  other_deductions bigint not null default 0,
  final_amount bigint not null default 0,
  scheduled_date date,
  status text not null default 'pending',
  calculation jsonb not null default '{}'::jsonb,
  memo text,
  hold_reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_status_check check (status in ('pending', 'scheduled', 'completed', 'on_hold')),
  constraint settlements_one_per_funding unique (funding_id),
  constraint settlements_non_negative check (
    production_cost >= 0 and other_deductions >= 0 and commission_rate >= 0
  )
);

comment on table public.settlements is
  '펀딩별 제작자/브랜드 정산. 수수료율은 생성 시점 값을 고정 저장하고 calculation 에 계산 근거를 남긴다.';

create index if not exists settlements_status_idx on public.settlements(status, scheduled_date);
create index if not exists settlements_brand_idx on public.settlements(brand_id);

alter table public.settlements enable row level security;
revoke all on table public.settlements from anon, authenticated;

-- 제작자는 본인 펀딩 정산서를 조회만 할 수 있다(향후 제작자 대시보드용).
drop policy if exists "Creators can view own settlements" on public.settlements;
create policy "Creators can view own settlements"
  on public.settlements for select
  to authenticated
  using (creator_id = (select auth.uid()));
grant select on public.settlements to authenticated;

-- ---------------------------------------------------------------------------
-- 9. CS 문의
-- ---------------------------------------------------------------------------

create table if not exists public.cs_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  participation_id uuid references public.funding_participations(id) on delete restrict,
  funding_id uuid references public.fundings(id) on delete restrict,
  category text not null default 'other',
  subject text not null,
  content text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  assigned_to uuid references auth.users(id) on delete set null,
  admin_memo text,
  source text not null default 'customer',
  created_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cs_tickets_category_check check (category in (
    'order', 'shipping', 'refund', 'payment', 'account', 'funding', 'report', 'other'
  )),
  constraint cs_tickets_status_check check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  constraint cs_tickets_priority_check check (priority in ('low', 'normal', 'high', 'urgent')),
  constraint cs_tickets_source_check check (source in ('customer', 'admin')),
  constraint cs_tickets_subject_length check (char_length(subject) between 2 and 200),
  constraint cs_tickets_content_length check (char_length(content) between 2 and 5000)
);

create index if not exists cs_tickets_status_idx on public.cs_tickets(status, created_at desc);
create index if not exists cs_tickets_user_idx on public.cs_tickets(user_id, created_at desc);

alter table public.cs_tickets enable row level security;
revoke all on table public.cs_tickets from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. 콘텐츠 soft delete 메타데이터 / 신고 처리 메모
-- ---------------------------------------------------------------------------

alter table public.community_comments
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists deleted_reason text,
  add column if not exists deleted_content text;

comment on column public.community_comments.deleted_content is
  '관리자 soft delete 시 원문 보관(공개 조회 함수는 is_deleted 댓글의 content 만 비워 노출).';

alter table public.community_posts
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderation_reason text;

alter table public.community_reports
  add column if not exists resolution_note text,
  add column if not exists action_taken text;

-- ---------------------------------------------------------------------------
-- 11. 공지/알림 발송 기록 (사이트 내 알림 = community_notifications 재사용)
-- ---------------------------------------------------------------------------

alter table public.community_notifications
  drop constraint if exists community_notifications_type_check,
  add constraint community_notifications_type_check check (type in (
    'like', 'comment', 'reply', 'purchase_intent', 'poll_vote', 'follow',
    'purchase_intent_goal', 'funding_started', 'funding_status_changed',
    'participation_cancelled', 'funding_cancelled', 'admin_notice'
  ));

create table if not exists public.admin_notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text not null default 'announcement',
  target_type text not null,
  target_ref text,
  target_label text,
  funding_id uuid references public.fundings(id) on delete set null,
  requested_channels text[] not null default array['site']::text[],
  site_recipient_count integer not null default 0,
  external_delivery jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint admin_notification_campaigns_target_check check (target_type in (
    'all_members', 'member', 'funding_participants', 'brand_followers', 'creators'
  )),
  constraint admin_notification_campaigns_category_check check (category in (
    'announcement', 'funding_approved', 'funding_rejected', 'goal_reached', 'funding_suspended',
    'production_started', 'shipping_started', 'refund', 'other'
  )),
  constraint admin_notification_campaigns_title_length check (char_length(title) between 1 and 80),
  constraint admin_notification_campaigns_message_length check (char_length(message) between 1 and 1000)
);

comment on column public.admin_notification_campaigns.external_delivery is
  '이메일/SMS/알림톡 등 외부 채널 상태. 미연동 채널은 not_integrated 로 기록하며 발송된 것처럼 처리하지 않는다.';

create index if not exists admin_notification_campaigns_created_idx
  on public.admin_notification_campaigns(created_at desc);

alter table public.admin_notification_campaigns enable row level security;
revoke all on table public.admin_notification_campaigns from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. Data API 직접 수정 감사 트리거 (관리자가 RPC 를 거치지 않은 경우)
-- ---------------------------------------------------------------------------

drop trigger if exists fundings_admin_audit on public.fundings;
create trigger fundings_admin_audit
after update or delete on public.fundings
for each row execute function public._admin_audit_row_change();

drop trigger if exists brands_admin_audit on public.brands;
create trigger brands_admin_audit
after update or delete on public.brands
for each row execute function public._admin_audit_row_change();

drop trigger if exists funding_participations_admin_audit on public.funding_participations;
create trigger funding_participations_admin_audit
after update or delete on public.funding_participations
for each row execute function public._admin_audit_row_change();

drop trigger if exists orders_admin_audit on public.orders;
create trigger orders_admin_audit
after update or delete on public.orders
for each row execute function public._admin_audit_row_change();

notify pgrst, 'reload schema';
