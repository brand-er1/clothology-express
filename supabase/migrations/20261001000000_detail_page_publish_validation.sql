-- AI 상세페이지 "상세페이지 등록" 전 필수 항목 검증 (비파괴적)
--
--  * validate_detail_page_for_publish(page_id): 등록에 필요한 항목 중 빠진 것을 배열로 돌려준다.
--      [{ key, label, message, target }]   target = 'page'(상세페이지에서 수정) | 'funding'(펀딩 정보 수정)
--  * publish_detail_page: 위 검증을 통과해야만 게시본(published_document)을 갱신한다.
--    함수 시그니처/반환값은 그대로이므로 기존 호출부(상세페이지 적용, 펀딩 시작 시 자동 적용)는 변경 없이 동작한다.
--
-- 새 테이블/컬럼은 없다. 초안(product_detail_pages + detail_page_sections)과 게시본/버전 구조를 그대로 사용한다.
-- fundings 등 거래 데이터는 읽기만 한다.

create or replace function public._detail_page_missing_items(p_page_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_page public.product_detail_pages%rowtype;
  v_funding public.fundings%rowtype;
  v_has_funding boolean := false;
  v_missing jsonb := '[]'::jsonb;
  v_price numeric;
  v_sizes integer;
  v_colors integer;
  v_has_text boolean;
  v_has_hero_image boolean;
begin
  select * into v_page from public.product_detail_pages where id = p_page_id;
  if not found then
    raise exception '상세페이지를 찾을 수 없습니다.';
  end if;

  if v_page.funding_id is not null then
    select * into v_funding from public.fundings where id = v_page.funding_id;
    v_has_funding := found;
  end if;

  -- 1. 대표 이미지: 보이는 히어로 섹션에 이미지가 1장 이상
  select exists (
    select 1
    from public.detail_page_sections s,
      jsonb_array_elements(case when jsonb_typeof(s.images) = 'array' then s.images else '[]'::jsonb end) as img(value)
    where s.detail_page_id = p_page_id
      and s.section_type = 'hero'
      and s.is_visible
      and coalesce(btrim(img.value ->> 'url'), '') <> ''
  ) into v_has_hero_image;
  if not v_has_hero_image then
    v_missing := v_missing || jsonb_build_object('key', 'hero_image', 'label', '대표 이미지',
      'message', '메인 비주얼(히어로) 섹션에 대표 이미지를 1장 이상 넣어주세요.', 'target', 'page');
  end if;

  -- 2. 상품명
  if coalesce(btrim(v_page.title), '') = '' then
    v_missing := v_missing || jsonb_build_object('key', 'product_name', 'label', '상품명',
      'message', '상품명을 입력해주세요.', 'target', 'page');
  end if;

  -- 3. 상품 설명: 한 줄 소개 또는 보이는 소개/디자인/텍스트 섹션 본문
  select coalesce(btrim(v_page.subtitle), '') <> '' or exists (
    select 1 from public.detail_page_sections s
    where s.detail_page_id = p_page_id
      and s.is_visible
      and s.section_type in ('story', 'design', 'custom_text')
      and coalesce(btrim(s.content ->> 'description'), '') <> ''
  ) into v_has_text;
  if not v_has_text then
    v_missing := v_missing || jsonb_build_object('key', 'description', 'label', '상품 설명',
      'message', '한 줄 소개 또는 제품 소개 본문을 입력해주세요.', 'target', 'page');
  end if;

  if v_has_funding then
    v_price := v_funding.price;
    v_sizes := coalesce(cardinality(v_funding.size_options), 0);
    select greatest(
      coalesce(cardinality(array_remove(v_funding.color_options, '')), 0),
      (select count(*)::integer from public.funding_colors c where c.funding_id = v_funding.id and c.status = 'active'),
      case when coalesce(btrim(v_funding.color), '') <> '' then 1 else 0 end
    ) into v_colors;
  else
    v_price := case
      when coalesce(v_page.source #>> '{userProvided,price}', '') ~ '^[0-9]+(\.[0-9]+)?$'
        then (v_page.source #>> '{userProvided,price}')::numeric
      else null end;
    v_sizes := case when jsonb_typeof(v_page.source -> 'sizeOptions') = 'array'
      then jsonb_array_length(v_page.source -> 'sizeOptions') else 0 end;
    v_colors := case
      when coalesce(btrim(v_page.source ->> 'color'), '') <> ''
        or coalesce(btrim(v_page.source #>> '{userProvided,colorName}'), '') <> ''
        or (jsonb_typeof(v_page.source -> 'availableColors') = 'array' and jsonb_array_length(v_page.source -> 'availableColors') > 0)
      then 1 else 0 end;
  end if;

  -- 4. 가격
  if v_price is null or v_price <= 0 then
    v_missing := v_missing || jsonb_build_object('key', 'price', 'label', '가격',
      'message', '판매 가격을 입력해주세요.', 'target', case when v_has_funding then 'funding' else 'page' end);
  end if;

  -- 5. 옵션(컬러)
  if v_colors = 0 then
    v_missing := v_missing || jsonb_build_object('key', 'options', 'label', '옵션(컬러)',
      'message', '구매 옵션(컬러)을 1개 이상 등록해주세요.', 'target', case when v_has_funding then 'funding' else 'page' end);
  end if;

  -- 6. 사이즈
  if v_sizes = 0 then
    v_missing := v_missing || jsonb_build_object('key', 'sizes', 'label', '사이즈',
      'message', '판매할 사이즈를 1개 이상 선택해주세요.', 'target', case when v_has_funding then 'funding' else 'page' end);
  end if;

  -- 7. 필수 펀딩 정보: 연결된 펀딩 + 목표 수량 + 펀딩 기간
  if not v_has_funding then
    v_missing := v_missing || jsonb_build_object('key', 'funding', 'label', '펀딩 정보',
      'message', '상세페이지를 등록할 펀딩이 없습니다. ‘펀딩 시작하기’로 펀딩을 먼저 만들어주세요.', 'target', 'funding');
  elsif coalesce(v_funding.moq, 0) <= 0 or coalesce(v_funding.funding_days, 0) <= 0 then
    v_missing := v_missing || jsonb_build_object('key', 'funding', 'label', '펀딩 정보',
      'message', '목표 수량(MOQ)과 펀딩 기간을 입력해주세요.', 'target', 'funding');
  end if;

  return v_missing;
end;
$$;

revoke all on function public._detail_page_missing_items(uuid) from public, anon, authenticated;

create or replace function public.validate_detail_page_for_publish(p_page_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public._detail_page_can_view(p_page_id) then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;
  return public._detail_page_missing_items(p_page_id);
end;
$$;

revoke all on function public.validate_detail_page_for_publish(uuid) from public, anon;
grant execute on function public.validate_detail_page_for_publish(uuid) to authenticated;

-- "상세페이지 등록" / "변경사항 저장": 검증 → 게시본 고정 → 버전 기록. 펀딩 row 는 건드리지 않는다.
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
  v_missing jsonb;
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

  v_missing := public._detail_page_missing_items(p_page_id);
  if jsonb_array_length(v_missing) > 0 then
    raise exception '상세페이지를 등록하려면 다음 항목을 입력해주세요: %',
      (select string_agg(item ->> 'label', ', ') from jsonb_array_elements(v_missing) as items(item))
      using errcode = 'P0001', detail = v_missing::text, hint = 'detail_page_missing_items';
  end if;

  v_version := public._detail_page_add_version(p_page_id, 'published', coalesce(p_note, '상세페이지 등록'), v_snapshot);

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

revoke all on function public.publish_detail_page(uuid, text) from public, anon;
grant execute on function public.publish_detail_page(uuid, text) to authenticated;

-- 고객용 게시본 조회 보안 수정: 비로그인(auth.uid() = null)일 때 `creator_id = auth.uid()` 가 NULL 이 되어
-- `if not (...)` 전체가 NULL → 차단 분기를 건너뛰고 비공개(승인 전) 펀딩의 게시본이 노출되던 문제를 막는다.
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
  if not coalesce(
    (v_funding.status in ('approved', 'closed') and coalesce(v_funding.is_hidden, false) = false)
    or (auth.uid() is not null and v_funding.creator_id = auth.uid())
    or (auth.uid() is not null and public._admin_has_permission(auth.uid(), 'fundings.view')),
    false
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

revoke all on function public.get_published_detail_page(uuid) from public;
grant execute on function public.get_published_detail_page(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
