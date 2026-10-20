-- BRAND-ER 매거진(언론보도 · 브랜드 뉴스) 기사 테이블 · 관리자 RPC · 썸네일 버킷
--
-- - 공개 사이트는 is_published = true 인 기사만 조회할 수 있다(RLS).
-- - 등록 · 수정 · 삭제 · 공개 전환은 admin_* RPC 로만 가능하며 content.manage 권한을 서버에서 다시 검증하고
--   모든 변경을 Audit Log 에 남긴다. 테이블에 대한 직접 쓰기 권한은 anon/authenticated 에 주지 않는다.
-- - 기존 프런트엔드 정적 목록(src/data/magazine-articles.json)의 기사 4건을 같은 slug 로 시드한다.
--   이미 있는 slug 는 건드리지 않으므로 여러 번 실행해도 안전하다.

-- ---------------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.magazine_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  category text not null default 'press' check (category in ('press', 'brand_news')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  publisher text not null check (char_length(btrim(publisher)) between 1 and 80),
  published_at date not null,
  -- 카드와 상세페이지 상단에 쓰는 1~2문장 요약(BRAND-ER 가 직접 작성, 원문 복제 금지)
  summary text not null default '' check (char_length(summary) <= 600),
  -- 상세페이지 "주요 내용" 항목(자체 요약)
  key_points text[] not null default '{}' check (cardinality(key_points) <= 12),
  -- 상세페이지 "BRAND-ER 관련 핵심 내용" 강조 블록
  brand_highlight text check (brand_highlight is null or char_length(brand_highlight) <= 1000),
  -- 대표 이미지: 외부 URL 또는 magazine 버킷에 자체 호스팅한 파일 경로
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~* '^https?://'),
  thumbnail_path text,
  thumbnail_credit text check (thumbnail_credit is null or char_length(thumbnail_credit) <= 200),
  external_url text check (external_url is null or external_url ~* '^https?://'),
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists magazine_articles_published_idx
  on public.magazine_articles (published_at desc, created_at desc)
  where is_published;

alter table public.magazine_articles enable row level security;

revoke all on public.magazine_articles from anon, authenticated;
grant select on public.magazine_articles to anon, authenticated;

drop policy if exists "Published magazine articles are public" on public.magazine_articles;
create policy "Published magazine articles are public"
  on public.magazine_articles for select
  to anon, authenticated
  using (is_published);

-- ---------------------------------------------------------------------------
-- 2. 썸네일 버킷 (공개 읽기, content.manage 관리자만 업로드/삭제)
-- ---------------------------------------------------------------------------

create or replace function public.can_manage_magazine()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public._admin_has_permission(auth.uid(), 'content.manage');
$$;

revoke all on function public.can_manage_magazine() from public, anon;
grant execute on function public.can_manage_magazine() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('magazine', 'magazine', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "Magazine admins can upload images" on storage.objects;
create policy "Magazine admins can upload images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'magazine' and public.can_manage_magazine());

drop policy if exists "Magazine admins can update images" on storage.objects;
create policy "Magazine admins can update images"
  on storage.objects for update to authenticated
  using (bucket_id = 'magazine' and public.can_manage_magazine())
  with check (bucket_id = 'magazine' and public.can_manage_magazine());

drop policy if exists "Magazine admins can delete images" on storage.objects;
create policy "Magazine admins can delete images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'magazine' and public.can_manage_magazine());

-- ---------------------------------------------------------------------------
-- 3. 관리자 RPC
-- ---------------------------------------------------------------------------

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
    'published_at', p.published_at,
    'summary', p.summary,
    'key_points', to_jsonb(p.key_points),
    'brand_highlight', p.brand_highlight,
    'thumbnail_url', p.thumbnail_url,
    'thumbnail_path', p.thumbnail_path,
    'thumbnail_credit', p.thumbnail_credit,
    'external_url', p.external_url,
    'is_published', p.is_published,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  );
$$;

revoke all on function public._magazine_article_json(public.magazine_articles) from public, anon, authenticated;

