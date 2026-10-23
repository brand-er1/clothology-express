-- 매거진 확장: 카테고리 5종 · 본문 · SEO 메타태그
--
-- 카테고리 (기존 값 유지 + 3종 추가)
--   brand_news         BRAND-ER NEWS
--   press              언론 보도
--   brand_story        브랜드 스토리
--   creator_interview  제작자 인터뷰
--   insight            패션 및 제조 인사이트
-- 본문(body)은 BRAND-ER 가 직접 쓰는 글이다. 언론 보도는 원문 전체를 옮기지 않고 요약 + 원문 링크로 운영한다.
-- 새 컬럼은 모두 null 허용이며 기존 기사 데이터는 그대로 둔다.

alter table public.magazine_articles drop constraint if exists magazine_articles_category_check;
alter table public.magazine_articles add constraint magazine_articles_category_check
  check (category in ('brand_news', 'press', 'brand_story', 'creator_interview', 'insight'));

alter table public.magazine_articles
  add column if not exists body text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists author_name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'magazine_articles_body_length') then
    alter table public.magazine_articles add constraint magazine_articles_body_length
      check (body is null or char_length(body) <= 20000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'magazine_articles_seo_title_length') then
    alter table public.magazine_articles add constraint magazine_articles_seo_title_length
      check (seo_title is null or char_length(seo_title) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'magazine_articles_seo_description_length') then
    alter table public.magazine_articles add constraint magazine_articles_seo_description_length
      check (seo_description is null or char_length(seo_description) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'magazine_articles_author_length') then
    alter table public.magazine_articles add constraint magazine_articles_author_length
      check (author_name is null or char_length(author_name) <= 80);
  end if;
end;
$$;

create index if not exists magazine_articles_category_published_idx
  on public.magazine_articles (category, published_at desc)
  where is_published;

create or replace function public._magazine_article_json(p public.magazine_articles)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'category', p.category,
    'title', p.title,
    'publisher', p.publisher,
    'author_name', p.author_name,
    'published_at', p.published_at,
    'summary', p.summary,
    'body', p.body,
    'key_points', to_jsonb(p.key_points),
    'brand_highlight', p.brand_highlight,
    'thumbnail_url', p.thumbnail_url,
    'thumbnail_path', p.thumbnail_path,
    'thumbnail_credit', p.thumbnail_credit,
    'external_url', p.external_url,
    'seo_title', p.seo_title,
    'seo_description', p.seo_description,
    'is_published', p.is_published,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  );
$$;

revoke all on function public._magazine_article_json(public.magazine_articles) from public, anon, authenticated;

