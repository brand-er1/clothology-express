-- AI 이미지 생성 결과 → 제작의뢰 연결 (관리자 콘솔 기존 '제작 의뢰' 메뉴와 통합)
--
-- 기존 구조를 그대로 쓴다.
--  * 제작의뢰 본체는 기존 public.orders 한 행이다. request_source = 'ai_image_request' 로 구분하고
--    (관리자 화면 표시: 'AI 디자인 제작의뢰'), 이미지 URL · 경로도 기존 generated_image_url / image_path 에 둔다.
--  * 기존 orders 의 컬럼 · 데이터는 바꾸지 않는다(새 테이블만 추가하고, 새 테이블에 기존 의뢰를 '확인함'으로 채운다).
--
-- 새 테이블 (모두 RLS + anon/authenticated 권한 없음 → Edge Function(service_role) · SECURITY DEFINER RPC 로만 접근)
--  1) production_request_details  : AI 이미지 제작의뢰 접수 정보(연락처 · 수량 · 예산 · 요청사항 · 프롬프트 · 동의 · 유입 경로)
--  2) production_request_progress : 모든 제작의뢰의 세부 진행 상태(8단계) · 관리자 확인 여부(미확인 배지)
--  3) production_request_memos    : 관리자 내부 상담 메모(고객에게 보이지 않음)
--
-- 진행 상태 ↔ 기존 orders.status(고객 주문내역에 보이는 상태) 매핑
--   new(신규 접수) · consult_waiting(상담 대기)                                  → pending  (검토 대기)
--   consult_done · quote_sent · contract_done · in_production · production_done → approved (제작 상담 접수)
--   not_contracted(계약 미성사)                                                  → rejected (진행 불가)

-- ---------------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.production_request_details (
  order_id uuid primary key references public.orders(id) on delete cascade,
  submission_key uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  contact_name text not null check (char_length(btrim(contact_name)) between 1 and 50),
  contact_phone text not null check (contact_phone ~ '^010[0-9]{8}$'),
  quantity integer check (quantity is null or quantity between 1 and 1000000),
  quantity_undecided boolean not null default false,
  budget text check (budget is null or char_length(budget) <= 50),
  customer_request text check (customer_request is null or char_length(customer_request) <= 2000),
  ai_prompt text check (ai_prompt is null or char_length(ai_prompt) <= 8000),
  design_brief text check (design_brief is null or char_length(design_brief) <= 4000),
  design_id uuid,
  image_path text not null,
  image_url text not null,
  image_source_url text,
  image_fingerprint text,
  entry_point text not null default 'ai_image_generator',
  entry_path text,
  privacy_consent_version text not null,
  privacy_consented_at timestamptz not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint production_request_quantity_choice check ((quantity_undecided and quantity is null) or (not quantity_undecided and quantity is not null))
);

comment on table public.production_request_details is
  'AI 이미지 생성 결과로 접수된 제작의뢰의 고객 입력 정보. orders 한 행과 1:1. 연락처는 orders.pii 권한 관리자만 원문 조회.';

create index if not exists production_request_details_phone_idx on public.production_request_details (contact_phone, created_at desc);
create index if not exists production_request_details_ip_idx on public.production_request_details (ip_hash, created_at desc) where ip_hash is not null;
create index if not exists production_request_details_user_idx on public.production_request_details (user_id, created_at desc) where user_id is not null;

alter table public.production_request_details enable row level security;
revoke all on table public.production_request_details from anon, authenticated;

