-- AI 상세 컷 · 디테일 컷 생성
--
-- 사용자가 만든 AI 의류 디자인(designs)을 원본 참조 이미지로 넘겨, 같은 옷을 다른 각도(정면 · 후면 · 측면 · 45도 ·
-- 플랫레이 · 행거 · 마네킹)에서 찍거나 특정 부위(원단 · 봉제 · 넥라인 · 소매 · 밑단 · 프린팅 · 자수 · 부자재 · 포켓 ·
-- 사용자 지정 영역)를 확대한 이미지를 만든다.
--
--  1. design_shots           : 컷 1장 = 1행. 원본 디자인(design_id) · 원본 이미지 URL 과의 연결, 생성 유형, 프롬프트,
--                              상태, 결과 URL, AI 호출 수 · 예상 비용을 저장한다. 본인만 조회.
--  2. design_shot_analyses   : 원본 이미지 분석(보이는 부자재 · 디자인 요소 · 영역) 캐시. 없는 요소는 만들지 않는 데 쓴다.
--  3. AI 사용량              : 새 기능 키 product_shot / product_shot_analysis 와 그 전용 일일 한도를 추가한다.
--                              기존 detail_copy / detail_image / color_image 한도 · 단가 · 동작은 그대로 둔다.

-- ---------------------------------------------------------------------------
-- 1. design_shots
-- ---------------------------------------------------------------------------

create table if not exists public.design_shots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  design_id uuid references public.designs(id) on delete cascade,
  -- 한 번에 요청한 컷 묶음(예: 기본 상품 촬영 세트 5장).
  batch_id uuid,
  source_image_url text not null,
  shot_category text not null,
  shot_type text not null,
  -- 사용자 지정 영역 {x, y, width, height} (0~1 비율). 분석으로 찾은 확대 영역은 focus_box 에.
  region jsonb,
  focus_box jsonb,
  note text,
  reference_image_urls text[] not null default '{}',
  prompt text,
  status text not null default 'queued',
  image_url text,
  storage_path text,
  -- 재생성 전 결과(되돌리기 · 기록용)
  previous_image_urls text[] not null default '{}',
  -- 원본에서 보이지 않는 면을 AI 가 추정한 컷(화면에 "참고 이미지" 표시)
  is_inferred boolean not null default false,
  qa jsonb,
  error_message text,
  provider text,
  model text,
  attempt_count integer not null default 0,
  api_calls integer not null default 0,
  estimated_cost_usd numeric(10, 4) not null default 0,
  latency_ms integer,
  saved_to_closet_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_shots_category_check check (shot_category in ('angle', 'detail', 'custom')),
  constraint design_shots_type_check check (shot_type in (
    'front', 'back', 'side', 'three_quarter', 'flat_lay', 'hanger', 'mannequin',
    'fabric', 'stitching', 'neckline', 'sleeve', 'hem', 'print', 'embroidery', 'closure', 'pocket', 'design_detail',
    'custom_region'
  )),
  constraint design_shots_status_check check (status in ('queued', 'generating', 'succeeded', 'failed')),
  constraint design_shots_source_url_check check (source_image_url ~ '^https://'),
  constraint design_shots_image_url_check check (image_url is null or image_url ~ '^https://')
);

comment on table public.design_shots is
  'AI 상세 컷/디테일 컷. 원본 AI 디자인(design_id, source_image_url)을 참조해 생성한 추가 이미지와 생성 상태 · 비용. Edge Function(generate-product-shot)만 쓰고 본인만 읽는다.';

create index if not exists design_shots_user_idx on public.design_shots (user_id, created_at desc);
create index if not exists design_shots_design_idx on public.design_shots (design_id, created_at desc);
create index if not exists design_shots_source_idx on public.design_shots (user_id, source_image_url);

create or replace function public.set_design_shots_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists design_shots_set_updated_at on public.design_shots;
create trigger design_shots_set_updated_at before update on public.design_shots
  for each row execute function public.set_design_shots_updated_at();

alter table public.design_shots enable row level security;
revoke all on table public.design_shots from anon, authenticated;
grant select, delete on table public.design_shots to authenticated;
-- 화면은 "내 옷장에 저장" 표시만 바꿀 수 있다(생성 결과 · 상태 · 비용은 Edge Function 만).
grant update (saved_to_closet_at) on table public.design_shots to authenticated;
grant all on table public.design_shots to service_role;

drop policy if exists "Users read own design shots" on public.design_shots;
create policy "Users read own design shots"
  on public.design_shots for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users update own design shots" on public.design_shots;
create policy "Users update own design shots"
  on public.design_shots for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own design shots" on public.design_shots;
create policy "Users delete own design shots"
  on public.design_shots for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. design_shot_analyses (원본 이미지 분석 캐시)
-- ---------------------------------------------------------------------------

create table if not exists public.design_shot_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  design_id uuid references public.designs(id) on delete cascade,
  source_image_url text not null,
  analysis jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  constraint design_shot_analyses_source_key unique (user_id, source_image_url)
);

comment on table public.design_shot_analyses is
  '상세/디테일 컷 생성 전 원본 의류 이미지 분석(보이는 부자재 · 디자인 요소와 위치). 원본에 없는 디테일을 만들지 않기 위해 쓴다.';

alter table public.design_shot_analyses enable row level security;
revoke all on table public.design_shot_analyses from anon, authenticated;
grant select on table public.design_shot_analyses to authenticated;
grant all on table public.design_shot_analyses to service_role;

