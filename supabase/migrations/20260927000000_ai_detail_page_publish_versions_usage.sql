-- AI 상세페이지 고도화 (비파괴적)
--
--  1. 게시(publish) 분리: 편집 중인 초안(product_detail_pages + detail_page_sections)과
--     고객에게 보이는 게시본(published_document)을 분리한다. 기존에 펀딩에 연결되어
--     이미 고객에게 보이던 상세페이지는 현재 내용 그대로 게시본으로 백필해 노출이 끊기지 않게 한다.
--  2. 버전 관리: detail_page_versions 에 스냅샷을 남기고 복구할 수 있다(복구 전 현재본도 백업).
--  3. 참고자료 업로드: detail_page_references (creator-assets 버킷, 제작자 폴더).
--  4. 이미지 타입 flat_lay, 스타일 vintage / y2k / emotional / lookbook 추가(CHECK 상위 집합으로만 확장).
--  5. AI 사용량 로그 / 한도: ai_usage_logs + platform_settings 한도 값 + Super Admin 조회 RPC.
--
-- fundings / funding_participations / 결제 / 주문 등 기존 거래 데이터는 읽기만 하며 변경하지 않는다.

-- ---------------------------------------------------------------------------
-- 1. 스타일 / 이미지 타입 확장
-- ---------------------------------------------------------------------------

alter table public.product_detail_pages
  drop constraint if exists product_detail_pages_template_check,
  add constraint product_detail_pages_template_check
    check (template in ('minimal', 'street', 'luxury', 'sports', 'casual', 'vintage', 'y2k', 'emotional', 'lookbook'));

alter table public.generated_assets
  drop constraint if exists generated_assets_image_type_check,
  add constraint generated_assets_image_type_check
    check (image_type in ('hero', 'product_front', 'product_back', 'detail', 'editorial', 'lifestyle', 'fabric', 'mood', 'flat_lay'));

-- ---------------------------------------------------------------------------
-- 2. 게시본 컬럼
-- ---------------------------------------------------------------------------

alter table public.product_detail_pages
  add column if not exists published_document jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists published_version integer not null default 0,
  add column if not exists published_by uuid references auth.users(id) on delete set null;

comment on column public.product_detail_pages.published_document is
  '고객에게 노출되는 게시본 스냅샷 {page:{...}, sections:[...]}. 편집(자동저장)은 이 값을 바꾸지 않고 "상세페이지 적용" 시에만 갱신된다.';

-- 제작자가 Data API 로 게시본을 직접 덮어쓰지 못하게 한다(게시는 publish_detail_page 로만).
create or replace function public._guard_detail_page_publish_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
    and (
      new.published_document is distinct from old.published_document
      or new.published_at is distinct from old.published_at
      or new.published_version is distinct from old.published_version
      or new.published_by is distinct from old.published_by
    ) then
    raise exception '상세페이지 게시는 "상세페이지 적용"으로만 할 수 있습니다.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists product_detail_pages_guard_publish on public.product_detail_pages;
create trigger product_detail_pages_guard_publish
before update on public.product_detail_pages
for each row execute function public._guard_detail_page_publish_columns();

-- 현재 초안을 save_product_detail_page 입력과 같은 형태로 스냅샷한다.
create or replace function public._detail_page_snapshot(p_page_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'page', jsonb_build_object(
      'template', p.template,
      'title', p.title,
      'title_en', p.title_en,
      'subtitle', p.subtitle,
      'main_copy', p.main_copy,
      'source', p.source,
      'generation', p.generation
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'section_type', s.section_type,
        'sort_order', s.sort_order,
        'is_visible', s.is_visible,
        'content', s.content,
        'images', s.images
      ) order by s.sort_order)
      from public.detail_page_sections s
      where s.detail_page_id = p.id
    ), '[]'::jsonb)
  )
  from public.product_detail_pages p
  where p.id = p_page_id;
$$;

