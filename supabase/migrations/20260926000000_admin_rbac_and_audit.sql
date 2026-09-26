-- BRAND-ER 관리자 RBAC · Audit Log · 시스템 설정 (비파괴적 마이그레이션)
--
-- 원칙
--  * 기존 테이블/데이터는 삭제하거나 초기화하지 않는다. 새 테이블과 함수만 추가한다.
--  * 기존 public.is_admin(user_id) 시그니처(인자명·반환형)를 그대로 유지한 채 본문만 교체해
--    이 함수를 참조하는 기존 RLS 정책/RPC 60여 곳이 그대로 동작하게 한다.
--  * 기존 user_roles.role = 'admin' 계정은 admin_members 의 super_admin 으로 이관(복사)한다.
--    user_roles 행은 건드리지 않는다.
--
-- 관리자 등급
--  super_admin       플랫폼 최고 관리자 (모든 권한)
--  operations_admin  운영 관리자 (펀딩/제작/주문/배송/콘텐츠, 결제·정산·관리자·시스템설정 불가)
--  cs_admin          고객지원 관리자 (회원/주문/배송 조회, 신고·문의, 환불요청 확인)
--
-- 레거시 is_admin() 은 super_admin / operations_admin 에게만 true 를 돌려준다.
-- cs_admin 은 기존 관리자 RPC(펀딩 승인, 커뮤니티 모더레이션 등)를 호출할 수 없고
-- 이번에 추가하는 권한 기반 RPC(has_admin_permission)로만 접근한다.

-- ---------------------------------------------------------------------------
-- 1. 관리자 계정 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  display_name text,
  note text,
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_members_role_check
    check (role in ('super_admin', 'operations_admin', 'cs_admin')),
  constraint admin_members_status_check
    check (status in ('active', 'suspended', 'revoked')),
  constraint admin_members_note_length check (note is null or char_length(note) <= 500)
);

comment on table public.admin_members is
  'BRAND-ER 관리자 계정과 등급. 행을 삭제하지 않고 status=revoked 로 권한을 회수한다.';

create index if not exists admin_members_role_status_idx
  on public.admin_members(role, status);

alter table public.admin_members enable row level security;
revoke all on table public.admin_members from anon, authenticated;

-- 기존 관리자(user_roles.role = 'admin')를 super_admin 으로 복사한다. 이미 있으면 건드리지 않는다.
insert into public.admin_members (user_id, role, status, note)
select distinct r.user_id, 'super_admin', 'active', '기존 관리자(user_roles) 계정에서 이관'
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role::text = 'admin'
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. 권한 매트릭스
-- ---------------------------------------------------------------------------

