-- 디자인 완료 이후 전체 플로우(자동견적 / 캐릭터 착용 / 코디)가 끊기지 않도록, 하나의 AI 디자인을
-- `design_id`로 식별되는 서버 저장 레코드로 만든다. 지금까지는 생성 결과가 각 페이지의 React state
-- (location.state 포함)에만 존재해 새로고침하거나 페이지를 이동하면 사라졌다 — 이 테이블이 그 단일
-- 진실 공급원이 된다. 비회원도 디자인·코디를 만들 수 있어야 하므로 `guest_session_id`(브라우저에
-- 저장하는 임의 uuid)로도 소유권을 추적하고, 로그인 시 `claim_guest_session`으로 계정에 이전한다.

create table if not exists public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_session_id text,
  front_image_url text not null,
  back_image_url text,
  image_path text,
  product_type text,
  color text,
  fabric text,
  fit text,
  quantity integer not null default 1,
  has_print boolean not null default false,
  has_embroidery boolean not null default false,
  accessories jsonb not null default '[]'::jsonb,
  production_country text not null default 'korea',
  prompt text,
  detail text,
  -- Where this design originated — lets the client route "수정하기"/"입혀보기" consistently.
  source text not null default 'customize',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint designs_owner_present check (user_id is not null or guest_session_id is not null)
);

create index if not exists designs_user_id_idx on public.designs (user_id, created_at desc);
create index if not exists designs_guest_session_id_idx on public.designs (guest_session_id);

alter table public.designs enable row level security;
revoke all on table public.designs from anon, authenticated;

