-- 코디(Outfit) 저장 및 공유 커뮤니티: Brand-er Closet에서 완성한 코디를 저장하고("내 코디"),
-- 원하면 공개해서 다른 사용자들과 공유할 수 있게 한다("코디 피드"). closet_activity와 동일한 패턴으로
-- 모든 읽기/쓰기는 아래 SECURITY DEFINER 함수를 통해서만 이뤄진다 — 다른 사용자가 작성자의 원본
-- 코디나 아이템 구성을 임의로 조회/수정/삭제할 수 없다.

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 조회 시 profiles를 매번 조인하지 않도록 저장 시점의 표시 이름을 스냅샷으로 남긴다.
  author_name text not null default 'BRAND-ER',
  character_gender text not null default 'male' check (character_gender in ('male', 'female')),
  title text not null,
  description text,
  image_url text not null,
  image_path text,
  is_public boolean not null default false,
  like_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outfits_public_created_at_idx
  on public.outfits (created_at desc) where is_public = true;
create index if not exists outfits_user_id_idx on public.outfits (user_id, created_at desc);

create table if not exists public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  slot text not null check (slot in ('top', 'bottom', 'outer', 'shoes', 'accessory')),
  garment_id text,
  label text,
  image_url text not null,
  source text,
  created_at timestamptz not null default now(),
  unique (outfit_id, slot)
);

create index if not exists outfit_items_outfit_id_idx on public.outfit_items (outfit_id);

create table if not exists public.outfit_tags (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (outfit_id, tag)
);

create index if not exists outfit_tags_outfit_id_idx on public.outfit_tags (outfit_id);
create index if not exists outfit_tags_tag_idx on public.outfit_tags (tag);

create table if not exists public.outfit_likes (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (outfit_id, user_id)
);

create index if not exists outfit_likes_outfit_id_idx on public.outfit_likes (outfit_id);
create index if not exists outfit_likes_user_id_idx on public.outfit_likes (user_id);

alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.outfit_tags enable row level security;
alter table public.outfit_likes enable row level security;

-- 모든 접근은 아래 SECURITY DEFINER 함수를 통해서만 이뤄진다 (closet_activity와 동일 패턴).
revoke all on table public.outfits from anon, authenticated;
revoke all on table public.outfit_items from anon, authenticated;
revoke all on table public.outfit_tags from anon, authenticated;
revoke all on table public.outfit_likes from anon, authenticated;