create or replace function public.admin_role_permissions(p_role text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'super_admin' then array[
      'dashboard.view', 'finance.view',
      'members.view', 'members.manage', 'members.pii',
      'creators.view', 'creators.manage',
      'brands.view', 'brands.manage',
      'fundings.view', 'fundings.manage',
      'orders.view', 'orders.manage', 'orders.pii',
      'payments.view',
      'refunds.view', 'refunds.request', 'refunds.manage',
      'settlements.view', 'settlements.manage',
      'production.view', 'production.manage',
      'shipping.view', 'shipping.manage',
      'content.view', 'content.manage', 'reports.manage',
      'cs.view', 'cs.manage',
      'notifications.send',
      'analytics.view',
      'admins.manage', 'audit.view',
      'settings.view', 'settings.manage',
      'legacy.tools', 'legacy.settings'
    ]
    when 'operations_admin' then array[
      'dashboard.view',
      'members.view', 'members.manage', 'members.pii',
      'creators.view', 'creators.manage',
      'brands.view', 'brands.manage',
      'fundings.view', 'fundings.manage',
      'orders.view', 'orders.manage', 'orders.pii',
      'production.view', 'production.manage',
      'shipping.view', 'shipping.manage',
      'content.view', 'content.manage', 'reports.manage',
      'cs.view',
      'notifications.send',
      'analytics.view',
      'legacy.tools'
    ]
    when 'cs_admin' then array[
      'dashboard.view',
      'members.view', 'members.pii',
      'fundings.view',
      'orders.view', 'orders.pii',
      'shipping.view',
      'refunds.view', 'refunds.request',
      'content.view', 'reports.manage',
      'cs.view', 'cs.manage'
    ]
    else array[]::text[]
  end;
$$;

comment on function public.admin_role_permissions(text) is
  '관리자 등급별 권한 목록. 프런트엔드 src/lib/admin/permissions.ts 와 동일하게 유지한다.';

-- 사용자별 관리자 등급. admin_members 행이 있으면 그것만 따르고(회수/정지 포함),
-- 없으면 기존 user_roles 'admin' 계정을 super_admin 으로 취급해 하위 호환을 유지한다.
create or replace function public._admin_role_of(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null then null
    when exists (select 1 from public.admin_members m where m.user_id = p_user_id) then (
      select m.role from public.admin_members m
      where m.user_id = p_user_id and m.status = 'active'
    )
    when exists (
      select 1 from public.user_roles r
      where r.user_id = p_user_id and r.role::text = 'admin'
    ) then 'super_admin'
    else null
  end;
$$;

revoke all on function public._admin_role_of(uuid) from public, anon, authenticated;

create or replace function public._admin_has_permission(p_user_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_permission = any(public.admin_role_permissions(public._admin_role_of(p_user_id))), false);
$$;

revoke all on function public._admin_has_permission(uuid, text) from public, anon, authenticated;
grant execute on function public._admin_has_permission(uuid, text) to service_role;

-- 클라이언트용: 로그인한 본인의 권한만 확인할 수 있다.
create or replace function public.has_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._admin_has_permission(auth.uid(), p_permission);
$$;

revoke all on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated, service_role;

create or replace function public.is_admin_staff(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._admin_role_of(p_user_id) is not null;
$$;

revoke all on function public.is_admin_staff(uuid) from public, anon, authenticated;
grant execute on function public.is_admin_staff(uuid) to service_role;

-- 기존 is_admin 을 같은 시그니처로 교체한다. super_admin / operations_admin 만 true.
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public._admin_role_of($1) in ('super_admin', 'operations_admin'), false);
$$;

-- ---------------------------------------------------------------------------
-- 3. Audit Log (추가 전용)
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  admin_name text,
  admin_role text,
  action text not null,
  target_type text,
  target_id text,
  target_label text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_logs is
  '관리자 작업 기록. UPDATE/DELETE 가 트리거로 차단되는 추가 전용 테이블. admin_id 는 계정이 삭제돼도 남도록 FK 를 두지 않는다.';

create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_admin_idx on public.admin_audit_logs(admin_id, created_at desc);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs(target_type, target_id);
create index if not exists admin_audit_logs_action_idx on public.admin_audit_logs(action, created_at desc);

alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from anon, authenticated;

create or replace function public._admin_audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit Log 는 수정하거나 삭제할 수 없습니다.' using errcode = '42501';
end;
$$;

drop trigger if exists admin_audit_logs_immutable on public.admin_audit_logs;
create trigger admin_audit_logs_immutable
before update or delete on public.admin_audit_logs
for each row execute function public._admin_audit_immutable();

create or replace function public._admin_display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(btrim(m.display_name), '') from public.admin_members m where m.user_id = p_user_id),
    (select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.username), '')) from public.profiles p where p.id = p_user_id),
    (select u.email from auth.users u where u.id = p_user_id),
    '알 수 없음'
  );
$$;

revoke all on function public._admin_display_name(uuid) from public, anon, authenticated;