-- 목록: 최신 발행일 순(같은 날짜는 최근 등록 순)
create or replace function public.admin_list_magazine_articles(
  p_status text default 'all',
  p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.view');
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  return (
    with base as (
      select * from public.magazine_articles a
      where v_search is null
         or a.title ilike '%' || v_search || '%'
         or a.publisher ilike '%' || v_search || '%'
         or a.slug ilike '%' || v_search || '%'
    ),
    filtered as (
      select * from base
      where coalesce(p_status, 'all') = 'all'
         or (p_status = 'published' and is_published)
         or (p_status = 'draft' and not is_published)
    )
    select jsonb_build_object(
      'counts', jsonb_build_object(
        'all', (select count(*) from base),
        'published', (select count(*) from base where is_published),
        'draft', (select count(*) from base where not is_published)
      ),
      'can_manage', public._admin_has_permission(v_actor, 'content.manage'),
      'rows', coalesce((
        select jsonb_agg(public._magazine_article_json(f) order by f.published_at desc, f.created_at desc)
        from filtered f
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.admin_list_magazine_articles(text, text) from public, anon;
grant execute on function public.admin_list_magazine_articles(text, text) to authenticated;

-- 등록(p_id null) 또는 수정. 저장된 기사 JSON 을 반환한다.
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
    raise exception '언론사 이름을 입력해주세요.';
  end if;
  begin
    v_published_at := (p_data->>'published_at')::date;
  exception when others then
    raise exception '발행일 형식이 올바르지 않습니다.';
  end;
  if v_published_at is null then
    raise exception '발행일을 입력해주세요.';
  end if;

  select coalesce(array_agg(btrim(item)) filter (where btrim(item) <> ''), '{}')
    into v_key_points
  from jsonb_array_elements_text(coalesce(p_data->'key_points', '[]'::jsonb)) as item;

  if exists (select 1 from public.magazine_articles where slug = v_slug and id is distinct from p_id) then
    raise exception '이미 사용 중인 주소(slug)입니다: %', v_slug;
  end if;

  if p_id is null then
    insert into public.magazine_articles (
      slug, category, title, publisher, published_at, summary, key_points, brand_highlight,
      thumbnail_url, thumbnail_path, thumbnail_credit, external_url, is_published, created_by, updated_by
    ) values (
      v_slug, v_category, v_title, v_publisher, v_published_at,
      btrim(coalesce(p_data->>'summary', '')), v_key_points,
      nullif(btrim(coalesce(p_data->>'brand_highlight', '')), ''),
      nullif(btrim(coalesce(p_data->>'thumbnail_url', '')), ''),
      nullif(btrim(coalesce(p_data->>'thumbnail_path', '')), ''),
      nullif(btrim(coalesce(p_data->>'thumbnail_credit', '')), ''),
      nullif(btrim(coalesce(p_data->>'external_url', '')), ''),
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
      published_at = v_published_at,
      summary = btrim(coalesce(p_data->>'summary', '')),
      key_points = v_key_points,
      brand_highlight = nullif(btrim(coalesce(p_data->>'brand_highlight', '')), ''),
      thumbnail_url = nullif(btrim(coalesce(p_data->>'thumbnail_url', '')), ''),
      thumbnail_path = nullif(btrim(coalesce(p_data->>'thumbnail_path', '')), ''),
      thumbnail_credit = nullif(btrim(coalesce(p_data->>'thumbnail_credit', '')), ''),
      external_url = nullif(btrim(coalesce(p_data->>'external_url', '')), ''),
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

create or replace function public.admin_set_magazine_article_published(p_id uuid, p_published boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.manage');
  v_row public.magazine_articles%rowtype;
begin
  select * into v_row from public.magazine_articles where id = p_id for update;
  if not found then
    raise exception '기사를 찾을 수 없습니다.';
  end if;

  update public.magazine_articles
     set is_published = coalesce(p_published, false), updated_by = v_actor, updated_at = now()
   where id = p_id;

  perform public._admin_log(
    case when p_published then 'magazine.publish' else 'magazine.unpublish' end,
    'magazine_article', v_row.id::text, v_row.title,
    jsonb_build_object('is_published', v_row.is_published), jsonb_build_object('is_published', coalesce(p_published, false)),
    null, '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_set_magazine_article_published(uuid, boolean) from public, anon;
grant execute on function public.admin_set_magazine_article_published(uuid, boolean) to authenticated;

-- 삭제. 삭제 전 데이터는 Audit Log 에 남는다. 자체 호스팅 썸네일 경로를 돌려주어 화면에서 파일도 정리한다.
create or replace function public.admin_delete_magazine_article(p_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public._admin_require('content.manage');
  v_row public.magazine_articles%rowtype;
begin
  select * into v_row from public.magazine_articles where id = p_id for update;
  if not found then
    raise exception '기사를 찾을 수 없습니다.';
  end if;

  delete from public.magazine_articles where id = p_id;

  perform public._admin_log('magazine.delete', 'magazine_article', v_row.id::text, v_row.title,
    public._magazine_article_json(v_row), null, p_reason, '{}'::jsonb);

  return jsonb_build_object('thumbnail_path', v_row.thumbnail_path);
end;
$$;

revoke all on function public.admin_delete_magazine_article(uuid, text) from public, anon;
grant execute on function public.admin_delete_magazine_article(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 기존 매거진 기사 시드 (src/data/magazine-articles.json 과 동일)
-- ---------------------------------------------------------------------------

insert into public.magazine_articles (slug, category, title, publisher, published_at, summary, thumbnail_url, external_url, is_published)
values
  ('2026-08-02-newsfinder-ai-design-quote-trademark', 'press',
   '브랜더(BRAND-ER), AI 기반 의류 디자인·자동견적·상표분석으로 패션 창업 혁신', '뉴스파인더', '2026-08-02',
   '디자인 생성부터 제작 견적과 상표 분석까지 한곳에서 제공하는 BRAND-ER의 서비스를 소개하며, AI 자동견적 시스템의 특허 출원을 준비 중인 소식을 전합니다.',
   'https://cdn.newsfinder.co.kr/news/thumbnail/202608/221368_226384_5731_v150.jpg',
   'http://www.newsfinder.co.kr/news/articleView.html?idxno=221368', true),
  ('2026-06-30-gokorea-fashion-school-partnership', 'press',
   'AI 의류 프로모션 기업 브랜더, 라사라·루아트 패션학교와 협력 확대', '공감신문', '2026-06-30',
   '패션 교육기관과의 협력을 통해 학생들의 졸업작품 제작과 브랜드 론칭을 지원하고, 신진 디자이너의 생산 진입장벽을 낮추는 BRAND-ER의 행보를 소개합니다.',
   'https://cdn.gokorea.kr/news/thumbnail/202606/870763_147910_389_v150.jpg',
   'https://www.gokorea.kr/news/articleView.html?idxno=870763', true),
  ('2026-06-06-newsfinder-founder-story', 'press',
   '“18세부터 시작된 창업 도전”… BRAND-ER 김하성 대표, AI로 패션 산업의 문턱을 낮추다', '뉴스파인더', '2026-06-06',
   '구매대행과 의류 쇼핑몰 운영 경험에서 발견한 제작 현장의 문제를 AI 기반 의류 프로모션 플랫폼으로 해결해 온 김하성 대표의 창업 이야기입니다.',
   'https://cdn.newsfinder.co.kr/news/thumbnail/202606/220437_225168_1236_v150.jpg',
   'http://www.newsfinder.co.kr/news/articleView.html?idxno=220437', true),
  ('2025-02-06-thevaluenews-dexplore-award', 'press',
   '디큐베이터, ‘DeXplore 글로벌 청년 창업 아이디어 경진대회’ 성료…우수팀 사업화 지원', '더밸류뉴스', '2025-02-06',
   '대학생 창업팀 11개 팀이 참여한 글로벌 청년 창업 아이디어 경진대회의 수상 결과와 후속 사업화 지원 계획을 다룬 기사로, BRAND-ER가 수상팀으로 소개됐습니다.',
   'https://www.thevaluenews.co.kr/data/cheditor4/2502/bbed3bf147bcaac8670b45d4acc6ad4716634ce2.png',
   'https://www.thevaluenews.co.kr/news/view.php?idx=188400', true)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