revoke all on function public._detail_page_snapshot(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. 버전 관리
-- ---------------------------------------------------------------------------

create table if not exists public.detail_page_versions (
  id uuid primary key default gen_random_uuid(),
  detail_page_id uuid not null references public.product_detail_pages(id) on delete cascade,
  version integer not null,
  kind text not null,
  note text,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint detail_page_versions_unique unique (detail_page_id, version),
  constraint detail_page_versions_kind_check check (kind in (
    'ai_generated', 'manual_save', 'image_regenerated', 'copy_regenerated', 'published', 'restore_backup', 'migrated'
  )),
  constraint detail_page_versions_note_length check (note is null or char_length(note) <= 300)
);

create index if not exists detail_page_versions_page_idx
  on public.detail_page_versions (detail_page_id, version desc);

alter table public.detail_page_versions enable row level security;
revoke all on table public.detail_page_versions from anon, authenticated;

create or replace function public._detail_page_can_edit(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.product_detail_pages p
    where p.id = p_page_id and p.user_id = auth.uid()
  );
$$;

revoke all on function public._detail_page_can_edit(uuid) from public, anon, authenticated;

create or replace function public._detail_page_can_view(p_page_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._detail_page_can_edit(p_page_id)
    or public._admin_has_permission(auth.uid(), 'fundings.view');
$$;

revoke all on function public._detail_page_can_view(uuid) from public, anon, authenticated;

create or replace function public._detail_page_add_version(
  p_page_id uuid,
  p_kind text,
  p_note text,
  p_snapshot jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer;
begin
  -- 같은 페이지에 대한 동시 버전 생성 직렬화
  perform 1 from public.product_detail_pages where id = p_page_id for update;
  select coalesce(max(version), 0) + 1 into v_version
  from public.detail_page_versions where detail_page_id = p_page_id;

  insert into public.detail_page_versions (detail_page_id, version, kind, note, snapshot, created_by)
  values (p_page_id, v_version, p_kind, nullif(left(btrim(coalesce(p_note, '')), 300), ''), p_snapshot, auth.uid());
  return v_version;
end;
$$;

revoke all on function public._detail_page_add_version(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.create_detail_page_version(p_page_id uuid, p_kind text, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._detail_page_can_edit(p_page_id) then
    raise exception '상세페이지를 수정할 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_kind not in ('ai_generated', 'manual_save', 'image_regenerated', 'copy_regenerated') then
    raise exception '올바르지 않은 버전 유형입니다.';
  end if;
  return public._detail_page_add_version(p_page_id, p_kind, p_note, public._detail_page_snapshot(p_page_id));
end;
$$;

create or replace function public.list_detail_page_versions(p_page_id uuid)
returns table (
  id uuid,
  version integer,
  kind text,
  note text,
  created_by_name text,
  created_at timestamptz,
  section_count integer,
  is_published boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._detail_page_can_view(p_page_id) then
    raise exception '버전 이력을 볼 권한이 없습니다.' using errcode = '42501';
  end if;
  return query
  select v.id, v.version, v.kind, v.note,
    coalesce(nullif(pr.username, ''), nullif(pr.full_name, ''), '제작자'),
    v.created_at,
    jsonb_array_length(coalesce(v.snapshot -> 'sections', '[]'::jsonb)),
    v.version = (select p.published_version from public.product_detail_pages p where p.id = p_page_id)
  from public.detail_page_versions v
  left join public.profiles pr on pr.id = v.created_by
  where v.detail_page_id = p_page_id
  order by v.version desc
  limit 100;
end;
$$;

-- 버전 복구: 현재 초안을 먼저 백업 버전으로 남긴 뒤, 선택한 스냅샷을 초안에 적용한다(게시본은 그대로).
create or replace function public.restore_detail_page_version(p_page_id uuid, p_version_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
  v_version integer;
  v_backup integer;
  v_section_ids uuid[];
begin
  if not public._detail_page_can_edit(p_page_id) then
    raise exception '상세페이지를 수정할 권한이 없습니다.' using errcode = '42501';
  end if;

  select snapshot, version into v_snapshot, v_version
  from public.detail_page_versions
  where id = p_version_id and detail_page_id = p_page_id;
  if v_snapshot is null then
    raise exception '버전을 찾을 수 없습니다.';
  end if;

  v_backup := public._detail_page_add_version(
    p_page_id, 'restore_backup', format('버전 %s 복구 전 자동 백업', v_version), public._detail_page_snapshot(p_page_id)
  );

  update public.product_detail_pages
  set template = coalesce(v_snapshot #>> '{page,template}', template),
      title = coalesce(v_snapshot #>> '{page,title}', title),
      title_en = coalesce(v_snapshot #>> '{page,title_en}', title_en),
      subtitle = coalesce(v_snapshot #>> '{page,subtitle}', subtitle),
      main_copy = coalesce(v_snapshot #>> '{page,main_copy}', main_copy),
      source = coalesce(v_snapshot #> '{page,source}', source),
      generation = coalesce(v_snapshot #> '{page,generation}', generation)
  where id = p_page_id;

  select coalesce(array_agg((elem ->> 'id')::uuid), '{}')
  into v_section_ids
  from jsonb_array_elements(coalesce(v_snapshot -> 'sections', '[]'::jsonb)) as elems(elem);

  delete from public.detail_page_sections
  where detail_page_id = p_page_id and not (id = any(v_section_ids));

  insert into public.detail_page_sections (id, detail_page_id, section_type, sort_order, is_visible, content, images)
  select (elem ->> 'id')::uuid, p_page_id, elem ->> 'section_type',
    coalesce((elem ->> 'sort_order')::integer, (ord - 1)::integer),
    coalesce((elem ->> 'is_visible')::boolean, true),
    coalesce(elem -> 'content', '{}'::jsonb),
    coalesce(elem -> 'images', '[]'::jsonb)
  from jsonb_array_elements(coalesce(v_snapshot -> 'sections', '[]'::jsonb)) with ordinality as elems(elem, ord)
  on conflict (id) do update
  set section_type = excluded.section_type,
      sort_order = excluded.sort_order,
      is_visible = excluded.is_visible,
      content = excluded.content,
      images = excluded.images
  where public.detail_page_sections.detail_page_id = p_page_id;

  return v_backup;
end;
$$;

-- "상세페이지 적용": 현재 초안을 게시본으로 고정하고 버전을 남긴다. 펀딩 row 는 건드리지 않는다.
create or replace function public.publish_detail_page(p_page_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
  v_version integer;
  v_visible integer;
begin
  if not public._detail_page_can_edit(p_page_id) then
    raise exception '상세페이지를 적용할 권한이 없습니다.' using errcode = '42501';
  end if;

  v_snapshot := public._detail_page_snapshot(p_page_id);
  select count(*) into v_visible
  from jsonb_array_elements(coalesce(v_snapshot -> 'sections', '[]'::jsonb)) as elems(elem)
  where coalesce((elem ->> 'is_visible')::boolean, true);
  if v_visible = 0 then
    raise exception '보이는 섹션이 하나 이상 있어야 적용할 수 있습니다.';
  end if;

  v_version := public._detail_page_add_version(p_page_id, 'published', coalesce(p_note, '상세페이지 적용'), v_snapshot);

  update public.product_detail_pages
  set published_document = v_snapshot,
      published_at = now(),
      published_version = v_version,
      published_by = auth.uid(),
      status = case when status = 'draft' then 'ready' else status end
  where id = p_page_id;

  return jsonb_build_object('published_version', v_version, 'published_at', now());
end;
$$;

-- 편집 화면 상태 표시용: 게시 버전/시각과 게시 이후 수정 여부
create or replace function public.get_detail_page_publish_state(p_page_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_page public.product_detail_pages%rowtype;
begin
  if not public._detail_page_can_view(p_page_id) then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;
  select * into v_page from public.product_detail_pages where id = p_page_id;
  return jsonb_build_object(
    'published_version', v_page.published_version,
    'published_at', v_page.published_at,
    'has_unpublished_changes', v_page.published_document is null
      or v_page.published_document is distinct from public._detail_page_snapshot(p_page_id),
    'latest_version', (select max(version) from public.detail_page_versions where detail_page_id = p_page_id),
    'can_edit', public._detail_page_can_edit(p_page_id)
  );
end;
$$;

-- 고객용 조회: 게시본만 반환한다. 펀딩이 공개 상태(승인/종료, 비공개 아님)일 때만,
-- 또는 제작자 본인/관리자일 때 반환한다.
create or replace function public.get_published_detail_page(p_funding_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_page public.product_detail_pages%rowtype;
  v_funding public.fundings%rowtype;
begin
  select * into v_funding from public.fundings where id = p_funding_id;
  if not found then
    return null;
  end if;
  select * into v_page from public.product_detail_pages
  where funding_id = p_funding_id and user_id = v_funding.creator_id;
  if not found or v_page.published_document is null then
    return null;
  end if;
  if not (
    (v_funding.status in ('approved', 'closed') and coalesce(v_funding.is_hidden, false) = false)
    or v_funding.creator_id = auth.uid()
    or public._admin_has_permission(auth.uid(), 'fundings.view')
  ) then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_page.id,
    'user_id', v_page.user_id,
    'funding_id', v_page.funding_id,
    'published_version', v_page.published_version,
    'published_at', v_page.published_at,
    'document', v_page.published_document
  );
end;
$$;

-- 백필: 이미 펀딩에 연결된(=지금까지 고객에게 바로 보이던) 상세페이지는 현재 내용을 게시본 v1 로 만든다.
do $$
declare
  v_page record;
  v_snapshot jsonb;
  v_version integer;
begin
  for v_page in
    select id from public.product_detail_pages
    where funding_id is not null and published_document is null
  loop
    v_snapshot := public._detail_page_snapshot(v_page.id);
    select coalesce(max(version), 0) + 1 into v_version from public.detail_page_versions where detail_page_id = v_page.id;
    insert into public.detail_page_versions (detail_page_id, version, kind, note, snapshot)
    values (v_page.id, v_version, 'migrated', '게시 기능 도입 전 공개되던 상세페이지 자동 게시', v_snapshot);
    -- 마이그레이션은 postgres 권한으로 실행되므로 게시 컬럼 보호 트리거를 통과한다.
    update public.product_detail_pages
    set published_document = v_snapshot, published_at = now(), published_version = v_version
    where id = v_page.id;
  end loop;
end $$;

-- 초안은 이제 제작자 본인/관리자만 직접 조회한다. 고객은 get_published_detail_page 로 게시본만 본다.
drop policy if exists "Detail pages are readable" on public.product_detail_pages;
create policy "Detail pages are readable"
  on public.product_detail_pages for select
  using (
    user_id = (select auth.uid())
    or public.is_admin((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- 4. 참고자료 업로드
-- ---------------------------------------------------------------------------

create table if not exists public.detail_page_references (
  id uuid primary key default gen_random_uuid(),
  detail_page_id uuid not null references public.product_detail_pages(id) on delete cascade,
  funding_id uuid references public.fundings(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'reference',
  url text not null,
  storage_path text,
  mime_type text not null default 'image/webp',
  caption text,
  use_for_generation boolean not null default true,
  created_at timestamptz not null default now(),
  constraint detail_page_references_kind_check check (kind in (
    'sample', 'fabric', 'detail', 'wearing', 'reference', 'logo', 'brand'
  )),
  -- PDF 는 추후 지원(스토리지 허용 MIME 추가 후 이 제약만 넓히면 된다)
  constraint detail_page_references_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint detail_page_references_url_check check (url ~ '^https://'),
  constraint detail_page_references_caption_length check (caption is null or char_length(caption) <= 200)
);

create index if not exists detail_page_references_page_idx
  on public.detail_page_references (detail_page_id, created_at);

alter table public.detail_page_references enable row level security;

drop policy if exists "Owners read detail page references" on public.detail_page_references;
create policy "Owners read detail page references"
  on public.detail_page_references for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

drop policy if exists "Owners add detail page references" on public.detail_page_references;
create policy "Owners add detail page references"
  on public.detail_page_references for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.product_detail_pages p
      where p.id = detail_page_references.detail_page_id
        and p.user_id = (select auth.uid())
        and (detail_page_references.funding_id is null or detail_page_references.funding_id = p.funding_id)
    )
    -- 본인 스토리지 폴더(creator-assets/{uid}/...)의 파일만 연결
    and (storage_path is null or split_part(storage_path, '/', 1) = (select auth.uid())::text)
  );

drop policy if exists "Owners update detail page references" on public.detail_page_references;
create policy "Owners update detail page references"
  on public.detail_page_references for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Owners remove detail page references" on public.detail_page_references;
create policy "Owners remove detail page references"
  on public.detail_page_references for delete
  to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.detail_page_references to authenticated;

-- ---------------------------------------------------------------------------
-- 5. AI 사용량 로그 / 한도
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  feature text not null,
  status text not null,
  provider text,
  model text,
  detail_page_id uuid references public.product_detail_pages(id) on delete set null,
  funding_id uuid references public.fundings(id) on delete set null,
  image_type text,
  units integer not null default 1,
  estimated_cost_usd numeric(10, 4) not null default 0,
  latency_ms integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_usage_logs_feature_check check (feature in ('detail_copy', 'detail_image')),
  constraint ai_usage_logs_status_check check (status in ('success', 'failed', 'rejected_quota'))
);

comment on table public.ai_usage_logs is
  'AI 상세페이지 카피/이미지 생성 사용량. Edge Function(service role)만 기록하며 Super Admin 이 조회한다.';

create index if not exists ai_usage_logs_user_idx on public.ai_usage_logs (user_id, feature, created_at desc);
create index if not exists ai_usage_logs_page_idx on public.ai_usage_logs (detail_page_id, feature);
create index if not exists ai_usage_logs_created_idx on public.ai_usage_logs (created_at desc);

alter table public.ai_usage_logs enable row level security;
revoke all on table public.ai_usage_logs from anon, authenticated;

insert into public.platform_settings (key, value, description) values
  ('ai_detail_image_daily_limit', '40'::jsonb, '제작자 1인당 하루 AI 상세페이지 이미지 생성 한도(성공+실패 시도 포함).'),
  ('ai_detail_image_page_limit', '150'::jsonb, '상세페이지 1개당 누적 AI 이미지 생성 한도.'),
  ('ai_detail_copy_daily_limit', '60'::jsonb, '제작자 1인당 하루 AI 상세페이지 카피 생성 한도.'),
  ('ai_image_unit_cost_usd', '0.04'::jsonb, 'AI 이미지 1장 예상 비용(USD). 사용량 대시보드의 비용 추정에 사용.'),
  ('ai_copy_unit_cost_usd', '0.002'::jsonb, 'AI 카피 1회 예상 비용(USD).')
on conflict (key) do nothing;

create or replace function public._ai_usage_today(p_user_id uuid, p_feature text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.ai_usage_logs
  where user_id = p_user_id
    and feature = p_feature
    and status in ('success', 'failed')
    and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
$$;

revoke all on function public._ai_usage_today(uuid, text) from public, anon, authenticated;

-- Edge Function 전용: 호출 전 한도 확인. 초과 시 rejected_quota 로그를 남기고 allowed=false.
create or replace function public.ai_usage_precheck(p_user_id uuid, p_feature text, p_detail_page_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_limit integer;
  v_used integer;
  v_page_limit integer;
  v_page_used integer := 0;
begin
  if p_feature not in ('detail_copy', 'detail_image') then
    raise exception 'unknown feature';
  end if;
  v_daily_limit := public._platform_setting_numeric(
    case when p_feature = 'detail_image' then 'ai_detail_image_daily_limit' else 'ai_detail_copy_daily_limit' end,
    case when p_feature = 'detail_image' then 40 else 60 end)::integer;
  v_used := public._ai_usage_today(p_user_id, p_feature);

  if p_feature = 'detail_image' and p_detail_page_id is not null then
    v_page_limit := public._platform_setting_numeric('ai_detail_image_page_limit', 150)::integer;
    select count(*)::integer into v_page_used from public.ai_usage_logs
    where detail_page_id = p_detail_page_id and feature = 'detail_image' and status in ('success', 'failed');
  end if;

  if v_used >= v_daily_limit or (v_page_limit is not null and v_page_used >= v_page_limit) then
    insert into public.ai_usage_logs (user_id, feature, status, detail_page_id, units, error_message)
    values (p_user_id, p_feature, 'rejected_quota', p_detail_page_id, 0,
      case when v_used >= v_daily_limit then 'daily_limit' else 'page_limit' end);
    return jsonb_build_object(
      'allowed', false,
      'reason', case when v_used >= v_daily_limit
        then format('오늘 AI %s 생성 한도(%s회)를 모두 사용했습니다. 내일 다시 시도해주세요.',
          case when p_feature = 'detail_image' then '이미지' else '문구' end, v_daily_limit)
        else format('이 상세페이지의 AI 이미지 생성 한도(%s회)를 초과했습니다. 관리자에게 문의해주세요.', v_page_limit) end,
      'used', v_used, 'limit', v_daily_limit
    );
  end if;
  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_daily_limit, 'page_used', v_page_used, 'page_limit', v_page_limit);
end;
$$;

create or replace function public.log_ai_usage(
  p_user_id uuid,
  p_feature text,
  p_status text,
  p_provider text default null,
  p_model text default null,
  p_detail_page_id uuid default null,
  p_image_type text default null,
  p_latency_ms integer default null,
  p_error text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost numeric := 0;
begin
  if p_status = 'success' then
    v_cost := public._platform_setting_numeric(
      case when p_feature = 'detail_image' then 'ai_image_unit_cost_usd' else 'ai_copy_unit_cost_usd' end,
      case when p_feature = 'detail_image' then 0.04 else 0.002 end);
  end if;
  insert into public.ai_usage_logs (
    user_id, feature, status, provider, model, detail_page_id, funding_id, image_type,
    estimated_cost_usd, latency_ms, error_message, metadata
  ) values (
    p_user_id, p_feature, p_status, p_provider, p_model, p_detail_page_id,
    (select funding_id from public.product_detail_pages where id = p_detail_page_id),
    p_image_type, v_cost, p_latency_ms, left(p_error, 1000), coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.ai_usage_precheck(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.log_ai_usage(uuid, text, text, text, text, uuid, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.ai_usage_precheck(uuid, text, uuid) to service_role;
grant execute on function public.log_ai_usage(uuid, text, text, text, text, uuid, text, integer, text, jsonb) to service_role;

-- 제작자 본인 오늘 사용량(생성 화면 표시용)
create or replace function public.get_my_ai_quota()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  return jsonb_build_object(
    'image_used', public._ai_usage_today(auth.uid(), 'detail_image'),
    'image_limit', public._platform_setting_numeric('ai_detail_image_daily_limit', 40)::integer,
    'copy_used', public._ai_usage_today(auth.uid(), 'detail_copy'),
    'copy_limit', public._platform_setting_numeric('ai_detail_copy_daily_limit', 60)::integer
  );
end;
$$;

-- 관리자 권한 매트릭스에 AI 사용량 조회(Super Admin 전용)를 추가한다.
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
      'ai_usage.view'
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

create or replace function public.admin_get_ai_usage(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
begin
  perform public._admin_require('ai_usage.view');
  return jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'image_success', count(*) filter (where feature = 'detail_image' and status = 'success'),
        'image_failed', count(*) filter (where feature = 'detail_image' and status = 'failed'),
        'copy_success', count(*) filter (where feature = 'detail_copy' and status = 'success'),
        'copy_failed', count(*) filter (where feature = 'detail_copy' and status = 'failed'),
        'rejected_quota', count(*) filter (where status = 'rejected_quota'),
        'estimated_cost_usd', coalesce(sum(estimated_cost_usd), 0),
        'creators', count(distinct user_id),
        'pages', count(distinct detail_page_id)
      )
      from public.ai_usage_logs where created_at >= v_from and created_at < v_to
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'images', (select count(*) from public.ai_usage_logs l where l.feature = 'detail_image' and l.status = 'success' and public._kst_date(l.created_at) = d.day),
        'failed', (select count(*) from public.ai_usage_logs l where l.status = 'failed' and public._kst_date(l.created_at) = d.day),
        'cost', (select coalesce(sum(l.estimated_cost_usd), 0) from public.ai_usage_logs l where public._kst_date(l.created_at) = d.day)
      ) order by d.day)
      from generate_series(public._kst_date(v_from), public._kst_date(v_to - interval '1 second'), interval '1 day') as d(day)
    ), '[]'::jsonb),
    'creators', coalesce((
      select jsonb_agg(x) from (
        select l.user_id,
          coalesce(nullif(c.display_name, ''), nullif(p.username, ''), nullif(p.full_name, ''), '제작자') as name,
          count(*) filter (where l.feature = 'detail_image' and l.status = 'success') as images,
          count(*) filter (where l.feature = 'detail_copy' and l.status = 'success') as copies,
          count(*) filter (where l.status = 'failed') as failed,
          count(*) filter (where l.status = 'rejected_quota') as rejected,
          coalesce(sum(l.estimated_cost_usd), 0) as cost
        from public.ai_usage_logs l
        left join public.creator_profiles c on c.user_id = l.user_id
        left join public.profiles p on p.id = l.user_id
        where l.created_at >= v_from and l.created_at < v_to
        group by l.user_id, c.display_name, p.username, p.full_name
        order by cost desc, images desc
        limit 50
      ) x
    ), '[]'::jsonb),
    'fundings', coalesce((
      select jsonb_agg(x) from (
        select l.funding_id, f.product_name as name,
          count(*) filter (where l.feature = 'detail_image' and l.status = 'success') as images,
          count(*) filter (where l.status = 'failed') as failed,
          coalesce(sum(l.estimated_cost_usd), 0) as cost
        from public.ai_usage_logs l
        join public.fundings f on f.id = l.funding_id
        where l.created_at >= v_from and l.created_at < v_to
        group by l.funding_id, f.product_name
        order by cost desc
        limit 30
      ) x
    ), '[]'::jsonb),
    'recent_failures', coalesce((
      select jsonb_agg(x) from (
        select l.created_at, l.feature, l.image_type, l.model, left(l.error_message, 200) as error
        from public.ai_usage_logs l
        where l.status = 'failed' and l.created_at >= v_from and l.created_at < v_to
        order by l.created_at desc
        limit 20
      ) x
    ), '[]'::jsonb),
    'limits', jsonb_build_object(
      'image_daily', public._platform_setting_numeric('ai_detail_image_daily_limit', 40),
      'image_page', public._platform_setting_numeric('ai_detail_image_page_limit', 150),
      'copy_daily', public._platform_setting_numeric('ai_detail_copy_daily_limit', 60)
    )
  );
end;
$$;

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
        'create_detail_page_version', 'list_detail_page_versions', 'restore_detail_page_version',
        'publish_detail_page', 'get_detail_page_publish_state', 'get_my_ai_quota', 'admin_get_ai_usage'
      )
  loop
    execute format('revoke all on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end $$;

revoke all on function public.get_published_detail_page(uuid) from public;
grant execute on function public.get_published_detail_page(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
