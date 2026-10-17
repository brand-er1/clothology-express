-- 관리자: AI 디자인 통합 관리 · 통합 대시보드 통계 · 리뷰 관리
--
-- 원칙
--  * 추가(additive) 전용: 기존 테이블·데이터·Storage 는 변경하지 않는다. 이미지를 복사하지 않고
--    기존 행(generated_images / designs / orders)과 기존 Storage 경로(generated_images 버킷)를 그대로 가리킨다.
--  * DB 에 있는 정보만 내려준다. 값이 없으면 null 로 두고 화면에서 '-' 로 표시한다(추정·생성 금지).
--  * 전체 회원 이미지 조회는 관리자 권한(members.view)을 서버에서 확인한다. 일반 회원/제작자는 호출할 수 없다.
--
-- 이미지 출처
--  ai     generated_images (AI 생성 결과)                  + 같은 image_path 의 designs 행이 있으면 핏/컬러/원단을 보탠다
--  ai     designs (generated_images 에 없는 디자인 기록)    — data: URL(브라우저 임시 이미지)은 제외
--  upload orders.request_source = 'design_upload' (회원이 직접 업로드해 제작 의뢰한 디자인)
-- 펀딩 연결: 같은 회원이 만든 펀딩 중 대표 이미지(image_path / image_url)가 같거나,
--            상세페이지(product_detail_pages.design_id)로 이 디자인과 연결된 펀딩.

-- ---------------------------------------------------------------------------
-- 1. 조회 성능용 인덱스 (기존 테이블에 인덱스만 추가)
-- ---------------------------------------------------------------------------