-- 코디 저장: 완성 이미지 + 아이템 구성(items) + 태그를 한 번에 기록한다.
create or replace function public.save_outfit(
  p_title text,
  p_description text,
  p_image_url text,
  p_image_path text,
  p_character_gender text,
  p_is_public boolean,
  p_items jsonb,
  p_tags jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_outfit_id uuid;
  v_author_name text;
  v_item jsonb;
  v_tag text;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception '코디 제목을 입력해주세요.';
  end if;
  if coalesce(trim(p_image_url), '') = '' then
    raise exception '코디 이미지가 없습니다.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '코디에 사용된 옷이 없습니다.';
  end if;

  select coalesce(nullif(trim(brand_name), ''), nullif(trim(username), ''), nullif(trim(full_name), ''))
    into v_author_name
    from public.profiles where id = v_user_id;
  v_author_name := coalesce(v_author_name, 'BRAND-ER');

  insert into public.outfits (
    user_id, author_name, character_gender, title, description, image_url, image_path, is_public
  ) values (
    v_user_id,
    v_author_name,
    case when p_character_gender in ('male', 'female') then p_character_gender else 'male' end,
    left(trim(p_title), 80),
    nullif(left(coalesce(p_description, ''), 300), ''),
    p_image_url,
    p_image_path,
    coalesce(p_is_public, false)
  ) returning id into v_outfit_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if v_item->>'slot' in ('top', 'bottom', 'outer', 'shoes', 'accessory') and coalesce(v_item->>'image_url', '') <> '' then
      insert into public.outfit_items (outfit_id, slot, garment_id, label, image_url, source)
      values (
        v_outfit_id,
        v_item->>'slot',
        nullif(v_item->>'garment_id', ''),
        nullif(left(coalesce(v_item->>'label', ''), 200), ''),
        v_item->>'image_url',
        nullif(v_item->>'source', '')
      )
      on conflict (outfit_id, slot) do update set
        garment_id = excluded.garment_id,
        label = excluded.label,
        image_url = excluded.image_url,
        source = excluded.source;
    end if;
  end loop;

  for v_tag in select distinct trim(both from lower(value)) from jsonb_array_elements_text(coalesce(p_tags, '[]'::jsonb)) as value
  loop
    if v_tag <> '' then
      insert into public.outfit_tags (outfit_id, tag) values (v_outfit_id, left(v_tag, 30))
      on conflict (outfit_id, tag) do nothing;
    end if;
  end loop;

  return v_outfit_id;
end;
$$;

-- 코디 수정: 제목/설명/공개여부/태그만 수정 가능 (아이템 구성과 이미지는 재저장으로만 바꾼다).
create or replace function public.update_outfit(
  p_outfit_id uuid,
  p_title text,
  p_description text,
  p_is_public boolean,
  p_tags jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
  v_tag text;
begin
  select user_id into v_owner from public.outfits where id = p_outfit_id;
  if v_owner is null then
    raise exception '코디를 찾을 수 없습니다.';
  end if;
  if v_owner <> v_user_id then
    raise exception '본인의 코디만 수정할 수 있습니다.';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception '코디 제목을 입력해주세요.';
  end if;

  update public.outfits set
    title = left(trim(p_title), 80),
    description = nullif(left(coalesce(p_description, ''), 300), ''),
    is_public = coalesce(p_is_public, is_public),
    updated_at = now()
  where id = p_outfit_id;

  if p_tags is not null then
    delete from public.outfit_tags where outfit_id = p_outfit_id;
    for v_tag in select distinct trim(both from lower(value)) from jsonb_array_elements_text(p_tags) as value
    loop
      if v_tag <> '' then
        insert into public.outfit_tags (outfit_id, tag) values (p_outfit_id, left(v_tag, 30))
        on conflict (outfit_id, tag) do nothing;
      end if;
    end loop;
  end if;
end;
$$;

-- 코디 삭제: 작성자 본인만 가능. items/tags/likes는 FK cascade로 함께 삭제된다.
create or replace function public.delete_outfit(p_outfit_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner uuid;
begin
  select user_id into v_owner from public.outfits where id = p_outfit_id;
  if v_owner is null then
    return;
  end if;
  if v_owner <> v_user_id then
    raise exception '본인의 코디만 삭제할 수 있습니다.';
  end if;
  delete from public.outfits where id = p_outfit_id;
end;
$$;

-- 좋아요 토글: 같은 계정이 동일 게시물에 중복으로 좋아요를 남기지 못하도록 unique 제약 + 토글 처리.
create or replace function public.toggle_outfit_like(p_outfit_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_public boolean;
  v_already_liked boolean;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select is_public into v_is_public from public.outfits where id = p_outfit_id;
  if v_is_public is null then
    raise exception '코디를 찾을 수 없습니다.';
  end if;
  if not v_is_public then
    raise exception '공개된 코디만 좋아요할 수 있습니다.';
  end if;

  select exists(
    select 1 from public.outfit_likes where outfit_id = p_outfit_id and user_id = v_user_id
  ) into v_already_liked;

  if v_already_liked then
    delete from public.outfit_likes where outfit_id = p_outfit_id and user_id = v_user_id;
    update public.outfits set like_count = greatest(like_count - 1, 0) where id = p_outfit_id;
    return false;
  else
    insert into public.outfit_likes (outfit_id, user_id) values (p_outfit_id, v_user_id);
    update public.outfits set like_count = like_count + 1 where id = p_outfit_id;
    return true;
  end if;
end;
$$;

-- 코디 피드 (공개 코디만, Pinterest 스타일 목록 카드에 필요한 최소 정보만 반환).
create or replace function public.list_public_outfits(
  p_limit integer default 24,
  p_before timestamptz default null,
  p_tag text default null
)
returns table (
  id uuid,
  title text,
  image_url text,
  author_name text,
  like_count integer,
  liked_by_me boolean,
  created_at timestamptz,
  character_gender text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  return query
  select
    o.id, o.title, o.image_url, o.author_name, o.like_count,
    (v_user_id is not null and exists(
      select 1 from public.outfit_likes l where l.outfit_id = o.id and l.user_id = v_user_id
    )) as liked_by_me,
    o.created_at, o.character_gender
  from public.outfits o
  where o.is_public = true
    and (p_before is null or o.created_at < p_before)
    and (p_tag is null or exists(select 1 from public.outfit_tags t where t.outfit_id = o.id and t.tag = lower(p_tag)))
  order by o.created_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60);
end;
$$;

-- 코디 상세 (본인이거나 공개된 경우만 조회 가능. 사용된 아이템/태그를 함께 반환).
create or replace function public.get_outfit_detail(p_outfit_id uuid)
returns table (
  id uuid,
  user_id uuid,
  title text,
  description text,
  image_url text,
  author_name text,
  character_gender text,
  is_public boolean,
  like_count integer,
  liked_by_me boolean,
  is_owner boolean,
  created_at timestamptz,
  items jsonb,
  tags jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  return query
  select
    o.id, o.user_id, o.title, o.description, o.image_url, o.author_name, o.character_gender,
    o.is_public, o.like_count,
    (v_user_id is not null and exists(
      select 1 from public.outfit_likes l where l.outfit_id = o.id and l.user_id = v_user_id
    )) as liked_by_me,
    (v_user_id is not null and v_user_id = o.user_id) as is_owner,
    o.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'slot', i.slot, 'garmentId', i.garment_id, 'label', i.label,
        'imageUrl', i.image_url, 'source', i.source
      ) order by i.slot)
      from public.outfit_items i where i.outfit_id = o.id
    ), '[]'::jsonb) as items,
    coalesce((
      select jsonb_agg(t.tag order by t.tag) from public.outfit_tags t where t.outfit_id = o.id
    ), '[]'::jsonb) as tags
  from public.outfits o
  where o.id = p_outfit_id
    and (o.is_public = true or o.user_id = v_user_id or public.is_admin(v_user_id));
end;
$$;

-- 내 코디 목록 ("마이페이지 > 내 코디"): 공개/비공개 모두 포함, 본인 것만.
create or replace function public.list_my_outfits()
returns table (
  id uuid,
  title text,
  description text,
  image_url text,
  is_public boolean,
  like_count integer,
  created_at timestamptz,
  character_gender text,
  tags jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return query
  select
    o.id, o.title, o.description, o.image_url, o.is_public, o.like_count, o.created_at, o.character_gender,
    coalesce((
      select jsonb_agg(t.tag order by t.tag) from public.outfit_tags t where t.outfit_id = o.id
    ), '[]'::jsonb) as tags
  from public.outfits o
  where o.user_id = v_user_id
  order by o.created_at desc;
end;
$$;

revoke all on function public.save_outfit(text, text, text, text, text, boolean, jsonb, jsonb) from public;
revoke all on function public.update_outfit(uuid, text, text, boolean, jsonb) from public;
revoke all on function public.delete_outfit(uuid) from public;
revoke all on function public.toggle_outfit_like(uuid) from public;
revoke all on function public.list_public_outfits(integer, timestamptz, text) from public;
revoke all on function public.get_outfit_detail(uuid) from public;
revoke all on function public.list_my_outfits() from public;

grant execute on function public.save_outfit(text, text, text, text, text, boolean, jsonb, jsonb) to authenticated;
grant execute on function public.update_outfit(uuid, text, text, boolean, jsonb) to authenticated;
grant execute on function public.delete_outfit(uuid) to authenticated;
grant execute on function public.toggle_outfit_like(uuid) to authenticated;
grant execute on function public.list_public_outfits(integer, timestamptz, text) to anon, authenticated;
grant execute on function public.get_outfit_detail(uuid) to anon, authenticated;
grant execute on function public.list_my_outfits() to authenticated;

comment on table public.outfits is
  '완성된 브랜더 코디 — 마이페이지 "내 코디"와 공개 코디 피드("코디" 페이지)의 원본 데이터. 모든 접근은 SECURITY DEFINER 함수를 통해서만 이뤄진다.';
comment on table public.outfit_items is
  '코디를 구성하는 슬롯별 아이템(상의/하의/아우터/신발/액세서리) 스냅샷.';
comment on table public.outfit_tags is
  '코디 업로드 시 입력한 해시태그.';
comment on table public.outfit_likes is
  '코디 좋아요 — 계정당 코디 1개에 최대 1개(unique) 로 토글 방식.';