drop policy if exists "Users read own design shot analyses" on public.design_shot_analyses;
create policy "Users read own design shot analyses"
  on public.design_shot_analyses for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. AI 사용량: 상세 컷 기능 추가 (기존 기능의 한도 · 단가는 변경하지 않음)
-- ---------------------------------------------------------------------------

alter table public.ai_usage_logs
  drop constraint if exists ai_usage_logs_feature_check,
  add constraint ai_usage_logs_feature_check
    check (feature in ('detail_copy', 'detail_image', 'color_image', 'product_shot', 'product_shot_analysis'));

insert into public.platform_settings (key, value, description) values
  ('ai_product_shot_daily_limit', '40'::jsonb, '제작자 1인당 하루 AI 상세 컷/디테일 컷 생성 한도(성공+실패 시도 포함).'),
  ('ai_product_shot_analysis_daily_limit', '60'::jsonb, '제작자 1인당 하루 상세 컷용 원본 디자인 분석 한도.')
on conflict (key) do nothing;

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
  v_label text;
begin
  if p_feature not in ('detail_copy', 'detail_image', 'color_image', 'product_shot', 'product_shot_analysis') then
    raise exception 'unknown feature';
  end if;
  v_daily_limit := case p_feature
    when 'detail_image' then public._platform_setting_numeric('ai_detail_image_daily_limit', 40)
    when 'color_image' then public._platform_setting_numeric('ai_color_image_daily_limit', 40)
    when 'product_shot' then public._platform_setting_numeric('ai_product_shot_daily_limit', 40)
    when 'product_shot_analysis' then public._platform_setting_numeric('ai_product_shot_analysis_daily_limit', 60)
    else public._platform_setting_numeric('ai_detail_copy_daily_limit', 60) end::integer;
  v_label := case p_feature
    when 'detail_copy' then '문구'
    when 'color_image' then '컬러 이미지'
    when 'product_shot' then '상세 컷'
    when 'product_shot_analysis' then '디자인 분석'
    else '이미지' end;
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
        then format('오늘 AI %s 생성 한도(%s회)를 모두 사용했습니다. 내일 다시 시도해주세요.', v_label, v_daily_limit)
        else format('이 상세페이지의 AI 이미지 생성 한도(%s회)를 초과했습니다. 관리자에게 문의해주세요.', v_page_limit) end,
      'used', v_used, 'limit', v_daily_limit
    );
  end if;
  return jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_daily_limit, 'page_used', v_page_used, 'page_limit', v_page_limit);
end;
$$;

revoke all on function public.ai_usage_precheck(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.ai_usage_precheck(uuid, text, uuid) to service_role;

-- 사용량 기록. p_units(이미지 생성 호출 수) · p_secondary_units(검수 · 분석 같은 텍스트 호출 수)를 받아
-- 실제 호출 수만큼 예상 비용을 계산하고 그 값을 돌려준다. 기존 호출(두 인자 없음)은 이전과 똑같이 1단위로 기록된다.
drop function if exists public.log_ai_usage(uuid, text, text, text, text, uuid, text, integer, text, jsonb, uuid);
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
  p_metadata jsonb default '{}'::jsonb,
  p_funding_id uuid default null,
  p_units integer default null,
  p_secondary_units integer default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost numeric := 0;
  v_image_rate numeric := public._platform_setting_numeric('ai_image_unit_cost_usd', 0.04);
  v_copy_rate numeric := public._platform_setting_numeric('ai_copy_unit_cost_usd', 0.002);
  v_units integer := greatest(coalesce(p_units, 1), 0);
  v_secondary integer := greatest(coalesce(p_secondary_units, 0), 0);
begin
  if p_status = 'success' or (p_units is not null and p_feature in ('product_shot', 'product_shot_analysis')) then
    -- 기존 기능: 성공 1건 = 단가 1개. 상세 컷: 실패해도 실제로 호출한 만큼 비용을 기록한다.
    v_cost := case
      when p_feature in ('detail_image', 'color_image', 'product_shot') then v_units * v_image_rate
      else v_units * v_copy_rate end
      + v_secondary * v_copy_rate;
  end if;
  insert into public.ai_usage_logs (
    user_id, feature, status, provider, model, detail_page_id, funding_id, image_type,
    units, estimated_cost_usd, latency_ms, error_message, metadata
  ) values (
    p_user_id, p_feature, p_status, p_provider, p_model, p_detail_page_id,
    coalesce(p_funding_id, (select funding_id from public.product_detail_pages where id = p_detail_page_id)),
    p_image_type, v_units, v_cost, p_latency_ms, left(p_error, 1000), coalesce(p_metadata, '{}'::jsonb)
  );
  return v_cost;
end;
$$;

revoke all on function public.log_ai_usage(uuid, text, text, text, text, uuid, text, integer, text, jsonb, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.log_ai_usage(uuid, text, text, text, text, uuid, text, integer, text, jsonb, uuid, integer, integer) to service_role;

-- 제작자 본인 오늘 상세 컷 사용량(생성 화면 표시용)
create or replace function public.get_my_product_shot_quota()
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
    'used', public._ai_usage_today(auth.uid(), 'product_shot'),
    'limit', public._platform_setting_numeric('ai_product_shot_daily_limit', 40)::integer
  );
end;
$$;

revoke all on function public.get_my_product_shot_quota() from public, anon;
grant execute on function public.get_my_product_shot_quota() to authenticated;