create index if not exists generated_images_created_at_idx on public.generated_images (created_at desc);
create index if not exists generated_images_image_path_idx on public.generated_images (image_path) where image_path is not null;
create index if not exists designs_created_at_idx on public.designs (created_at desc);
create index if not exists designs_image_path_idx on public.designs (image_path) where image_path is not null;
create index if not exists fundings_image_path_idx on public.fundings (image_path) where image_path is not null;
create index if not exists orders_design_upload_idx on public.orders (created_at desc) where request_source = 'design_upload';
create index if not exists funding_reviews_status_created_idx on public.funding_reviews (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. AI 디자인 통합 목록 (내부 전용 집합 함수)
-- ---------------------------------------------------------------------------

create or replace function public._admin_ai_design_items()
returns table (
  item_key text,
  kind text,
  source_table text,
  source_id uuid,
  design_id uuid,
  design_source text,
  user_id uuid,
  created_at timestamptz,
  image_url text,
  image_path text,
  prompt text,
  generation_prompt text,
  detail text,
  category text,
  fabric text,
  fit text,
  color text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    'ai:' || g.id::text, 'ai', 'generated_images', g.id, d.id, d.source, g.user_id, g.created_at,
    coalesce(g.stored_image_url, g.original_image_url), g.image_path,
    g.prompt, g.generation_prompt, g.detail,
    coalesce(nullif(btrim(g.cloth_type), ''), d.product_type),
    coalesce(nullif(btrim(g.material), ''), d.fabric),
    d.fit, d.color
  from public.generated_images g
  left join lateral (
    select dd.id, dd.source, dd.product_type, dd.fabric, dd.fit, dd.color
    from public.designs dd
    where g.image_path is not null and dd.image_path = g.image_path
    order by dd.created_at desc
    limit 1
  ) d on true
  where g.user_id is not null
    and coalesce(g.stored_image_url, g.original_image_url) is not null
    and coalesce(g.stored_image_url, g.original_image_url) not like 'data:%'

  union all

  select
    'design:' || d.id::text, 'ai', 'designs', d.id, d.id, d.source, d.user_id, d.created_at,
    d.front_image_url, d.image_path,
    d.prompt, null, d.detail, d.product_type, d.fabric, d.fit, d.color
  from public.designs d
  where d.user_id is not null
    and d.front_image_url not like 'data:%'
    and not exists (
      select 1 from public.generated_images g
      where d.image_path is not null and g.image_path = d.image_path
    )

  union all

  select
    'upload:' || o.id::text, 'upload', 'orders', o.id, null, o.request_source, o.user_id, o.created_at,
    case when o.generated_image_url like 'data:%' then null else o.generated_image_url end, o.image_path,
    null, null, o.detail_description, o.cloth_type, o.material, null, null
  from public.orders o
  where o.request_source = 'design_upload'
    and o.user_id is not null
    and o.status::text not in ('draft', 'deleted')
    and (o.image_path is not null or (o.generated_image_url is not null and o.generated_image_url not like 'data:%'));
$$;

revoke all on function public._admin_ai_design_items() from public, anon, authenticated;

-- 이미지와 연결된 펀딩(가장 최근 1건). 같은 회원의 펀딩만 본다.
create or replace function public._ai_design_linked_funding(
  p_user_id uuid, p_image_path text, p_image_url text, p_design_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.id
  from public.fundings f
  where f.creator_id = p_user_id
    and (
      (p_image_path is not null and f.image_path = p_image_path)
      or (p_image_url is not null and f.image_url = p_image_url)
      or (p_design_id is not null and exists (
        select 1 from public.product_detail_pages pdp where pdp.design_id = p_design_id and pdp.funding_id = f.id))
    )
  order by f.created_at desc
  limit 1;
$$;

revoke all on function public._ai_design_linked_funding(uuid, text, text, uuid) from public, anon, authenticated;

create or replace function public._ai_design_funding_json(p_funding_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', f.id,
    'name', f.product_name,
    'status', f.status,
    'phase', public._funding_phase(f.status, f.is_hidden, f.suspended_at, f.reviewed_at, f.funding_days,
      f.current_orders, f.moq, f.production_status),
    'funding_status', f.funding_status,
    'early_closed', f.early_closed,
    'current_orders', f.current_orders,
    'moq', f.moq,
    'created_at', f.created_at
  )
  from public.fundings f
  where f.id = p_funding_id;
$$;

revoke all on function public._ai_design_funding_json(uuid) from public, anon, authenticated;

-- 갤러리 목록
--  p_kind: all | ai | upload,  p_funding: all | linked | unlinked,  p_sort: latest | oldest
create or replace function public.admin_list_ai_designs(
  p_kind text default 'all',
  p_funding text default 'all',
  p_sort text default 'latest',
  p_user_id uuid default null,
  p_category text default null,
  p_search text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('members.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'members.pii');
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_kind text := case when p_kind in ('ai', 'upload') then p_kind else 'all' end;
  v_funding text := case when p_funding in ('linked', 'unlinked') then p_funding else 'all' end;
  v_oldest boolean := p_sort = 'oldest';
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
begin
  return (
    with items as (
      select i.*, p.username, p.full_name
      from public._admin_ai_design_items() i
      left join public.profiles p on p.id = i.user_id
      where (p_user_id is null or i.user_id = p_user_id)
        and (v_category is null or i.category = v_category)
        and (v_search is null
          or i.prompt ilike '%' || v_search || '%'
          or i.generation_prompt ilike '%' || v_search || '%'
          or i.detail ilike '%' || v_search || '%'
          or i.category ilike '%' || v_search || '%'
          or p.username ilike '%' || v_search || '%'
          or (v_pii and p.full_name ilike '%' || v_search || '%')
          or i.user_id::text = v_search)
    ),
    kinded as (
      select * from items where v_kind = 'all' or kind = v_kind
    ),
    linked as (
      select k.*,
        case when v_funding = 'all' then null
             else public._ai_design_linked_funding(k.user_id, k.image_path, k.image_url, k.design_id) end as funding_id
      from kinded k
    ),
    filtered as (
      select * from linked
      where v_funding = 'all'
         or (v_funding = 'linked' and funding_id is not null)
         or (v_funding = 'unlinked' and funding_id is null)
    ),
    page as (
      select * from filtered
      order by case when v_oldest then created_at end asc, case when not v_oldest then created_at end desc, item_key
      limit v_limit offset v_offset
    ),
    page_linked as (
      select pg.*, coalesce(pg.funding_id, public._ai_design_linked_funding(pg.user_id, pg.image_path, pg.image_url, pg.design_id)) as linked_funding_id
      from page pg
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'all', (select count(*) from items),
        'ai', (select count(*) from items where kind = 'ai'),
        'upload', (select count(*) from items where kind = 'upload')
      ),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'key', pl.item_key,
        'kind', pl.kind,
        'source_table', pl.source_table,
        'source_id', pl.source_id,
        'design_source', pl.design_source,
        'user_id', pl.user_id,
        'username', pl.username,
        'user_name', case when v_pii then pl.full_name else public._mask_name(pl.full_name) end,
        'created_at', pl.created_at,
        'image_url', pl.image_url,
        'image_path', pl.image_path,
        'category', pl.category,
        'prompt_excerpt', left(coalesce(pl.prompt, pl.detail), 140),
        'funding', case when pl.linked_funding_id is not null then public._ai_design_funding_json(pl.linked_funding_id) end
      ) order by
        case when v_oldest then pl.created_at end asc,
        case when not v_oldest then pl.created_at end desc,
        pl.item_key) from page_linked pl), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_ai_designs(text, text, text, uuid, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_ai_designs(text, text, text, uuid, text, text, integer, integer) to authenticated;

-- 이미지 상세 (p_key: 목록의 key — 'ai:<id>' | 'design:<id>' | 'upload:<id>')
create or replace function public.admin_get_ai_design(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('members.view');
  v_pii boolean := public._admin_has_permission(v_actor, 'members.pii');
  v_item record;
  v_extra jsonb := '{}'::jsonb;
  v_funding uuid;
begin
  select i.*, p.username, p.full_name into v_item
  from public._admin_ai_design_items() i
  left join public.profiles p on p.id = i.user_id
  where i.item_key = p_key;
  if not found then
    raise exception '이미지를 찾을 수 없습니다.';
  end if;

  if v_item.source_table = 'orders' then
    select jsonb_build_object(
      'reference_image_paths', coalesce(o.reference_image_paths, '[]'::jsonb),
      'request_title', o.request_title,
      'requested_quantity', o.requested_quantity,
      'order_status', o.status::text
    ) into v_extra
    from public.orders o where o.id = v_item.source_id;
  end if;

  v_funding := public._ai_design_linked_funding(v_item.user_id, v_item.image_path, v_item.image_url, v_item.design_id);

  return jsonb_build_object(
    'key', v_item.item_key,
    'kind', v_item.kind,
    'source_table', v_item.source_table,
    'source_id', v_item.source_id,
    'design_id', v_item.design_id,
    'design_source', v_item.design_source,
    'user_id', v_item.user_id,
    'username', v_item.username,
    'user_name', case when v_pii then v_item.full_name else public._mask_name(v_item.full_name) end,
    'created_at', v_item.created_at,
    'image_url', v_item.image_url,
    'image_path', v_item.image_path,
    'prompt', v_item.prompt,
    'generation_prompt', v_item.generation_prompt,
    'detail', v_item.detail,
    'category', v_item.category,
    'fabric', v_item.fabric,
    'fit', v_item.fit,
    'color', v_item.color,
    'extra', coalesce(v_extra, '{}'::jsonb),
    'funding', case when v_funding is not null then public._ai_design_funding_json(v_funding) end
  );
end;
$$;

revoke all on function public.admin_get_ai_design(text) from public, anon;
grant execute on function public.admin_get_ai_design(text) to authenticated;

-- 필터 선택지: 카테고리
create or replace function public.admin_ai_design_filter_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._admin_require('members.view');
  return jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(c order by c) from (
        select distinct category as c from public._admin_ai_design_items() where nullif(btrim(category), '') is not null
      ) s), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_ai_design_filter_options() from public, anon;
grant execute on function public.admin_ai_design_filter_options() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. 통합 대시보드 통계 (dashboard.view). 권한이 없는 항목은 null 로 내려 화면에서 잠근다.
-- ---------------------------------------------------------------------------

create or replace function public.admin_get_platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('dashboard.view');
  v_today_start timestamptz := (public._kst_date(now())::timestamp at time zone 'Asia/Seoul');
  v_images boolean := public._admin_has_permission(v_actor, 'members.view');
  v_cs boolean := public._admin_has_permission(v_actor, 'cs.view');
  v_ai_total bigint;
  v_ai_today bigint;
begin
  if v_images then
    select count(*), count(*) filter (where created_at >= v_today_start)
    into v_ai_total, v_ai_today
    from public._admin_ai_design_items();
  end if;

  return jsonb_build_object(
    'members', case when public._admin_has_permission(v_actor, 'members.view')
      then (select count(*) from auth.users u where public._admin_role_of(u.id) is null) end,
    'ai_images', v_ai_total,
    'ai_images_today', v_ai_today,
    'fundings', case when public._admin_has_permission(v_actor, 'fundings.view')
      then (select count(*) from public.fundings) end,
    'inquiries', case when v_cs then (select count(*) from public.funding_inquiries) end,
    'inquiries_pending', case when v_cs then (select count(*) from public.funding_inquiries where status = 'pending' and not is_hidden) end,
    'inquiries_answered', case when v_cs then (select count(*) from public.funding_inquiries where status = 'answered' and not is_hidden) end,
    'reviews_hidden', case when public._admin_has_permission(v_actor, 'content.view')
      then (select count(*) from public.funding_reviews where status = 'hidden') end
  );
end;
$$;

revoke all on function public.admin_get_platform_overview() from public, anon;
grant execute on function public.admin_get_platform_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 리뷰 관리 (content.view 조회 / content.manage 또는 reports.manage 숨김·노출)
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_funding_reviews(
  p_status text default 'all',
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
  v_actor uuid := public._admin_require('content.view');
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  return (
    with base as (
      select r.*, f.product_name, b.brand_name
      from public.funding_reviews r
      join public.fundings f on f.id = r.funding_id
      left join public.brands b on b.id = f.brand_id
      where v_search is null
         or r.nickname ilike '%' || v_search || '%'
         or r.content ilike '%' || v_search || '%'
         or f.product_name ilike '%' || v_search || '%'
    ),
    filtered as (
      select * from base where coalesce(p_status, 'all') = 'all' or status = p_status
    ),
    page as (
      select * from filtered order by created_at desc limit v_limit offset v_offset
    )
    select jsonb_build_object(
      'total', (select count(*) from filtered),
      'counts', jsonb_build_object(
        'all', (select count(*) from base),
        'visible', (select count(*) from base where status = 'visible'),
        'hidden', (select count(*) from base where status = 'hidden')
      ),
      'can_moderate', public._admin_has_permission(v_actor, 'content.manage') or public._admin_has_permission(v_actor, 'reports.manage'),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'funding_id', p.funding_id,
        'funding_name', p.product_name,
        'brand_name', p.brand_name,
        'reviewer_id', p.reviewer_id,
        'nickname', p.nickname,
        'rating', p.rating,
        'content', p.content,
        'image_paths', to_jsonb(p.image_paths),
        'selected_color', p.selected_color,
        'selected_size', p.selected_size,
        'status', p.status,
        'created_at', p.created_at
      ) order by p.created_at desc) from page p), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_funding_reviews(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_funding_reviews(text, text, integer, integer) to authenticated;

create or replace function public.admin_set_funding_review_status(p_review_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.funding_reviews%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not (public._admin_has_permission(v_actor, 'content.manage') or public._admin_has_permission(v_actor, 'reports.manage')) then
    raise exception '이 작업을 수행할 관리자 권한이 없습니다. (content.manage / reports.manage)' using errcode = '42501';
  end if;
  if p_status not in ('visible', 'hidden') then
    raise exception '알 수 없는 상태입니다.';
  end if;
  if p_status = 'hidden' and v_reason is null then
    raise exception '숨김 사유를 입력해주세요.';
  end if;
  select * into v_row from public.funding_reviews where id = p_review_id for update;
  if not found then
    raise exception '리뷰를 찾을 수 없습니다.';
  end if;

  perform set_config('brander.admin_rpc', 'on', true);
  update public.funding_reviews set status = p_status where id = p_review_id;
  perform public._admin_log(
    case when p_status = 'hidden' then 'review.hide' else 'review.show' end,
    'funding_review', v_row.id::text, left(v_row.content, 80),
    jsonb_build_object('status', v_row.status), jsonb_build_object('status', p_status), v_reason,
    jsonb_build_object('funding_id', v_row.funding_id)
  );
end;
$$;

revoke all on function public.admin_set_funding_review_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_funding_review_status(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