create or replace function public._admin_log(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_target_label text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  insert into public.admin_audit_logs (
    admin_id, admin_name, admin_role, action, target_type, target_id, target_label,
    before_data, after_data, reason, metadata
  ) values (
    v_actor,
    case when v_actor is null then 'system' else public._admin_display_name(v_actor) end,
    public._admin_role_of(v_actor),
    p_action, p_target_type, p_target_id, p_target_label,
    p_before, p_after, nullif(btrim(coalesce(p_reason, '')), ''), coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public._admin_log(text, text, text, text, jsonb, jsonb, text, jsonb) from public, anon, authenticated;

-- RPC 공통 진입점: 권한이 없으면 42501 로 거부하고, 트리거 기반 중복 감사 기록을 막는 플래그를 켠다.
create or replace function public._admin_require(p_permission text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not public._admin_has_permission(v_actor, p_permission) then
    raise exception '이 작업을 수행할 관리자 권한이 없습니다. (%)', p_permission using errcode = '42501';
  end if;
  perform set_config('brander.admin_rpc', 'on', true);
  return v_actor;
end;
$$;

revoke all on function public._admin_require(text) from public, anon, authenticated;

-- 관리자가 RPC 를 거치지 않고 Data API 로 직접 수정한 경우에도 기록을 남기는 범용 트리거.
create or replace function public._admin_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
  v_after jsonb;
  v_target_id text;
begin
  if v_actor is null
    or coalesce(current_setting('brander.admin_rpc', true), '') = 'on'
    or public._admin_role_of(v_actor) is null then
    return coalesce(new, old);
  end if;

  v_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_target_id := coalesce(v_after ->> 'id', v_before ->> 'id', v_after ->> 'user_id', v_before ->> 'user_id');

  if tg_op = 'UPDATE' and v_before - 'updated_at' = v_after - 'updated_at' then
    return new;
  end if;

  perform public._admin_log(
    'row_' || lower(tg_op) || '.' || tg_table_name,
    tg_table_name,
    v_target_id,
    null,
    v_before,
    v_after,
    null,
    jsonb_build_object('source', 'row_trigger', 'note', '관리자 전용 RPC 외 경로(Data API 또는 기존 RPC)로 변경됨')
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public._admin_audit_row_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. 시스템 설정
-- ---------------------------------------------------------------------------

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint platform_settings_key_format check (key ~ '^[a-z0-9_]{2,64}$')
);

comment on table public.platform_settings is
  '운영 정책 값. 비밀키(PG Secret, Service Role 등)는 절대 저장하지 않는다(Edge Function 환경변수에만 둔다).';

alter table public.platform_settings enable row level security;
revoke all on table public.platform_settings from anon, authenticated;

insert into public.platform_settings (key, value, description) values
  ('platform_commission_rate', '10'::jsonb, '플랫폼 수수료율(%). 정산 생성 시점 값이 정산서에 고정 저장된다.'),
  ('settlement_delay_days', '7'::jsonb, '펀딩 종료(배송완료) 후 정산 예정일까지의 기본 일수.'),
  ('brand_requires_review', 'false'::jsonb, 'true 이면 신규 브랜드가 검수대기(pending) 상태로 등록된다. 검수 중에도 브랜드 사용은 가능하며 반려 시 정지된다.'),
  ('pg_live_refund_enabled', 'false'::jsonb, '실제 PG 환불 API 자동 실행 여부. PG 정식 연동 전까지 false 로 고정한다.'),
  ('notification_channels', '{"site": true, "email": false, "sms": false, "kakao_alimtalk": false}'::jsonb,
    '알림 채널 연동 상태. site 외 채널은 외부 연동 후 true 로 전환한다.')
on conflict (key) do nothing;

create or replace function public._platform_setting_numeric(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric end
     from public.platform_settings where key = p_key),
    p_default
  );
$$;

revoke all on function public._platform_setting_numeric(text, numeric) from public, anon, authenticated;

create or replace function public._platform_setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when jsonb_typeof(value) = 'boolean' then (value #>> '{}')::boolean end
     from public.platform_settings where key = p_key),
    p_default
  );
$$;

revoke all on function public._platform_setting_bool(text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. 관리자 컨텍스트 / 관리자 관리 RPC
-- ---------------------------------------------------------------------------

create or replace function public.get_my_admin_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if v_actor is null then
    return jsonb_build_object('is_admin', false);
  end if;
  v_role := public._admin_role_of(v_actor);
  if v_role is null then
    return jsonb_build_object('is_admin', false);
  end if;
  return jsonb_build_object(
    'is_admin', true,
    'user_id', v_actor,
    'role', v_role,
    'display_name', public._admin_display_name(v_actor),
    'permissions', to_jsonb(public.admin_role_permissions(v_role))
  );
end;
$$;

revoke all on function public.get_my_admin_context() from public, anon;
grant execute on function public.get_my_admin_context() to authenticated;

create or replace function public.admin_list_admins()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  status text,
  note text,
  granted_by_name text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  is_legacy boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._admin_require('admins.manage');
  return query
  select
    m.user_id, u.email::text, public._admin_display_name(m.user_id), m.role, m.status, m.note,
    case when m.granted_by is null then null else public._admin_display_name(m.granted_by) end,
    u.last_sign_in_at, m.created_at, m.updated_at, false
  from public.admin_members m
  left join auth.users u on u.id = m.user_id
  union all
  select
    r.user_id, u.email::text, public._admin_display_name(r.user_id), 'super_admin', 'active',
    '기존 user_roles 관리자 (admin_members 미등록)', null, u.last_sign_in_at, r.created_at, r.created_at, true
  from public.user_roles r
  left join auth.users u on u.id = r.user_id
  where r.role::text = 'admin'
    and not exists (select 1 from public.admin_members m where m.user_id = r.user_id)
  order by 9 desc;
end;
$$;

create or replace function public._admin_active_super_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*) from public.admin_members where role = 'super_admin' and status = 'active'
  )::integer + (
    select count(distinct r.user_id) from public.user_roles r
    where r.role::text = 'admin'
      and not exists (select 1 from public.admin_members m where m.user_id = r.user_id)
  )::integer;