create or replace function public.admin_save_magazine_article(p_id uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.manage');
  v_before public.magazine_articles%rowtype;
  v_row public.magazine_articles%rowtype;
  v_slug text := lower(btrim(coalesce(p_data->>'slug', '')));
  v_title text := btrim(coalesce(p_data->>'title', ''));
  v_publisher text := btrim(coalesce(p_data->>'publisher', ''));
  v_category text := coalesce(nullif(btrim(coalesce(p_data->>'category', '')), ''), 'press');
  v_body text := nullif(btrim(coalesce(p_data->>'body', '')), '');
  v_seo_title text := nullif(btrim(coalesce(p_data->>'seo_title', '')), '');
  v_seo_description text := nullif(btrim(coalesce(p_data->>'seo_description', '')), '');
  v_author text := nullif(btrim(coalesce(p_data->>'author_name', '')), '');
  v_published_at date;
  v_key_points text[];
begin
  if v_slug = '' or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception '주소(slug)는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.';
  end if;
  if v_title = '' then
    raise exception '기사 제목을 입력해주세요.';
  end if;
  if v_publisher = '' then
    raise exception '출처(언론사 또는 BRAND-ER)를 입력해주세요.';
  end if;
  if v_category not in ('brand_news', 'press', 'brand_story', 'creator_interview', 'insight') then
    raise exception '카테고리를 선택해주세요.';
  end if;
  if v_category = 'press' and nullif(btrim(coalesce(p_data->>'external_url', '')), '') is null then
    raise exception '언론 보도는 원문 기사 URL 을 입력해주세요.';
  end if;
  begin
    v_published_at := (p_data->>'published_at')::date;
  exception when others then
    raise exception '발행일 형식이 올바르지 않습니다.';
  end;
  if v_published_at is null then
    raise exception '발행일을 입력해주세요.';
  end if;
  if char_length(coalesce(v_body, '')) > 20000 then
    raise exception '본문은 20,000자까지 입력할 수 있습니다.';
  end if;
  if char_length(coalesce(v_seo_title, '')) > 120 then
    raise exception 'SEO 제목은 120자까지 입력할 수 있습니다.';
  end if;
  if char_length(coalesce(v_seo_description, '')) > 300 then
    raise exception 'SEO 설명은 300자까지 입력할 수 있습니다.';
  end if;

  select coalesce(array_agg(btrim(item)) filter (where btrim(item) <> ''), '{}')
    into v_key_points
  from jsonb_array_elements_text(coalesce(p_data->'key_points', '[]'::jsonb)) as item;

  if exists (select 1 from public.magazine_articles where slug = v_slug and id is distinct from p_id) then
    raise exception '이미 사용 중인 주소(slug)입니다: %', v_slug;
  end if;

  if p_id is null then
    insert into public.magazine_articles (
      slug, category, title, publisher, author_name, published_at, summary, body, key_points, brand_highlight,
      thumbnail_url, thumbnail_path, thumbnail_credit, external_url, seo_title, seo_description,
      is_published, created_by, updated_by
    ) values (
      v_slug, v_category, v_title, v_publisher, v_author, v_published_at,
      btrim(coalesce(p_data->>'summary', '')), v_body, v_key_points,
      nullif(btrim(coalesce(p_data->>'brand_highlight', '')), ''),
      nullif(btrim(coalesce(p_data->>'thumbnail_url', '')), ''),
      nullif(btrim(coalesce(p_data->>'thumbnail_path', '')), ''),
      nullif(btrim(coalesce(p_data->>'thumbnail_credit', '')), ''),
      nullif(btrim(coalesce(p_data->>'external_url', '')), ''),
      v_seo_title, v_seo_description,
      coalesce((p_data->>'is_published')::boolean, false),
      v_actor, v_actor
    )
    returning * into v_row;

    perform public._admin_log('magazine.create', 'magazine_article', v_row.id::text, v_row.title,
      null, public._magazine_article_json(v_row), null, '{}'::jsonb);
  else
    select * into v_before from public.magazine_articles where id = p_id for update;
    if not found then
      raise exception '기사를 찾을 수 없습니다.';
    end if;

    update public.magazine_articles set
      slug = v_slug,
      category = v_category,
      title = v_title,
      publisher = v_publisher,
      author_name = v_author,
      published_at = v_published_at,
      summary = btrim(coalesce(p_data->>'summary', '')),
      body = v_body,
      key_points = v_key_points,
      brand_highlight = nullif(btrim(coalesce(p_data->>'brand_highlight', '')), ''),
      thumbnail_url = nullif(btrim(coalesce(p_data->>'thumbnail_url', '')), ''),
      thumbnail_path = nullif(btrim(coalesce(p_data->>'thumbnail_path', '')), ''),
      thumbnail_credit = nullif(btrim(coalesce(p_data->>'thumbnail_credit', '')), ''),
      external_url = nullif(btrim(coalesce(p_data->>'external_url', '')), ''),
      seo_title = v_seo_title,
      seo_description = v_seo_description,
      is_published = coalesce((p_data->>'is_published')::boolean, v_before.is_published),
      updated_by = v_actor,
      updated_at = now()
    where id = p_id
    returning * into v_row;

    perform public._admin_log('magazine.update', 'magazine_article', v_row.id::text, v_row.title,
      public._magazine_article_json(v_before), public._magazine_article_json(v_row), null, '{}'::jsonb);
  end if;

  return public._magazine_article_json(v_row);
end;
$$;

revoke all on function public.admin_save_magazine_article(uuid, jsonb) from public, anon;
grant execute on function public.admin_save_magazine_article(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