create table if not exists public.production_request_progress (
  order_id uuid primary key references public.orders(id) on delete cascade,
  progress_status text not null default 'new' check (progress_status in (
    'new', 'consult_waiting', 'consult_done', 'quote_sent', 'contract_done', 'in_production', 'production_done', 'not_contracted'
  )),
  checked_at timestamptz,
  checked_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.production_request_progress is
  '제작의뢰(orders) 세부 진행 상태와 관리자 확인 시각. checked_at 이 비어 있으면 관리자 메뉴의 미확인 건수에 포함된다.';

create index if not exists production_request_progress_unchecked_idx on public.production_request_progress (order_id) where checked_at is null;

alter table public.production_request_progress enable row level security;
revoke all on table public.production_request_progress from anon, authenticated;

create table if not exists public.production_request_memos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  author_id uuid,
  author_name text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists production_request_memos_order_idx on public.production_request_memos (order_id, created_at desc);

alter table public.production_request_memos enable row level security;
revoke all on table public.production_request_memos from anon, authenticated;

-- 기존 제작의뢰는 이미 관리자가 보던 건이므로 '확인함'으로 채운다(미확인 배지가 과거 건으로 가득 차지 않게).
-- orders 는 건드리지 않고 새 테이블에만 넣는다. 재실행해도 이미 있는 행은 그대로 둔다.
insert into public.production_request_progress (order_id, progress_status, checked_at, updated_at)
select o.id,
  case o.status::text when 'approved' then 'consult_done' when 'rejected' then 'not_contracted' else 'new' end,
  now(), now()
from public.orders o
where o.status::text not in ('draft', 'deleted')
on conflict (order_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. 상태 매핑 helper
-- ---------------------------------------------------------------------------

create or replace function public._production_progress_order_status(p_progress text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_progress in ('new', 'consult_waiting') then 'pending'
    when p_progress = 'not_contracted' then 'rejected'
    when p_progress in ('consult_done', 'quote_sent', 'contract_done', 'in_production', 'production_done') then 'approved'
    else null
  end;
$$;

-- 진행 상태 행이 없거나(다른 경로로 바뀐 경우 포함) orders.status 와 어긋나면 orders.status 기준 기본값을 쓴다.
create or replace function public._production_effective_progress(p_progress text, p_order_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_progress is not null and public._production_progress_order_status(p_progress) = p_order_status then p_progress
    when p_order_status = 'approved' then 'consult_done'
    when p_order_status = 'rejected' then 'not_contracted'
    else 'new'
  end;
$$;

revoke all on function public._production_progress_order_status(text) from public, anon, authenticated;
revoke all on function public._production_effective_progress(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. 접수 (Edge Function submit-production-request 전용, service_role)
-- ---------------------------------------------------------------------------
-- 오류는 'PR_<CODE>: 안내 문구' 형식으로 올려 Edge Function 이 HTTP 응답으로 바꾼다.

create or replace function public.create_ai_production_request(
  p_payload jsonb,
  p_user_id uuid default null,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key uuid;
  v_name text := btrim(coalesce(p_payload->>'contactName', ''));
  v_phone text := public.normalize_kr_phone(p_payload->>'phone');
  v_undecided boolean := coalesce((p_payload->>'quantityUndecided')::boolean, false);
  v_quantity_text text := nullif(btrim(coalesce(p_payload->>'quantity', '')), '');
  v_quantity integer;
  v_budget text := nullif(btrim(coalesce(p_payload->>'budget', '')), '');
  v_request text := nullif(btrim(coalesce(p_payload->>'request', '')), '');
  v_prompt text := nullif(btrim(coalesce(p_payload->>'aiPrompt', '')), '');
  v_brief text := nullif(btrim(coalesce(p_payload->>'designBrief', '')), '');
  v_cloth text := coalesce(nullif(btrim(coalesce(p_payload->>'clothType', '')), ''), 'AI 디자인 의류');
  v_material text := coalesce(nullif(btrim(coalesce(p_payload->>'material', '')), ''), '상담 후 결정');
  v_image_path text := nullif(btrim(coalesce(p_payload->>'imagePath', '')), '');
  v_image_url text := nullif(btrim(coalesce(p_payload->>'imageUrl', '')), '');
  v_fingerprint text := nullif(btrim(coalesce(p_payload->>'imageFingerprint', '')), '');
  v_consent boolean := coalesce((p_payload->>'privacyConsent')::boolean, false);
  v_consent_version text := nullif(btrim(coalesce(p_payload->>'privacyConsentVersion', '')), '');
  v_design_id uuid;
  v_existing record;
  v_order_id uuid;
  v_created timestamptz;
  v_detail text;
begin
  begin
    v_key := (p_payload->>'submissionKey')::uuid;
  exception when others then
    v_key := null;
  end;
  if v_key is null then
    raise exception 'PR_INVALID: 접수 식별값이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.';
  end if;

  -- 같은 접수 키(더블 클릭 · 응답 유실 후 재시도)는 새로 만들지 않고 기존 접수 결과를 돌려준다.
  select d.order_id, d.created_at into v_existing
  from public.production_request_details d where d.submission_key = v_key;
  if found then
    return jsonb_build_object('order_id', v_existing.order_id, 'created_at', v_existing.created_at, 'duplicate', true);
  end if;

  if v_name = '' or char_length(v_name) > 50 then
    raise exception 'PR_INVALID: 고객 이름을 1~50자로 입력해주세요.';
  end if;
  if v_phone is null or v_phone !~ '^010[0-9]{8}$' then
    raise exception 'PR_INVALID: 전화번호를 010-0000-0000 형식으로 정확히 입력해주세요.';
  end if;
  if not v_undecided then
    if v_quantity_text is null or v_quantity_text !~ '^[0-9]{1,7}$' then
      raise exception 'PR_INVALID: 제작 희망 수량을 숫자로 입력하거나 ''미정''을 선택해주세요.';
    end if;
    v_quantity := v_quantity_text::integer;
    if v_quantity < 1 or v_quantity > 1000000 then
      raise exception 'PR_INVALID: 제작 희망 수량은 1장 이상으로 입력해주세요.';
    end if;
  end if;
  if char_length(coalesce(v_budget, '')) > 50 then
    raise exception 'PR_INVALID: 희망 제작 예산은 50자까지 입력할 수 있습니다.';
  end if;
  if char_length(coalesce(v_request, '')) > 2000 then
    raise exception 'PR_INVALID: 추가 요청사항은 2000자까지 입력할 수 있습니다.';
  end if;
  if not v_consent or v_consent_version is null then
    raise exception 'PR_CONSENT: 개인정보 수집 및 이용에 동의해야 제작의뢰를 접수할 수 있습니다.';
  end if;
  if v_image_path is null or v_image_path !~ '^production-requests/' or v_image_url is null then
    raise exception 'PR_IMAGE: 의뢰 이미지가 저장되지 않았습니다. 다시 시도해주세요.';
  end if;
  begin
    v_design_id := nullif(p_payload->>'designId', '')::uuid;
  exception when others then
    v_design_id := null;
  end;

  -- 같은 전화번호 + 같은 이미지가 10분 안에 다시 들어오면 중복 접수로 본다.
  if v_fingerprint is not null and exists (
    select 1 from public.production_request_details d
    where d.contact_phone = v_phone and d.image_fingerprint = v_fingerprint and d.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'PR_DUPLICATE: 같은 디자인으로 방금 접수된 제작의뢰가 있습니다. 담당자가 확인 후 연락드립니다.';
  end if;

  -- 과도한 접수 방지: 같은 전화번호 또는 같은 접속지에서 1시간에 10건까지.
  if (select count(*) from public.production_request_details d
      where d.contact_phone = v_phone and d.created_at > now() - interval '1 hour') >= 10
     or (p_ip_hash is not null and (select count(*) from public.production_request_details d
      where d.ip_hash = p_ip_hash and d.created_at > now() - interval '1 hour') >= 10) then
    raise exception 'PR_RATE_LIMITED: 짧은 시간에 너무 많은 제작의뢰가 접수되었습니다. 잠시 후 다시 시도해주세요.';
  end if;

  v_detail := concat_ws(E'\n',
    '의뢰 방식: AI 이미지 생성 → 제작의뢰',
    '제작 희망 수량: ' || case when v_undecided then '미정' else v_quantity::text || '장' end,
    '희망 제작 예산: ' || coalesce(v_budget, '미입력'),
    case when v_request is not null then '추가 요청사항: ' || v_request end,
    case when v_brief is not null then '디자인 설명: ' || v_brief end);

  insert into public.orders (
    user_id, cloth_type, material, detail_description, generated_image_url, image_path,
    request_source, request_title, requested_quantity, guest_name, guest_phone, status
  ) values (
    p_user_id, left(v_cloth, 200), left(v_material, 200), v_detail, v_image_url, v_image_path,
    'ai_image_request', left(v_cloth, 80) || ' AI 디자인 제작의뢰', v_quantity,
    case when p_user_id is null then v_name end,
    case when p_user_id is null then v_phone end,
    'pending'
  )
  returning id, created_at into v_order_id, v_created;

  insert into public.production_request_details (
    order_id, submission_key, user_id, contact_name, contact_phone, quantity, quantity_undecided, budget,
    customer_request, ai_prompt, design_brief, design_id, image_path, image_url, image_source_url, image_fingerprint,
    entry_point, entry_path, privacy_consent_version, privacy_consented_at, ip_hash, user_agent, created_at
  ) values (
    v_order_id, v_key, p_user_id, v_name, v_phone, v_quantity, v_undecided, v_budget,
    v_request, left(v_prompt, 8000), left(v_brief, 4000), v_design_id, v_image_path, v_image_url,
    left(nullif(btrim(coalesce(p_payload->>'imageSourceUrl', '')), ''), 2000), v_fingerprint,
    left(coalesce(nullif(btrim(coalesce(p_payload->>'entryPoint', '')), ''), 'ai_image_generator'), 60),
    left(nullif(btrim(coalesce(p_payload->>'entryPath', '')), ''), 300),
    left(v_consent_version, 40), now(), p_ip_hash, left(p_user_agent, 500), v_created
  );

  insert into public.production_request_progress (order_id, progress_status, checked_at, updated_at)
  values (v_order_id, 'new', null, now())
  on conflict (order_id) do update set progress_status = 'new', checked_at = null, checked_by = null, updated_at = now();

  return jsonb_build_object('order_id', v_order_id, 'created_at', v_created, 'duplicate', false);
exception
  when unique_violation then
    -- 같은 접수 키가 동시에 두 번 들어온 경우: 먼저 저장된 건을 돌려준다.
    select d.order_id, d.created_at into v_existing
    from public.production_request_details d where d.submission_key = v_key;
    if found then
      return jsonb_build_object('order_id', v_existing.order_id, 'created_at', v_existing.created_at, 'duplicate', true);
    end if;
    raise;
end;
$$;

revoke all on function public.create_ai_production_request(jsonb, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_ai_production_request(jsonb, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. 관리자 목록 (기존 admin_list_production_requests 확장: 진행 상태 · 미확인 · AI 제작의뢰 정보)
-- ---------------------------------------------------------------------------
-- p_status: all | pending | approved | rejected (기존) | unread (미확인)
-- p_progress: all | new | consult_waiting | ... | not_contracted

drop function if exists public.admin_list_production_requests(text, text, text, integer, integer);

create or replace function public.admin_list_production_requests(
  p_status text default 'pending',
  p_source text default 'all',
  p_search text default null,
  p_limit integer default 30,
  p_offset integer default 0,
  p_progress text default 'all'
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
  v_status text := case when p_status in ('all', 'pending', 'approved', 'rejected', 'unread') then p_status else 'pending' end;
  v_progress text := coalesce(p_progress, 'all');
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_digits text := nullif(regexp_replace(coalesce(p_search, ''), '\D', '', 'g'), '');
begin
  return (
    with base as (
      select o.*,
        coalesce(nullif(btrim(d.contact_name), ''), nullif(btrim(pr.full_name), ''), nullif(btrim(o.guest_name), ''), nullif(btrim(pr.username), '')) as customer_name,
        coalesce(nullif(btrim(d.contact_phone), ''), nullif(btrim(pr.phone_number), ''), nullif(btrim(o.guest_phone), '')) as customer_phone,
        u.email as customer_email,
        public._production_effective_progress(pg.progress_status, o.status::text) as progress_status,
        (pg.order_id is not null and pg.checked_at is null) as is_unread,
        d.order_id is not null as has_request_details,
        d.quantity_undecided, d.budget, d.customer_request
      from public.orders o
      left join public.profiles pr on pr.id = o.user_id
      left join auth.users u on u.id = o.user_id
      left join public.production_request_details d on d.order_id = o.id
      left join public.production_request_progress pg on pg.order_id = o.id
      where o.status::text not in ('draft', 'deleted')
        and (coalesce(p_source, 'all') = 'all' or o.request_source = p_source)
        and (v_search is null
          or o.id::text ilike v_search || '%'
          or o.request_title ilike '%' || v_search || '%'
          or o.cloth_type ilike '%' || v_search || '%'
          or o.detail_description ilike '%' || v_search || '%'
          or o.guest_name ilike '%' || v_search || '%'
          or pr.full_name ilike '%' || v_search || '%'
          or d.contact_name ilike '%' || v_search || '%'
          or (v_pii and u.email ilike '%' || v_search || '%')
          or (v_pii and v_digits is not null and char_length(v_digits) >= 4 and (
            regexp_replace(coalesce(pr.phone_number, ''), '\D', '', 'g') like '%' || v_digits || '%'
            or regexp_replace(coalesce(o.guest_phone, ''), '\D', '', 'g') like '%' || v_digits || '%'
            or coalesce(d.contact_phone, '') like '%' || v_digits || '%')))
    ),
    filtered as (
      select * from base
      where (v_status = 'all' or (v_status = 'unread' and is_unread) or status::text = v_status)
        and (v_progress = 'all' or progress_status = v_progress)
    ),
    page as (select * from filtered order by created_at desc limit v_limit offset v_offset)
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'all', (select count(*) from base),
        'pending', (select count(*) from base where status::text = 'pending'),
        'approved', (select count(*) from base where status::text = 'approved'),
        'rejected', (select count(*) from base where status::text = 'rejected'),
        'unread', (select count(*) from base where is_unread)
      ),
      'progress_counts', coalesce((select jsonb_object_agg(progress_status, n) from (
        select progress_status, count(*) as n from base group by progress_status) c), '{}'::jsonb),
      'can_manage', public._admin_has_permission(v_actor, 'orders.manage'),
      'can_view_pii', v_pii,
      'rows', coalesce((
        select jsonb_agg(
          (to_jsonb(p) - 'customer_name' - 'customer_phone' - 'customer_email' - 'guest_phone' - 'guest_name')
          || jsonb_build_object(
            'customer_name', case when v_pii then p.customer_name else public._mask_name(p.customer_name) end,
            'customer_phone', case when v_pii then p.customer_phone else public._mask_phone(p.customer_phone) end,
            'customer_email', case when v_pii then p.customer_email else null end,
            'guest_name', case when v_pii then p.guest_name else public._mask_name(p.guest_name) end,
            'guest_phone', case when v_pii then p.guest_phone else public._mask_phone(p.guest_phone) end,
            'is_guest', p.user_id is null
          )
          order by p.created_at desc)
        from page p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_production_requests(text, text, text, integer, integer, text) from public, anon;
grant execute on function public.admin_list_production_requests(text, text, text, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 관리자 상세 (열면 '확인함'으로 기록)
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_production_request(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'orders.pii');
  v_order public.orders%rowtype;
  v_detail public.production_request_details%rowtype;
  v_progress public.production_request_progress%rowtype;
  v_profile public.profiles%rowtype;
  v_email text;
  v_account_type text;
  v_signed_up timestamptz;
  v_has_detail boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.status::text in ('draft', 'deleted') then
    raise exception '제작 의뢰를 찾을 수 없습니다.';
  end if;

  select * into v_detail from public.production_request_details where order_id = p_order_id;
  v_has_detail := found;

  insert into public.production_request_progress (order_id, progress_status, checked_at, checked_by, updated_at)
  values (p_order_id, public._production_effective_progress(null, v_order.status::text), now(), v_actor, now())
  on conflict (order_id) do update
    set checked_at = coalesce(public.production_request_progress.checked_at, now()),
        checked_by = coalesce(public.production_request_progress.checked_by, v_actor);
  select * into v_progress from public.production_request_progress where order_id = p_order_id;

  if v_order.user_id is not null then
    select * into v_profile from public.profiles where id = v_order.user_id;
    select u.email, u.created_at into v_email, v_signed_up from auth.users u where u.id = v_order.user_id;
    v_account_type := v_profile.account_type;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'request_source', v_order.request_source,
    'status', v_order.status,
    'admin_comment', v_order.admin_comment,
    'created_at', v_order.created_at,
    'progress_status', public._production_effective_progress(v_progress.progress_status, v_order.status::text),
    'progress_updated_at', v_progress.updated_at,
    'checked_at', v_progress.checked_at,
    'can_manage', public._admin_has_permission(v_actor, 'orders.manage'),
    'can_view_pii', v_pii,
    'image_url', coalesce(v_detail.image_url, v_order.generated_image_url),
    'image_path', coalesce(v_detail.image_path, v_order.image_path),
    'request', case when v_has_detail then jsonb_build_object(
      'contact_name', case when v_pii then v_detail.contact_name else public._mask_name(v_detail.contact_name) end,
      'contact_phone', case when v_pii then v_detail.contact_phone else public._mask_phone(v_detail.contact_phone) end,
      'quantity', v_detail.quantity,
      'quantity_undecided', v_detail.quantity_undecided,
      'budget', v_detail.budget,
      'customer_request', v_detail.customer_request,
      'ai_prompt', v_detail.ai_prompt,
      'design_brief', v_detail.design_brief,
      'design_id', v_detail.design_id,
      'image_source_url', v_detail.image_source_url,
      'entry_point', v_detail.entry_point,
      'entry_path', v_detail.entry_path,
      'privacy_consent_version', v_detail.privacy_consent_version,
      'privacy_consented_at', v_detail.privacy_consented_at,
      'created_at', v_detail.created_at
    ) else null end,
    'account', case when v_order.user_id is null then jsonb_build_object('is_guest', true) else jsonb_build_object(
      'is_guest', false,
      'user_id', v_order.user_id,
      'email', case when v_pii then v_email else null end,
      'username', v_profile.username,
      'full_name', case when v_pii then v_profile.full_name else public._mask_name(v_profile.full_name) end,
      'phone_number', case when v_pii then v_profile.phone_number else public._mask_phone(v_profile.phone_number) end,
      'account_type', v_account_type,
      'signed_up_at', v_signed_up
    ) end,
    'memos', case when v_pii then coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'author_name', m.author_name, 'created_at', m.created_at)
        order by m.created_at desc)
      from public.production_request_memos m where m.order_id = p_order_id), '[]'::jsonb) else null end
  );
end;
$$;

revoke all on function public.admin_get_production_request(uuid) from public, anon;
grant execute on function public.admin_get_production_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 진행 상태 변경 (orders.manage) — orders.status 도 매핑에 맞춰 함께 바꾼다
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_production_request_progress(
  p_order_id uuid,
  p_progress text,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.manage');
  v_row public.orders%rowtype;
  v_before_progress text;
  v_status text := public._production_progress_order_status(p_progress);
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if v_status is null then
    raise exception '진행 상태를 다시 선택해주세요.';
  end if;
  if char_length(coalesce(v_comment, '')) > 2000 then
    raise exception '고객 안내 문구는 2000자까지 입력할 수 있습니다.';
  end if;

  select * into v_row from public.orders where id = p_order_id for update;
  if not found or v_row.status::text in ('draft', 'deleted') then
    raise exception '제작 의뢰를 찾을 수 없습니다.';
  end if;
  if p_progress = 'not_contracted' and v_comment is null and nullif(btrim(coalesce(v_row.admin_comment, '')), '') is null then
    raise exception '계약 미성사 사유(고객 안내 문구)를 입력해주세요.';
  end if;

  select public._production_effective_progress(progress_status, v_row.status::text) into v_before_progress
  from public.production_request_progress where order_id = p_order_id;
  v_before_progress := coalesce(v_before_progress, public._production_effective_progress(null, v_row.status::text));

  perform set_config('brander.admin_rpc', 'on', true);
  update public.orders
  set status = v_status::public.order_status,
      admin_comment = coalesce(v_comment, admin_comment),
      reviewed_at = case when v_status = 'pending' then reviewed_at else now() end,
      reviewed_by = case when v_status = 'pending' then reviewed_by else v_actor end,
      updated_at = now()
  where id = p_order_id;

  insert into public.production_request_progress (order_id, progress_status, checked_at, checked_by, updated_at, updated_by)
  values (p_order_id, p_progress, now(), v_actor, now(), v_actor)
  on conflict (order_id) do update
    set progress_status = excluded.progress_status,
        checked_at = coalesce(public.production_request_progress.checked_at, now()),
        checked_by = coalesce(public.production_request_progress.checked_by, v_actor),
        updated_at = now(), updated_by = v_actor;

  perform public._admin_log(
    'production_request.progress', 'order', p_order_id::text,
    coalesce(v_row.request_title, v_row.cloth_type),
    jsonb_build_object('progress_status', v_before_progress, 'status', v_row.status, 'admin_comment', v_row.admin_comment),
    jsonb_build_object('progress_status', p_progress, 'status', v_status, 'admin_comment', coalesce(v_comment, v_row.admin_comment)),
    v_comment,
    jsonb_build_object('request_source', v_row.request_source)
  );

  return jsonb_build_object('id', p_order_id, 'progress_status', p_progress, 'status', v_status);
end;
$$;

revoke all on function public.admin_update_production_request_progress(uuid, text, text) from public, anon;
grant execute on function public.admin_update_production_request_progress(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 내부 메모 (작성: orders.manage, 조회: orders.pii — 상담 중 개인정보가 적힐 수 있다)
-- ---------------------------------------------------------------------------

create or replace function public.admin_add_production_request_memo(p_order_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.manage');
  v_body text := btrim(coalesce(p_body, ''));
  v_row public.orders%rowtype;
  v_memo public.production_request_memos%rowtype;
begin
  if v_body = '' then
    raise exception '메모 내용을 입력해주세요.';
  end if;
  if char_length(v_body) > 2000 then
    raise exception '메모는 2000자까지 입력할 수 있습니다.';
  end if;
  select * into v_row from public.orders where id = p_order_id;
  if not found or v_row.status::text in ('draft', 'deleted') then
    raise exception '제작 의뢰를 찾을 수 없습니다.';
  end if;

  insert into public.production_request_memos (order_id, author_id, author_name, body)
  values (p_order_id, v_actor, public._admin_display_name(v_actor), v_body)
  returning * into v_memo;

  perform public._admin_log('production_request.memo', 'order', p_order_id::text,
    coalesce(v_row.request_title, v_row.cloth_type), null, jsonb_build_object('memo_id', v_memo.id), null,
    jsonb_build_object('request_source', v_row.request_source, 'length', char_length(v_body)));

  return jsonb_build_object('id', v_memo.id, 'body', v_memo.body, 'author_name', v_memo.author_name, 'created_at', v_memo.created_at);
end;
$$;

revoke all on function public.admin_add_production_request_memo(uuid, text) from public, anon;
grant execute on function public.admin_add_production_request_memo(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. 메뉴 배지: 미확인 제작의뢰 건수 (개인정보 없음)
-- ---------------------------------------------------------------------------

create or replace function public.admin_production_request_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._admin_require('orders.view');
  return (
    select jsonb_build_object(
      'unread_count', count(*) filter (where pg.order_id is not null and pg.checked_at is null),
      'ai_request_count', count(*) filter (where o.request_source = 'ai_image_request'),
      'today_count', count(*) filter (where o.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'))
    )
    from public.orders o
    left join public.production_request_progress pg on pg.order_id = o.id
    where o.status::text not in ('draft', 'deleted')
  );
end;
$$;

revoke all on function public.admin_production_request_summary() from public, anon;
grant execute on function public.admin_production_request_summary() to authenticated;

-- 다른 경로(자동견적 · 디자인 업로드 · 단체복 · 기존 AI 디자인 의뢰)로 새로 접수되는 제작의뢰도 미확인 건수에 잡히도록
-- orders 에 접수(pending) 행이 생기면 진행 상태 행을 만든다. 초안(draft)이 접수로 바뀌는 경우도 포함한다.
create or replace function public._production_request_track_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text = 'pending' and (tg_op = 'INSERT' or old.status::text = 'draft') then
    insert into public.production_request_progress (order_id, progress_status, checked_at, updated_at)
    values (new.id, 'new', null, now())
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public._production_request_track_new() from public, anon, authenticated;

drop trigger if exists orders_production_request_track_new on public.orders;
create trigger orders_production_request_track_new
after insert or update of status on public.orders
for each row execute function public._production_request_track_new();

-- ---------------------------------------------------------------------------
-- 9. 기존 상태 변경 RPC(검토 대기 / 승인 / 반려)도 진행 상태와 맞춘다 (시그니처 · 동작 동일)
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_production_request_status(p_order_id uuid, p_status text, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('orders.manage');
  v_row public.orders%rowtype;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception '제작 의뢰 상태는 검토 대기 · 승인 · 반려만 선택할 수 있습니다.';
  end if;
  if p_status = 'rejected' and v_comment is null then
    raise exception '반려 사유를 입력해주세요.';
  end if;
  if char_length(coalesce(v_comment, '')) > 2000 then
    raise exception '관리자 메모는 2000자까지 입력할 수 있습니다.';
  end if;

  select * into v_row from public.orders where id = p_order_id for update;
  if not found or v_row.status::text in ('draft', 'deleted') then
    raise exception '제작 의뢰를 찾을 수 없습니다.';
  end if;

  perform set_config('brander.admin_rpc', 'on', true);
  update public.orders
  set status = p_status::public.order_status,
      admin_comment = coalesce(v_comment, admin_comment),
      reviewed_at = case when p_status = 'pending' then null else now() end,
      reviewed_by = case when p_status = 'pending' then null else v_actor end,
      updated_at = now()
  where id = p_order_id;

  insert into public.production_request_progress (order_id, progress_status, checked_at, checked_by, updated_at, updated_by)
  values (p_order_id, public._production_effective_progress(null, p_status), now(), v_actor, now(), v_actor)
  on conflict (order_id) do update
    set progress_status = public._production_effective_progress(public.production_request_progress.progress_status, p_status),
        checked_at = coalesce(public.production_request_progress.checked_at, now()),
        checked_by = coalesce(public.production_request_progress.checked_by, v_actor),
        updated_at = now(), updated_by = v_actor;

  perform public._admin_log(
    'production_request.' || p_status, 'order', p_order_id::text,
    coalesce(v_row.request_title, v_row.cloth_type),
    jsonb_build_object('status', v_row.status, 'admin_comment', v_row.admin_comment),
    jsonb_build_object('status', p_status, 'admin_comment', coalesce(v_comment, v_row.admin_comment)),
    v_comment,
    jsonb_build_object('request_source', v_row.request_source)
  );

  return jsonb_build_object('id', p_order_id, 'status', p_status);
end;
$$;

revoke all on function public.admin_set_production_request_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_production_request_status(uuid, text, text) to authenticated;

comment on column public.orders.request_source is
  '제작 의뢰 유입 경로: ai_design, design_upload, ready_made_group_wear (기성품 단체복 빠른 제작) 또는 ai_image_request (AI 이미지 생성 → 제작의뢰)';

notify pgrst, 'reload schema';