$$;

revoke all on function public._admin_active_super_count() from public, anon, authenticated;

create or replace function public.admin_grant_role(
  p_email text,
  p_role text,
  p_display_name text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('admins.manage');
  v_user_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if p_role not in ('super_admin', 'operations_admin', 'cs_admin') then
    raise exception '올바르지 않은 관리자 등급입니다.';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(btrim(coalesce(p_email, '')))
  limit 1;

  if v_user_id is null then
    raise exception '해당 이메일로 가입한 회원이 없습니다. 먼저 BRAND-ER 회원가입이 필요합니다.';
  end if;

  select to_jsonb(m) into v_before from public.admin_members m where m.user_id = v_user_id;

  insert into public.admin_members (user_id, role, status, display_name, note, granted_by)
  values (
    v_user_id, p_role, 'active',
    nullif(btrim(coalesce(p_display_name, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor
  )
  on conflict (user_id) do update
  set role = excluded.role,
      status = 'active',
      display_name = coalesce(excluded.display_name, admin_members.display_name),
      note = coalesce(excluded.note, admin_members.note),
      granted_by = v_actor,
      revoked_at = null,
      revoked_by = null,
      updated_at = now();

  select to_jsonb(m) into v_after from public.admin_members m where m.user_id = v_user_id;

  perform public._admin_log(
    case when v_before is null then 'admin.grant' else 'admin.role_change' end,
    'admin_member', v_user_id::text, lower(btrim(p_email)), v_before, v_after, p_note
  );

  return v_after;
end;
$$;

create or replace function public.admin_update_member_role(
  p_user_id uuid,
  p_role text,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('admins.manage');
  v_before public.admin_members%rowtype;
  v_legacy boolean := false;
  v_after jsonb;
begin
  if p_role not in ('super_admin', 'operations_admin', 'cs_admin') then
    raise exception '올바르지 않은 관리자 등급입니다.';
  end if;
  if p_status not in ('active', 'suspended', 'revoked') then
    raise exception '올바르지 않은 관리자 상태입니다.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 2 then
    raise exception '변경 사유를 입력해주세요.';
  end if;
  if p_user_id = v_actor and (p_role <> 'super_admin' or p_status <> 'active') then
    raise exception '본인의 Super Admin 권한은 직접 낮추거나 회수할 수 없습니다.';
  end if;

  select * into v_before from public.admin_members where user_id = p_user_id for update;
  if not found then
    if exists (select 1 from public.user_roles r where r.user_id = p_user_id and r.role::text = 'admin') then
      v_legacy := true;
    else
      raise exception '관리자 계정을 찾을 수 없습니다.';
    end if;
  end if;

  if (v_legacy or (v_before.role = 'super_admin' and v_before.status = 'active'))
    and (p_role <> 'super_admin' or p_status <> 'active')
    and public._admin_active_super_count() <= 1 then
    raise exception '마지막 Super Admin 의 권한은 변경할 수 없습니다.';
  end if;

  insert into public.admin_members (user_id, role, status, granted_by, revoked_at, revoked_by, note)
  values (
    p_user_id, p_role, p_status, v_actor,
    case when p_status = 'revoked' then now() end,
    case when p_status = 'revoked' then v_actor end,
    case when v_legacy then '기존 user_roles 관리자 계정에서 이관' end
  )
  on conflict (user_id) do update
  set role = excluded.role,
      status = excluded.status,
      revoked_at = case when excluded.status = 'revoked' then now() else null end,
      revoked_by = case when excluded.status = 'revoked' then v_actor else null end,
      updated_at = now();

  select to_jsonb(m) into v_after from public.admin_members m where m.user_id = p_user_id;

  perform public._admin_log(
    case when p_status = 'revoked' then 'admin.revoke' else 'admin.role_change' end,
    'admin_member', p_user_id::text, public._admin_display_name(p_user_id),
    case when v_legacy then jsonb_build_object('role', 'super_admin', 'status', 'active', 'source', 'user_roles') else to_jsonb(v_before) end,
    v_after, p_reason
  );
  return v_after;
end;
$$;

create or replace function public.admin_list_audit_logs(
  p_search text default null,
  p_action text default null,
  p_admin_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  admin_id uuid,
  admin_name text,
  admin_role text,
  action text,
  target_type text,
  target_id text,
  target_label text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  metadata jsonb,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform public._admin_require('audit.view');
  return query
  select l.id, l.admin_id, l.admin_name, l.admin_role, l.action, l.target_type, l.target_id, l.target_label,
    l.before_data, l.after_data, l.reason, l.metadata, l.created_at,
    count(*) over ()
  from public.admin_audit_logs l
  where (p_action is null or l.action like p_action || '%')
    and (p_admin_id is null or l.admin_id = p_admin_id)
    and (p_from is null or l.created_at >= p_from)
    and (p_to is null or l.created_at < p_to)
    and (
      v_search is null
      or l.admin_name ilike '%' || v_search || '%'
      or l.target_label ilike '%' || v_search || '%'
      or l.target_id ilike '%' || v_search || '%'
      or l.action ilike '%' || v_search || '%'
      or l.reason ilike '%' || v_search || '%'
    )
  order by l.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_get_settings()
returns table (key text, value jsonb, description text, updated_by_name text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._admin_require('settings.view');
  return query
  select s.key, s.value, s.description,
    case when s.updated_by is null then null else public._admin_display_name(s.updated_by) end,
    s.updated_at
  from public.platform_settings s
  order by s.key;
end;
$$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('settings.manage');
  v_before jsonb;
  v_rate numeric;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 2 then
    raise exception '변경 사유를 입력해주세요.';
  end if;

  select value into v_before from public.platform_settings where key = p_key for update;
  if not found then
    raise exception '알 수 없는 설정 항목입니다.';
  end if;

  if p_key = 'platform_commission_rate' then
    if jsonb_typeof(p_value) <> 'number' then
      raise exception '수수료율은 숫자로 입력해주세요.';
    end if;
    v_rate := (p_value #>> '{}')::numeric;
    if v_rate < 0 or v_rate > 50 then
      raise exception '수수료율은 0%% 이상 50%% 이하로 설정할 수 있습니다.';
    end if;
  elsif p_key = 'settlement_delay_days' then
    if jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 0 and 120 then
      raise exception '정산 예정일은 0~120일 사이 숫자로 입력해주세요.';
    end if;
  elsif p_key = 'pg_live_refund_enabled' then
    if p_value <> 'false'::jsonb then
      raise exception '실제 PG 환불 자동 실행은 PG 정식 연동 및 보안 점검 전까지 켤 수 없습니다.';
    end if;
  elsif p_key = 'brand_requires_review' then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'true 또는 false 로 설정해주세요.';
    end if;
  elsif p_key = 'notification_channels' then
    if jsonb_typeof(p_value) <> 'object' or coalesce((p_value ->> 'site')::boolean, false) is not true then
      raise exception '사이트 내 알림(site)은 항상 켜져 있어야 합니다.';
    end if;
  end if;

  update public.platform_settings
  set value = p_value, updated_by = v_actor, updated_at = now()
  where key = p_key;

  perform public._admin_log('settings.update', 'platform_setting', p_key, p_key,
    jsonb_build_object('value', v_before), jsonb_build_object('value', p_value), p_reason);

  return jsonb_build_object('key', p_key, 'value', p_value);
end;
$$;

-- 모든 관리자 RPC: PUBLIC/anon 실행 권한 회수, 로그인 사용자만 호출(내부에서 권한 재검증).
do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_list_admins', 'admin_grant_role', 'admin_update_member_role',
        'admin_list_audit_logs', 'admin_get_settings', 'admin_update_setting'
      )
  loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;

notify pgrst, 'reload schema';
