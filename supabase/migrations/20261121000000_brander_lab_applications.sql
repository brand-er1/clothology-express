-- BRAND-ER LAB 무료 의류 제작 신청 (비파괴적 마이그레이션: 새 테이블 · 함수 · 버킷만 추가)
--
-- 흐름
--  * 신청: 비회원도 가능. 브라우저 → Edge Function submit-lab-application(service_role) → public.lab_create_application.
--    anon / authenticated 는 신청 테이블과 이미지 버킷을 직접 읽거나 쓸 수 없다(RLS 정책 없음, 권한 회수).
--  * 관리: 관리자 콘솔 /admin/lab-applications. 모든 조회 · 변경은 admin_* RPC 가 서버에서 권한을 다시 검사한다.
--      lab.view   : 목록 · 상세 · 참고 이미지 · CSV  (Super · Operations · CS)
--      lab.manage : 상태 · 메모 · 동의 철회 기록 · 촬영 세부 동의 기록 · 보유 기간 · 삭제  (Super · Operations)
--    상세 열람 · CSV 다운로드 · 변경 · 삭제는 Audit Log 에 남는다(개인정보 접속 기록).
--  * 동의 문구는 lab_consent_documents 에 버전별로 보관하고(수정 불가), 신청마다 어떤 버전에 언제 동의했는지
--    lab_consent_records 에 추가 전용으로 남긴다. 철회도 새 행으로 기록한다.
--  * 보유 기간: 접수일 + 1년. '콘텐츠 게시 완료'로 바뀌면 그날부터 1년으로 연장. 만료 건은 관리자 화면에서 골라 파기한다.

-- ---------------------------------------------------------------------------
-- 1. 동의 문구 버전
-- ---------------------------------------------------------------------------

create table if not exists public.lab_consent_documents (
  consent_key text not null,
  version text not null,
  title text not null,
  body text not null,
  is_required boolean not null,
  is_current boolean not null default true,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (consent_key, version),
  constraint lab_consent_documents_key_check check (consent_key in ('participation', 'filming', 'privacy', 'marketing'))
);

comment on table public.lab_consent_documents is
  'BRAND-ER LAB 신청 동의 문구 버전. 문구는 수정하지 않고 새 버전을 추가한 뒤 이전 버전의 is_current 만 false 로 바꾼다. 화면 문구는 supabase/functions/_shared/labApplication.ts 와 같아야 한다.';

create unique index if not exists lab_consent_documents_current_idx
  on public.lab_consent_documents (consent_key) where is_current;

create or replace function public._lab_consent_document_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception '동의 문구 버전은 삭제할 수 없습니다.';
  end if;
  if new.consent_key is distinct from old.consent_key or new.version is distinct from old.version
    or new.title is distinct from old.title or new.body is distinct from old.body
    or new.is_required is distinct from old.is_required or new.effective_at is distinct from old.effective_at then
    raise exception '동의 문구는 수정할 수 없습니다. 새 버전을 추가해주세요.';
  end if;
  return new;
end;
$$;

drop trigger if exists lab_consent_documents_immutable on public.lab_consent_documents;
create trigger lab_consent_documents_immutable
before update or delete on public.lab_consent_documents
for each row execute function public._lab_consent_document_immutable();

alter table public.lab_consent_documents enable row level security;
revoke all on table public.lab_consent_documents from anon, authenticated;
grant select on table public.lab_consent_documents to anon, authenticated;
drop policy if exists "Anyone can read lab consent documents" on public.lab_consent_documents;
create policy "Anyone can read lab consent documents"
  on public.lab_consent_documents for select to anon, authenticated using (true);

insert into public.lab_consent_documents (consent_key, version, title, body, is_required, is_current) values
  ('participation', '2026-11-21.v1', '프로젝트 참여 및 제작 과정 공개 동의',
   '본인은 무료 의류 제작 프로젝트의 진행 방식에 대해 안내받았으며, 선정 시 신청한 디자인의 제작 과정 및 완성품이 브랜더의 콘텐츠로 소개될 수 있음에 동의합니다.',
   true, true),
  ('filming', '2026-11-21.v1', '인스타그램 릴스 촬영 및 게시 동의',
   '본인은 프로젝트 진행 과정에서 사전 협의된 촬영에 참여하고, 촬영된 영상과 음성, 초상 등이 브랜더 공식 인스타그램 계정에 게시되는 것에 동의합니다. 실제 촬영 전에는 촬영 범위, 게시 매체, 이용 기간, 편집 및 재사용 범위를 구체적으로 안내받고 별도로 동의 여부를 결정합니다.',
   true, true),
  ('privacy', '2026-11-21.v1', '개인정보 수집 및 이용 동의',
   '신청 접수, 참여자 선정 및 연락을 위해 필요한 개인정보의 수집·이용에 동의합니다.',
   true, true),
  ('marketing', '2026-11-21.v1', '추가 콘텐츠 및 홍보 활용 동의',
   '브랜더가 프로젝트 촬영물을 공식 웹사이트, 추가 SNS 콘텐츠 및 홍보 목적으로 활용하는 것에 동의합니다.',
   false, true)