-- 디자인 생성/수정: design_id가 없으면 새로 만들고, 있으면 소유자(로그인 사용자 또는 같은
-- guest_session_id)만 갱신할 수 있다. front_image_url이 있어야 "자동견적 확인하기"가 가능해진다.
create or replace function public.save_design(
  p_front_image_url text,
  p_design_id uuid default null,
  p_guest_session_id text default null,
  p_back_image_url text default null,
  p_product_type text default null,
  p_color text default null,
  p_fabric text default null,
  p_fit text default null,
  p_quantity integer default null,
  p_has_print boolean default null,
  p_has_embroidery boolean default null,
  p_accessories jsonb default null,
  p_production_country text default null,
  p_prompt text default null,
  p_detail text default null,
  p_image_path text default null,
  p_source text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_owner_guest_id text;
  v_design_id uuid;
begin
  if coalesce(trim(p_front_image_url), '') = '' then
    raise exception '디자인 이미지가 없습니다.';
  end if;
  if v_user_id is null and coalesce(trim(p_guest_session_id), '') = '' then
    raise exception '게스트 세션 정보가 없습니다.';
  end if;

  if p_design_id is not null then
    select user_id, guest_session_id into v_owner_user_id, v_owner_guest_id
      from public.designs where id = p_design_id;
    if not found then
      raise exception '디자인을 찾을 수 없습니다.';
    end if;
    if not (
      (v_user_id is not null and v_owner_user_id = v_user_id)
      or (v_user_id is null and v_owner_guest_id is not null and v_owner_guest_id = p_guest_session_id)
    ) then
      raise exception '이 디자인을 수정할 권한이 없습니다.';
    end if;

    update public.designs set
      front_image_url = p_front_image_url,
      back_image_url = coalesce(p_back_image_url, back_image_url),
      product_type = coalesce(p_product_type, product_type),
      color = coalesce(p_color, color),
      fabric = coalesce(p_fabric, fabric),
      fit = coalesce(p_fit, fit),
      quantity = coalesce(p_quantity, quantity),
      has_print = coalesce(p_has_print, has_print),
      has_embroidery = coalesce(p_has_embroidery, has_embroidery),
      accessories = coalesce(p_accessories, accessories),
      production_country = coalesce(p_production_country, production_country),
      prompt = coalesce(p_prompt, prompt),
      detail = coalesce(p_detail, detail),
      image_path = coalesce(p_image_path, image_path),
      -- Claim an orphaned guest design the moment its owner is signed in.
      user_id = coalesce(v_user_id, user_id),
      guest_session_id = case when v_user_id is not null then null else guest_session_id end,
      updated_at = now()
    where id = p_design_id;

    return p_design_id;
  end if;

  insert into public.designs (
    user_id, guest_session_id, front_image_url, back_image_url, image_path,
    product_type, color, fabric, fit, quantity, has_print, has_embroidery,
    accessories, production_country, prompt, detail, source
  ) values (
    v_user_id,
    case when v_user_id is null then p_guest_session_id else null end,
    p_front_image_url, p_back_image_url, p_image_path,
    p_product_type, p_color, p_fabric, p_fit, greatest(coalesce(p_quantity, 1), 1),
    coalesce(p_has_print, false), coalesce(p_has_embroidery, false),
    coalesce(p_accessories, '[]'::jsonb), coalesce(nullif(p_production_country, ''), 'korea'),
    p_prompt, p_detail, coalesce(nullif(p_source, ''), 'customize')
  ) returning id into v_design_id;

  return v_design_id;
end;
$$;

-- 디자인 조회: design_id(추측 불가능한 uuid)를 아는 사람이면 누구나 조회 가능 — 링크/쿼리스트링으로
-- 자동견적 페이지를 새로고침해도 그대로 이어지게 하기 위함. 수정/삭제는 위 save_design의 소유권
-- 검사를 통해서만 가능하다.
create or replace function public.get_design(p_design_id uuid)
returns table (
  id uuid,
  user_id uuid,
  front_image_url text,
  back_image_url text,
  image_path text,
  product_type text,
  color text,
  fabric text,
  fit text,
  quantity integer,
  has_print boolean,
  has_embroidery boolean,
  accessories jsonb,
  production_country text,
  prompt text,
  detail text,
  source text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    d.id, d.user_id, d.front_image_url, d.back_image_url, d.image_path,
    d.product_type, d.color, d.fabric, d.fit, d.quantity, d.has_print, d.has_embroidery,
    d.accessories, d.production_country, d.prompt, d.detail, d.source, d.created_at, d.updated_at
  from public.designs d
  where d.id = p_design_id;
end;
$$;

revoke all on function public.save_design(
  text, uuid, text, text, text, text, text, text, integer, boolean, boolean, jsonb, text, text, text, text, text
) from public;
revoke all on function public.get_design(uuid) from public;
grant execute on function public.save_design(
  text, uuid, text, text, text, text, text, text, integer, boolean, boolean, jsonb, text, text, text, text, text
) to anon, authenticated;
grant execute on function public.get_design(uuid) to anon, authenticated;

comment on table public.designs is
  '디자인 생성 → 수정 → 캐릭터 착용 → 자동견적 → 코디 전체 플로우가 공유하는 단일 디자인 레코드. 회원은 user_id, 비회원은 guest_session_id로 소유권을 추적한다.';

-- --- 비회원(guest) 코디 저장 지원: outfits는 20260825010000에서 로그인 사용자 전용으로 만들었지만,
-- 브랜더 체험(디자인/견적/코디)은 비회원도 가능해야 한다는 요구사항에 맞춰 guest_session_id를 허용한다.
-- 단, "코디 올리기"(공개)는 여전히 로그인을 요구한다 — 다른 사람에게 공개되는 콘텐츠의 작성자를
-- 익명으로 남겨둘 수 없기 때문이다.

alter table public.outfits add column if not exists guest_session_id text;
alter table public.outfits drop constraint if exists outfits_owner_present;
alter table public.outfits add constraint outfits_owner_present
  check (user_id is not null or guest_session_id is not null);
-- user_id was NOT NULL originally (logged-in-only) — relax it so a guest row can omit it.
alter table public.outfits alter column user_id drop not null;

create index if not exists outfits_guest_session_id_idx on public.outfits (guest_session_id);

drop function if exists public.save_outfit(text, text, text, text, text, boolean, jsonb, jsonb);
create function public.save_outfit(
  p_title text,
  p_description text,
  p_image_url text,
  p_image_path text,
  p_character_gender text,
  p_is_public boolean,
  p_items jsonb,
  p_tags jsonb default '[]'::jsonb,
  p_guest_session_id text default null
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
  if v_user_id is null and coalesce(trim(p_guest_session_id), '') = '' then
    raise exception '로그인이 필요합니다.';
  end if;
  if coalesce(p_is_public, false) and v_user_id is null then
    raise exception '공개 코디는 로그인 후 올릴 수 있습니다.';
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

  if v_user_id is not null then
    select coalesce(nullif(trim(brand_name), ''), nullif(trim(username), ''), nullif(trim(full_name), ''))
      into v_author_name
      from public.profiles where id = v_user_id;
  end if;
  v_author_name := coalesce(v_author_name, 'BRAND-ER');

  insert into public.outfits (
    user_id, guest_session_id, author_name, character_gender, title, description, image_url, image_path, is_public
  ) values (
    v_user_id,
    case when v_user_id is null then p_guest_session_id else null end,
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
      insert into public.outfit_items (outfit_id, slot, garment_id, label, image_url, source, design_id)
      values (
        v_outfit_id,
        v_item->>'slot',
        nullif(v_item->>'garment_id', ''),
        nullif(left(coalesce(v_item->>'label', ''), 200), ''),
        v_item->>'image_url',
        nullif(v_item->>'source', ''),
        nullif(v_item->>'design_id', '')::uuid
      )
      on conflict (outfit_id, slot) do update set
        garment_id = excluded.garment_id,
        label = excluded.label,
        image_url = excluded.image_url,
        source = excluded.source,
        design_id = excluded.design_id;
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

drop function if exists public.update_outfit(uuid, text, text, boolean, jsonb);
create function public.update_outfit(
  p_outfit_id uuid,
  p_title text,
  p_description text,
  p_is_public boolean,
  p_tags jsonb default null,
  p_guest_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_owner_guest_id text;
  v_tag text;
begin
  select user_id, guest_session_id into v_owner_user_id, v_owner_guest_id
    from public.outfits where id = p_outfit_id;
  if not found then
    raise exception '코디를 찾을 수 없습니다.';
  end if;
  if not (
    (v_user_id is not null and v_owner_user_id = v_user_id)
    or (v_user_id is null and v_owner_guest_id is not null and v_owner_guest_id = p_guest_session_id)
  ) then
    raise exception '본인의 코디만 수정할 수 있습니다.';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception '코디 제목을 입력해주세요.';
  end if;
  if coalesce(p_is_public, false) and v_user_id is null then
    raise exception '공개 코디는 로그인 후 올릴 수 있습니다.';
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

drop function if exists public.delete_outfit(uuid);
create function public.delete_outfit(p_outfit_id uuid, p_guest_session_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_owner_user_id uuid;
  v_owner_guest_id text;
begin
  select user_id, guest_session_id into v_owner_user_id, v_owner_guest_id
    from public.outfits where id = p_outfit_id;
  if not found then
    return;
  end if;
  if not (
    (v_user_id is not null and v_owner_user_id = v_user_id)
    or (v_user_id is null and v_owner_guest_id is not null and v_owner_guest_id = p_guest_session_id)
  ) then
    raise exception '본인의 코디만 삭제할 수 있습니다.';
  end if;
  delete from public.outfits where id = p_outfit_id;
end;
$$;

revoke all on function public.save_outfit(text, text, text, text, text, boolean, jsonb, jsonb, text) from public;
revoke all on function public.update_outfit(uuid, text, text, boolean, jsonb, text) from public;
revoke all on function public.delete_outfit(uuid, text) from public;
grant execute on function public.save_outfit(text, text, text, text, text, boolean, jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.update_outfit(uuid, text, text, boolean, jsonb, text) to anon, authenticated;
grant execute on function public.delete_outfit(uuid, text) to anon, authenticated;

-- outfit_items에 design_id를 남겨 "이 코디에 어떤 디자인이 쓰였는지"를 디자인 레코드와 직접 연결한다.
alter table public.outfit_items add column if not exists design_id uuid references public.designs(id) on delete set null;

-- get_outfit_detail / list_my_outfits의 items 반환에 design_id 포함하도록 재정의 (열 목록만 변경, 함수
-- 시그니처는 동일하므로 OR REPLACE로 충분하다).
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
        'imageUrl', i.image_url, 'source', i.source, 'designId', i.design_id
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

-- 로그인 시 게스트 세션(guest_session_id)으로 만든 디자인/코디를 현재 계정으로 이전한다. 사용자
-- 작업물이 로그인 때문에 사라지면 안 된다는 요구사항을 만족시키는 핵심 함수.
create or replace function public.claim_guest_session(p_guest_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_designs_claimed integer := 0;
  v_outfits_claimed integer := 0;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if coalesce(trim(p_guest_session_id), '') = '' then
    return jsonb_build_object('designs', 0, 'outfits', 0);
  end if;

  update public.designs set user_id = v_user_id, guest_session_id = null, updated_at = now()
    where guest_session_id = p_guest_session_id and user_id is null;
  get diagnostics v_designs_claimed = row_count;

  update public.outfits set user_id = v_user_id, guest_session_id = null, updated_at = now()
    where guest_session_id = p_guest_session_id and user_id is null;
  get diagnostics v_outfits_claimed = row_count;

  return jsonb_build_object('designs', v_designs_claimed, 'outfits', v_outfits_claimed);
end;
$$;

revoke all on function public.claim_guest_session(text) from public;
grant execute on function public.claim_guest_session(text) to authenticated;