on conflict (consent_key, version) do nothing;

-- ---------------------------------------------------------------------------
-- 2. 신청서
-- ---------------------------------------------------------------------------

create sequence if not exists public.lab_application_no_seq;

create table if not exists public.lab_applications (
  id uuid primary key default gen_random_uuid(),
  application_no text not null unique,
  -- 브라우저가 신청서마다 만드는 값. 같은 값으로 다시 보내면 새로 저장하지 않고 기존 접수 결과를 돌려준다(중복 제출 방지).
  submission_key uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  applicant_name text not null,
  phone text not null,
  email text,
  instagram_id text not null,
  garment_types text[] not null,
  garment_type_other text,
  design_description text not null,
  size text not null,
  size_other text,
  reason text,
  image_paths text[] not null default '{}'::text[],
  status text not null default 'received',
  status_changed_at timestamptz not null default now(),
  admin_memo text,
  admin_memo_updated_at timestamptz,
  admin_memo_updated_by uuid references auth.users(id) on delete set null,
  retention_until timestamptz not null default (now() + interval '1 year'),
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lab_applications_name_check check (char_length(btrim(applicant_name)) between 1 and 30),
  constraint lab_applications_phone_check check (phone ~ '^(010[0-9]{8}|01[16789][0-9]{7,8})$'),
  constraint lab_applications_email_check check (email is null or (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  constraint lab_applications_instagram_check check (
    instagram_id ~ '^[a-z0-9._]{1,30}$' and instagram_id !~ '^\.' and instagram_id !~ '\.$' and position('..' in instagram_id) = 0),
  constraint lab_applications_garment_types_check check (
    cardinality(garment_types) between 1 and 9
    and garment_types <@ array['short_sleeve_tee', 'long_sleeve_tee', 'sweatshirt', 'hoodie', 'hood_zipup', 'shirt', 'pants', 'outer', 'other']::text[]),
  constraint lab_applications_garment_other_check check (
    (('other' = any(garment_types)) and garment_type_other is not null and char_length(btrim(garment_type_other)) between 1 and 50)
    or (not ('other' = any(garment_types)) and garment_type_other is null)),
  constraint lab_applications_design_check check (char_length(btrim(design_description)) between 10 and 2000),
  constraint lab_applications_size_check check (size in ('XS', 'S', 'M', 'L', 'XL', '2XL', 'OTHER')),
  constraint lab_applications_size_other_check check (
    (size = 'OTHER' and size_other is not null and char_length(btrim(size_other)) between 1 and 50)
    or (size <> 'OTHER' and size_other is null)),
  constraint lab_applications_reason_check check (reason is null or char_length(reason) <= 1000),
  constraint lab_applications_images_check check (cardinality(image_paths) <= 5),
  constraint lab_applications_status_check check (status in (
    'received', 'reviewing', 'selected', 'not_selected', 'filming_scheduled', 'in_production', 'production_done', 'content_published')),
  constraint lab_applications_memo_check check (admin_memo is null or char_length(admin_memo) <= 5000),
  constraint lab_applications_user_agent_check check (user_agent is null or char_length(user_agent) <= 500)
);

comment on table public.lab_applications is
  'BRAND-ER LAB 무료 의류 제작 신청. 개인정보 포함: 공개 페이지 · 일반 사용자 접근 불가, 관리자 RPC(lab.view / lab.manage)로만 조회 · 변경.';
comment on column public.lab_applications.phone is '숫자만 저장(010XXXXXXXX).';
comment on column public.lab_applications.instagram_id is '@ 없이 소문자로 저장. 자동 태그 · 공개에 사용하지 않는다.';
comment on column public.lab_applications.image_paths is 'storage 버킷 lab-applications 안의 경로(비공개). 관리자만 서명 URL 로 열람.';
comment on column public.lab_applications.retention_until is '개인정보 보유 기한. 지나면 관리자 화면에서 파기 대상으로 표시된다.';
comment on column public.lab_applications.ip_hash is '중복 · 부정 신청 방지용 접속 IP 의 해시값(원본 IP 는 저장하지 않음).';

create index if not exists lab_applications_created_idx on public.lab_applications (created_at desc);
create index if not exists lab_applications_status_created_idx on public.lab_applications (status, created_at desc);
create index if not exists lab_applications_phone_created_idx on public.lab_applications (phone, created_at desc);
create index if not exists lab_applications_ip_created_idx on public.lab_applications (ip_hash, created_at desc);
create index if not exists lab_applications_retention_idx on public.lab_applications (retention_until);

alter table public.lab_applications enable row level security;
revoke all on table public.lab_applications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. 동의 이력 · 촬영 세부 동의 · 처리 이력
-- ---------------------------------------------------------------------------

create table if not exists public.lab_consent_records (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.lab_applications(id) on delete cascade,
  consent_key text not null,
  consent_version text not null,
  agreed boolean not null,
  action text not null,
  source text not null,
  recorded_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (consent_key, consent_version) references public.lab_consent_documents (consent_key, version),
  constraint lab_consent_records_action_check check (action in ('initial', 'withdraw', 're_agree')),
  constraint lab_consent_records_source_check check (source in ('applicant_web', 'admin_recorded')),
  constraint lab_consent_records_note_check check (note is null or char_length(note) <= 1000)
);

comment on table public.lab_consent_records is
  '신청별 동의 이력(추가 전용). initial=신청 시 동의/미동의, withdraw=철회 요청 기록, re_agree=재동의 기록. 현재 상태는 항목별 최신 행.';

create index if not exists lab_consent_records_application_idx on public.lab_consent_records (application_id, consent_key, created_at desc);

create or replace function public._lab_consent_record_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception '동의 이력은 수정할 수 없습니다. 철회 · 재동의는 새 기록으로 남겨주세요.';
end;
$$;

drop trigger if exists lab_consent_records_immutable on public.lab_consent_records;
create trigger lab_consent_records_immutable
before update on public.lab_consent_records
for each row execute function public._lab_consent_record_immutable();

alter table public.lab_consent_records enable row level security;
revoke all on table public.lab_consent_records from anon, authenticated;

-- 실제 촬영 전 받는 별도 동의(촬영 범위 · 게시 매체 · 이용 기간 · 편집/재사용 범위). 서면 · 전자 동의서 등은 따로 보관하고 여기에 요약과 보관 위치를 남긴다.
create table if not exists public.lab_filming_agreements (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.lab_applications(id) on delete cascade,
  filming_scope text not null,
  channels text not null,
  usage_period text not null,
  edit_reuse_scope text not null,
  agreement_method text not null,
  agreed_at timestamptz not null,
  evidence_note text,
  withdrawn_at timestamptz,
  withdrawn_note text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lab_filming_agreements_scope_check check (char_length(btrim(filming_scope)) between 1 and 1000),
  constraint lab_filming_agreements_channels_check check (char_length(btrim(channels)) between 1 and 500),
  constraint lab_filming_agreements_period_check check (char_length(btrim(usage_period)) between 1 and 200),
  constraint lab_filming_agreements_edit_check check (char_length(btrim(edit_reuse_scope)) between 1 and 1000),
  constraint lab_filming_agreements_method_check check (agreement_method in ('written', 'electronic', 'messenger', 'other')),
  constraint lab_filming_agreements_evidence_check check (evidence_note is null or char_length(evidence_note) <= 1000),
  constraint lab_filming_agreements_withdrawn_check check (withdrawn_note is null or char_length(withdrawn_note) <= 1000)
);

create index if not exists lab_filming_agreements_application_idx on public.lab_filming_agreements (application_id, created_at desc);
alter table public.lab_filming_agreements enable row level security;
revoke all on table public.lab_filming_agreements from anon, authenticated;

create table if not exists public.lab_application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.lab_applications(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now(),
  constraint lab_application_events_type_check check (event_type in (
    'submitted', 'status_changed', 'memo_updated', 'consent_recorded',
    'filming_agreement_recorded', 'filming_agreement_withdrawn', 'retention_changed'))
);

create index if not exists lab_application_events_application_idx on public.lab_application_events (application_id, created_at desc);
alter table public.lab_application_events enable row level security;
revoke all on table public.lab_application_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. 참고 이미지 버킷 (비공개)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-applications', 'lab-applications', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- 업로드는 Edge Function(service_role)만 한다. 신청자 본인을 포함해 일반 사용자는 읽기 · 쓰기 · 삭제 모두 불가.
drop policy if exists "Lab admins can read application images" on storage.objects;
create policy "Lab admins can read application images"
  on storage.objects for select to authenticated
  using (bucket_id = 'lab-applications' and public.has_admin_permission('lab.view'));

drop policy if exists "Lab admins can delete application images" on storage.objects;
create policy "Lab admins can delete application images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'lab-applications' and public.has_admin_permission('lab.manage'));

-- ---------------------------------------------------------------------------
-- 5. 관리자 권한 매트릭스 (기존 목록 + lab.view / lab.manage)
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
      'legacy.tools', 'legacy.settings',
      'ai_usage.view',
      'lab.view', 'lab.manage'
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
      'legacy.tools',
      'lab.view', 'lab.manage'
    ]
    when 'cs_admin' then array[
      'dashboard.view',
      'members.view', 'members.pii',
      'fundings.view',
      'orders.view', 'orders.pii',
      'shipping.view',
      'refunds.view', 'refunds.request',
      'content.view', 'reports.manage',
      'cs.view', 'cs.manage',
      'lab.view'
    ]
    else array[]::text[]
  end;
$$;

-- ---------------------------------------------------------------------------
-- 6. 신청 저장 (Edge Function 전용)
-- ---------------------------------------------------------------------------

create or replace function public._lab_event(p_application_id uuid, p_type text, p_from text, p_to text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  insert into public.lab_application_events (application_id, event_type, from_status, to_status, note, actor_id, actor_name)
  values (p_application_id, p_type, p_from, p_to, nullif(btrim(coalesce(p_note, '')), ''), v_actor,
    case when v_actor is null then null else public._admin_display_name(v_actor) end);
end;
$$;

revoke all on function public._lab_event(uuid, text, text, text, text) from public, anon, authenticated;

-- p_payload: { submissionKey, applicantName, phone, email, instagramId, garmentTypes[], garmentTypeOther, designDescription,
--              size, sizeOther, reason, consents: [{ key, version, agreed }] }
-- 오류 메시지는 'LAB_<CODE>: 안내 문구' 형식이다. Edge Function 이 코드를 HTTP 상태로 바꾼다.
create or replace function public.lab_create_application(
  p_payload jsonb,
  p_image_paths text[] default '{}'::text[],
  p_ip_hash text default null,
  p_user_agent text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key uuid;
  v_existing public.lab_applications%rowtype;
  v_phone text := nullif(btrim(coalesce(p_payload->>'phone', '')), '');
  v_garments text[];
  v_id uuid;
  v_no text;
  v_created timestamptz;
  v_doc record;
  v_consent jsonb;
  v_consent_count integer;
begin
  begin
    v_key := (p_payload->>'submissionKey')::uuid;
  exception when others then
    raise exception 'LAB_INVALID: 신청서 식별값이 올바르지 않습니다.';
  end;
  if v_key is null then
    raise exception 'LAB_INVALID: 신청서 식별값이 올바르지 않습니다.';
  end if;

  -- 같은 신청서를 다시 보낸 경우(더블 클릭 · 네트워크 재시도) 기존 접수 결과를 돌려준다.
  select * into v_existing from public.lab_applications where submission_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'application_no', v_existing.application_no,
      'created_at', v_existing.created_at, 'duplicate', true);
  end if;

  -- 동시에 들어온 같은 연락처 신청이 중복 검사를 함께 통과하지 않도록 연락처 단위로 직렬화한다.
  perform pg_advisory_xact_lock(hashtext('lab_application_phone:' || coalesce(v_phone, '')));

  if p_ip_hash is not null and (
    select count(*) from public.lab_applications
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'LAB_RATE_LIMITED: 짧은 시간에 신청이 많이 접수되었습니다. 잠시 후 다시 시도해주세요.';
  end if;

  if v_phone is not null and exists (
    select 1 from public.lab_applications
    where phone = v_phone and created_at > now() - interval '24 hours'
  ) then
    raise exception 'LAB_DUPLICATE: 이 연락처로 오늘 이미 신청이 접수되었습니다. 신청 내용을 바꾸고 싶으시면 고객센터로 문의해주세요.';
  end if;

  if jsonb_typeof(p_payload->'consents') <> 'array' then
    raise exception 'LAB_CONSENT: 동의 정보가 올바르지 않습니다.';
  end if;
  select count(*) into v_consent_count from jsonb_array_elements(p_payload->'consents');
  if v_consent_count <> (select count(*) from public.lab_consent_documents where is_current) then
    raise exception 'LAB_CONSENT: 동의 항목이 변경되었습니다. 페이지를 새로고침한 뒤 다시 신청해주세요.';
  end if;
  for v_doc in select * from public.lab_consent_documents where is_current loop
    select c.value into v_consent from jsonb_array_elements(p_payload->'consents') as c(value) where c.value->>'key' = v_doc.consent_key limit 1;
    if v_consent is null or v_consent->>'version' is distinct from v_doc.version or jsonb_typeof(v_consent->'agreed') <> 'boolean' then
      raise exception 'LAB_CONSENT: 동의 문구가 변경되었습니다. 페이지를 새로고침한 뒤 다시 신청해주세요.';
    end if;
    if v_doc.is_required and not (v_consent->>'agreed')::boolean then
      raise exception 'LAB_CONSENT: [필수] %에 동의해주세요.', v_doc.title;
    end if;
  end loop;

  if jsonb_typeof(p_payload->'garmentTypes') <> 'array' then
    raise exception 'LAB_INVALID: 의류 종류를 선택해주세요.';
  end if;
  select coalesce(array_agg(distinct value), '{}'::text[]) into v_garments from jsonb_array_elements_text(p_payload->'garmentTypes');

  if coalesce(cardinality(p_image_paths), 0) > 5
    or exists (select 1 from unnest(coalesce(p_image_paths, '{}'::text[])) path where path !~ ('^' || v_key::text || '/[0-9a-z-]+\.(jpg|png|webp)$')) then
    raise exception 'LAB_INVALID: 참고 이미지 정보가 올바르지 않습니다.';
  end if;

  v_no := 'LAB-' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-' || lpad(nextval('public.lab_application_no_seq')::text, 5, '0');

  begin
    insert into public.lab_applications (
      application_no, submission_key, user_id, applicant_name, phone, email, instagram_id,
      garment_types, garment_type_other, design_description, size, size_other, reason,
      image_paths, ip_hash, user_agent, retention_until
    ) values (
      v_no, v_key, p_user_id,
      btrim(p_payload->>'applicantName'),
      v_phone,
      nullif(lower(btrim(coalesce(p_payload->>'email', ''))), ''),
      lower(btrim(p_payload->>'instagramId')),
      v_garments,
      nullif(btrim(coalesce(p_payload->>'garmentTypeOther', '')), ''),
      btrim(p_payload->>'designDescription'),
      btrim(p_payload->>'size'),
      nullif(btrim(coalesce(p_payload->>'sizeOther', '')), ''),
      nullif(btrim(coalesce(p_payload->>'reason', '')), ''),
      coalesce(p_image_paths, '{}'::text[]),
      p_ip_hash,
      left(p_user_agent, 500),
      now() + interval '1 year'
    )
    returning id, created_at into v_id, v_created;
  exception
    when check_violation or not_null_violation then
      raise exception 'LAB_INVALID: 입력값을 다시 확인해주세요. (%)', sqlerrm;
    when unique_violation then
      -- 같은 submission_key 가 동시에 두 번 들어온 경우
      select * into v_existing from public.lab_applications where submission_key = v_key;
      if found then
        return jsonb_build_object('id', v_existing.id, 'application_no', v_existing.application_no,
          'created_at', v_existing.created_at, 'duplicate', true);
      end if;
      raise;
  end;

  insert into public.lab_consent_records (application_id, consent_key, consent_version, agreed, action, source)
  select v_id, d.consent_key, d.version, (c.value->>'agreed')::boolean, 'initial', 'applicant_web'
  from public.lab_consent_documents d
  join jsonb_array_elements(p_payload->'consents') as c(value) on c.value->>'key' = d.consent_key
  where d.is_current;

  perform public._lab_event(v_id, 'submitted', null, 'received', null);

  return jsonb_build_object('id', v_id, 'application_no', v_no, 'created_at', v_created, 'duplicate', false);
end;
$$;

revoke all on function public.lab_create_application(jsonb, text[], text, text, uuid) from public, anon, authenticated;
grant execute on function public.lab_create_application(jsonb, text[], text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. 관리자 RPC
-- ---------------------------------------------------------------------------

-- 항목별 최신 동의 상태: { key: { agreed, at, version, action } }
create or replace function public._lab_consent_state(p_application_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(r.consent_key, jsonb_build_object(
    'agreed', r.agreed, 'at', r.created_at, 'version', r.consent_version, 'action', r.action)), '{}'::jsonb)
  from (
    select distinct on (consent_key) consent_key, agreed, created_at, consent_version, action
    from public.lab_consent_records
    where application_id = p_application_id
    order by consent_key, created_at desc, id desc
  ) r;
$$;

revoke all on function public._lab_consent_state(uuid) from public, anon, authenticated;

create or replace function public._lab_search_match(a public.lab_applications, p_search text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_search is null
    or a.application_no ilike '%' || p_search || '%'
    or a.applicant_name ilike '%' || p_search || '%'
    or a.instagram_id ilike '%' || ltrim(p_search, '@') || '%'
    or coalesce(a.email, '') ilike '%' || p_search || '%'
    or a.design_description ilike '%' || p_search || '%'
    or (char_length(regexp_replace(p_search, '\D', '', 'g')) >= 4
        and a.phone like '%' || regexp_replace(p_search, '\D', '', 'g') || '%');
$$;

revoke all on function public._lab_search_match(public.lab_applications, text) from public, anon, authenticated;

-- 목록. p_status: all | <상태>, p_sort: newest | oldest, p_retention: all | expired
create or replace function public.admin_list_lab_applications(
  p_status text default 'all',
  p_search text default null,
  p_sort text default 'newest',
  p_retention text default 'all',
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
  v_actor uuid := public._admin_require('lab.view');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_oldest boolean := coalesce(p_sort, 'newest') = 'oldest';
  v_expired boolean := coalesce(p_retention, 'all') = 'expired';
begin
  return (
    with base as (
      select a.* from public.lab_applications a
      where public._lab_search_match(a, v_search)
        and (not v_expired or a.retention_until <= now())
    ),
    filtered as (select * from base where coalesce(p_status, 'all') = 'all' or status = p_status),
    page as (
      select * from filtered
      order by case when v_oldest then created_at end asc, case when not v_oldest then created_at end desc
      limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', (
        select jsonb_build_object('all', count(*)) || coalesce(jsonb_object_agg(status, n) filter (where status is not null), '{}'::jsonb)
        from (select status, count(*) as n from base group by status) s
      ),
      'expired_count', (select count(*) from public.lab_applications where retention_until <= now()),
      'can_manage', public._admin_has_permission(v_actor, 'lab.manage'),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'application_no', p.application_no, 'created_at', p.created_at,
          'applicant_name', p.applicant_name, 'phone', p.phone, 'email', p.email, 'instagram_id', p.instagram_id,
          'garment_types', p.garment_types, 'garment_type_other', p.garment_type_other,
          'size', p.size, 'size_other', p.size_other, 'design_description', p.design_description,
          'image_paths', p.image_paths, 'status', p.status, 'status_changed_at', p.status_changed_at,
          'has_memo', p.admin_memo is not null, 'retention_until', p.retention_until,
          'consents', public._lab_consent_state(p.id),
          'has_filming_agreement', exists (select 1 from public.lab_filming_agreements f where f.application_id = p.id and f.withdrawn_at is null)
        ) order by case when v_oldest then p.created_at end asc, case when not v_oldest then p.created_at end desc)
        from page p
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_lab_applications(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_lab_applications(text, text, text, text, integer, integer) to authenticated;

-- 상세(열람 기록을 남긴다)
create or replace function public.admin_get_lab_application(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('lab.view');
  v_row public.lab_applications%rowtype;
begin
  select * into v_row from public.lab_applications where id = p_id;
  if not found then
    raise exception '신청 정보를 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.';
  end if;

  perform public._admin_log('lab_application.view', 'lab_application', p_id::text, v_row.application_no, null, null, null, '{}'::jsonb);

  return jsonb_build_object(
    'application', (to_jsonb(v_row) - 'ip_hash' - 'user_agent' - 'submission_key')
      || jsonb_build_object(
        'admin_memo_updated_by_name', case when v_row.admin_memo_updated_by is null then null else public._admin_display_name(v_row.admin_memo_updated_by) end,
        'is_member', v_row.user_id is not null),
    'can_manage', public._admin_has_permission(v_actor, 'lab.manage'),
    'consents', public._lab_consent_state(p_id),
    'consent_records', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'consent_key', r.consent_key, 'consent_version', r.consent_version, 'title', d.title, 'body', d.body,
        'is_required', d.is_required, 'agreed', r.agreed, 'action', r.action, 'source', r.source, 'note', r.note,
        'recorded_by_name', case when r.recorded_by is null then null else public._admin_display_name(r.recorded_by) end,
        'created_at', r.created_at) order by r.created_at desc, r.id desc)
      from public.lab_consent_records r
      join public.lab_consent_documents d on d.consent_key = r.consent_key and d.version = r.consent_version
      where r.application_id = p_id
    ), '[]'::jsonb),
    'filming_agreements', coalesce((
      select jsonb_agg(to_jsonb(f) || jsonb_build_object(
        'recorded_by_name', case when f.recorded_by is null then null else public._admin_display_name(f.recorded_by) end)
        order by f.created_at desc)
      from public.lab_filming_agreements f where f.application_id = p_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) - 'actor_id' order by e.created_at desc, e.id desc)
      from public.lab_application_events e where e.application_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_get_lab_application(uuid) from public, anon;
grant execute on function public.admin_get_lab_application(uuid) to authenticated;

-- 상태 · 메모 · 보유 기한 변경. null 인 항목은 바꾸지 않는다. p_memo 에 빈 문자열을 보내면 메모를 지운다.
create or replace function public.admin_update_lab_application(
  p_id uuid,
  p_status text default null,
  p_memo text default null,
  p_retention_until timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('lab.manage');
  v_row public.lab_applications%rowtype;
  v_status text;
  v_memo text;
  v_retention timestamptz;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_row from public.lab_applications where id = p_id for update;
  if not found then
    raise exception '신청 정보를 찾을 수 없습니다.';
  end if;

  if p_status is not null and p_status not in (
    'received', 'reviewing', 'selected', 'not_selected', 'filming_scheduled', 'in_production', 'production_done', 'content_published') then
    raise exception '선택할 수 없는 신청 상태입니다.';
  end if;
  if p_memo is not null and char_length(p_memo) > 5000 then
    raise exception '관리자 메모는 5,000자까지 입력할 수 있습니다.';
  end if;
  if p_retention_until is not null and p_retention_until < now() and v_reason is null then
    raise exception '보유 기한을 지난 날짜로 바꾸려면 사유를 입력해주세요.';
  end if;

  v_status := coalesce(p_status, v_row.status);
  v_memo := case when p_memo is null then v_row.admin_memo else nullif(btrim(p_memo), '') end;
  v_retention := coalesce(p_retention_until, v_row.retention_until);
  -- 콘텐츠 게시 완료 시 게시일부터 1년간 보관(이미 더 길면 유지)
  if v_status = 'content_published' and v_row.status <> 'content_published' and p_retention_until is null then
    v_retention := greatest(v_retention, now() + interval '1 year');
  end if;

  update public.lab_applications
  set status = v_status,
      status_changed_at = case when v_status <> v_row.status then now() else status_changed_at end,
      admin_memo = v_memo,
      admin_memo_updated_at = case when v_memo is distinct from v_row.admin_memo then now() else admin_memo_updated_at end,
      admin_memo_updated_by = case when v_memo is distinct from v_row.admin_memo then v_actor else admin_memo_updated_by end,
      retention_until = v_retention,
      updated_at = now()
  where id = p_id;

  if v_status <> v_row.status then
    perform public._lab_event(p_id, 'status_changed', v_row.status, v_status, v_reason);
  end if;
  if v_memo is distinct from v_row.admin_memo then
    perform public._lab_event(p_id, 'memo_updated', null, null, null);
  end if;
  if v_retention is distinct from v_row.retention_until then
    perform public._lab_event(p_id, 'retention_changed', null, null,
      '보유 기한 ' || to_char(v_row.retention_until at time zone 'Asia/Seoul', 'YYYY-MM-DD') || ' → '
      || to_char(v_retention at time zone 'Asia/Seoul', 'YYYY-MM-DD') || coalesce(' · ' || v_reason, ''));
  end if;

  perform public._admin_log('lab_application.update', 'lab_application', p_id::text, v_row.application_no,
    jsonb_build_object('status', v_row.status, 'retention_until', v_row.retention_until, 'memo_changed', false),
    jsonb_build_object('status', v_status, 'retention_until', v_retention, 'memo_changed', v_memo is distinct from v_row.admin_memo),
    v_reason, '{}'::jsonb);

  return jsonb_build_object('id', p_id, 'status', v_status, 'retention_until', v_retention);
end;
$$;

revoke all on function public.admin_update_lab_application(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.admin_update_lab_application(uuid, text, text, timestamptz, text) to authenticated;

-- 신청자가 연락처로 요청한 동의 철회 · 재동의를 기록한다. 철회는 사유(요청 경로 등)가 필수.
create or replace function public.admin_record_lab_consent(p_id uuid, p_consent_key text, p_agreed boolean, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('lab.manage');
  v_no text;
  v_doc public.lab_consent_documents%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select application_no into v_no from public.lab_applications where id = p_id for update;
  if not found then
    raise exception '신청 정보를 찾을 수 없습니다.';
  end if;
  select * into v_doc from public.lab_consent_documents where consent_key = p_consent_key and is_current;
  if not found then
    raise exception '동의 항목을 찾을 수 없습니다.';
  end if;
  if p_agreed is null then
    raise exception '동의 또는 철회를 선택해주세요.';
  end if;
  if v_note is null then
    raise exception '요청 경로와 내용을 메모로 남겨주세요. (예: 2026-11-21 고객센터 전화 요청)';
  end if;

  insert into public.lab_consent_records (application_id, consent_key, consent_version, agreed, action, source, recorded_by, note)
  values (p_id, v_doc.consent_key, v_doc.version, p_agreed, case when p_agreed then 're_agree' else 'withdraw' end, 'admin_recorded', v_actor, v_note);

  perform public._lab_event(p_id, 'consent_recorded', null, null,
    v_doc.title || ' ' || case when p_agreed then '재동의' else '철회' end || ' · ' || v_note);
  perform public._admin_log('lab_application.consent', 'lab_application', p_id::text, v_no, null,
    jsonb_build_object('consent_key', p_consent_key, 'agreed', p_agreed), v_note, '{}'::jsonb);

  return public._lab_consent_state(p_id);
end;
$$;

revoke all on function public.admin_record_lab_consent(uuid, text, boolean, text) from public, anon;
grant execute on function public.admin_record_lab_consent(uuid, text, boolean, text) to authenticated;

-- 실제 촬영 전 받은 세부 동의를 기록한다.
create or replace function public.admin_add_lab_filming_agreement(
  p_id uuid,
  p_filming_scope text,
  p_channels text,
  p_usage_period text,
  p_edit_reuse_scope text,
  p_agreement_method text,
  p_agreed_at timestamptz,
  p_evidence_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('lab.manage');
  v_no text;
  v_agreement_id uuid;
begin
  select application_no into v_no from public.lab_applications where id = p_id for update;
  if not found then
    raise exception '신청 정보를 찾을 수 없습니다.';
  end if;
  if p_agreed_at is null or p_agreed_at > now() + interval '1 day' then
    raise exception '동의 일시를 확인해주세요.';
  end if;

  begin
    insert into public.lab_filming_agreements (
      application_id, filming_scope, channels, usage_period, edit_reuse_scope, agreement_method, agreed_at, evidence_note, recorded_by
    ) values (
      p_id, btrim(coalesce(p_filming_scope, '')), btrim(coalesce(p_channels, '')), btrim(coalesce(p_usage_period, '')),
      btrim(coalesce(p_edit_reuse_scope, '')), p_agreement_method, p_agreed_at, nullif(btrim(coalesce(p_evidence_note, '')), ''), v_actor
    ) returning id into v_agreement_id;
  exception when check_violation then
    raise exception '촬영 범위 · 게시 매체 · 이용 기간 · 편집/재사용 범위 · 동의 방법을 모두 입력해주세요.';
  end;

  perform public._lab_event(p_id, 'filming_agreement_recorded', null, null, '촬영 세부 동의 기록');
  perform public._admin_log('lab_application.filming_agreement', 'lab_application', p_id::text, v_no, null,
    jsonb_build_object('agreement_id', v_agreement_id, 'method', p_agreement_method, 'agreed_at', p_agreed_at), null, '{}'::jsonb);

  return jsonb_build_object('id', v_agreement_id);
end;
$$;

revoke all on function public.admin_add_lab_filming_agreement(uuid, text, text, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.admin_add_lab_filming_agreement(uuid, text, text, text, text, text, timestamptz, text) to authenticated;

create or replace function public.admin_withdraw_lab_filming_agreement(p_agreement_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('lab.manage');
  v_row public.lab_filming_agreements%rowtype;
  v_no text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_note is null then
    raise exception '철회 요청 경로와 내용을 메모로 남겨주세요.';
  end if;
  select * into v_row from public.lab_filming_agreements where id = p_agreement_id for update;
  if not found or v_row.withdrawn_at is not null then
    raise exception '철회할 촬영 동의를 찾을 수 없습니다.';
  end if;
  select application_no into v_no from public.lab_applications where id = v_row.application_id;

  update public.lab_filming_agreements set withdrawn_at = now(), withdrawn_note = v_note where id = p_agreement_id;
  perform public._lab_event(v_row.application_id, 'filming_agreement_withdrawn', null, null, v_note);
  perform public._admin_log('lab_application.filming_agreement_withdraw', 'lab_application', v_row.application_id::text, v_no,
    null, jsonb_build_object('agreement_id', p_agreement_id), v_note, '{}'::jsonb);
  return jsonb_build_object('id', p_agreement_id, 'withdrawn', true);
end;
$$;

revoke all on function public.admin_withdraw_lab_filming_agreement(uuid, text) from public, anon;
grant execute on function public.admin_withdraw_lab_filming_agreement(uuid, text) to authenticated;

-- CSV 다운로드용(최대 5,000건). 다운로드 기록을 남긴다.
create or replace function public.admin_export_lab_applications(
  p_status text default 'all',
  p_search text default null,
  p_retention text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('lab.view');
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_expired boolean := coalesce(p_retention, 'all') = 'expired';
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb) into v_rows
  from (
    select a.created_at, jsonb_build_object(
      'application_no', a.application_no, 'created_at', a.created_at, 'status', a.status,
      'applicant_name', a.applicant_name, 'phone', a.phone, 'email', a.email, 'instagram_id', a.instagram_id,
      'garment_types', a.garment_types, 'garment_type_other', a.garment_type_other,
      'size', a.size, 'size_other', a.size_other, 'design_description', a.design_description, 'reason', a.reason,
      'image_count', cardinality(a.image_paths), 'admin_memo', a.admin_memo, 'retention_until', a.retention_until,
      'consents', public._lab_consent_state(a.id)
    ) as row_data
    from public.lab_applications a
    where public._lab_search_match(a, v_search)
      and (coalesce(p_status, 'all') = 'all' or a.status = p_status)
      and (not v_expired or a.retention_until <= now())
    order by a.created_at desc
    limit 5000
  ) t;

  perform public._admin_log('lab_application.export', 'lab_application', null, 'CSV 다운로드', null, null, null,
    jsonb_build_object('status', p_status, 'search', v_search, 'retention', p_retention, 'count', jsonb_array_length(v_rows)));

  return v_rows;
end;
$$;

revoke all on function public.admin_export_lab_applications(text, text, text) from public, anon;
grant execute on function public.admin_export_lab_applications(text, text, text) to authenticated;

-- 신청 정보 파기. 참고 이미지는 화면이 Storage API 로 먼저 지운 뒤 이 함수를 호출한다.
-- 신청서 · 동의 이력 · 처리 이력이 함께 삭제되고, Audit Log 에는 개인정보 없이 접수 번호만 남는다.
create or replace function public.admin_delete_lab_applications(p_ids uuid[], p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('lab.manage');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_row record;
  v_count integer := 0;
begin
  if v_reason is null then
    raise exception '삭제 사유를 입력해주세요. (예: 보유 기간 만료, 신청자 삭제 요청)';
  end if;
  if coalesce(cardinality(p_ids), 0) = 0 or cardinality(p_ids) > 500 then
    raise exception '한 번에 1~500건까지 삭제할 수 있습니다.';
  end if;

  for v_row in
    delete from public.lab_applications where id = any(p_ids)
    returning id, application_no, status, created_at, retention_until, cardinality(image_paths) as image_count
  loop
    v_count := v_count + 1;
    perform public._admin_log('lab_application.delete', 'lab_application', v_row.id::text, v_row.application_no,
      jsonb_build_object('status', v_row.status, 'created_at', v_row.created_at, 'retention_until', v_row.retention_until, 'image_count', v_row.image_count),
      null, v_reason, '{}'::jsonb);
  end loop;

  return jsonb_build_object('deleted', v_count);
end;
$$;

revoke all on function public.admin_delete_lab_applications(uuid[], text) from public, anon;
grant execute on function public.admin_delete_lab_applications(uuid[], text) to authenticated;

notify pgrst, 'reload schema';
