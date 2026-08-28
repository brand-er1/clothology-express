-- AI Virtual Fitting: 캐릭터 옷 입히기를 성별·체형사이즈 기반 가상 마네킹 피팅으로 전면 개편하면서
-- 필요해진 서버 저장 필드. 기존 outfits/outfit_items(코디 저장·피드·마이페이지) 테이블을 그대로 재사용해
-- 확장한다 — 이미 guest_session_id 기반 비회원 저장과 claim_guest_session 이전 로직을 갖추고 있어
-- 새 테이블을 따로 만들 필요가 없다. 여기에 성별/마네킹 체형사이즈/의류 기준사이즈/핏 유형/실측값/
-- 원단정보를 추가한다.

alter table public.outfits add column if not exists mannequin_size text;

-- 코디 슬롯 시스템에 스커트/원피스 슬롯 추가 (기존: top/bottom/outer/shoes/accessory).
alter table public.outfit_items drop constraint if exists outfit_items_slot_check;
alter table public.outfit_items add constraint outfit_items_slot_check
  check (slot in ('top', 'bottom', 'outer', 'skirt', 'dress', 'shoes', 'accessory'));

alter table public.outfit_items add column if not exists base_size text;
alter table public.outfit_items add column if not exists fit_type text
  check (fit_type is null or fit_type in ('oversize', 'semi_oversize', 'regular', 'slim'));
alter table public.outfit_items add column if not exists measurements jsonb;
alter table public.outfit_items add column if not exists fabric jsonb;
alter table public.outfit_items add column if not exists has_measurements boolean not null default false;
alter table public.outfit_items add column if not exists back_image_url text;

comment on column public.outfits.mannequin_size is
  '저장 시점의 마네킹 체형 사이즈 (여성: 44/55/66/77, 남성: l/xl/2xl).';
comment on column public.outfit_items.fit_type is
  '의류 기준 핏 (오버핏/세미오버핏/레귤러핏/슬림핏). 실측값이 없을 때 시각적 피팅의 기준이 된다.';
comment on column public.outfit_items.has_measurements is
  'true면 measurements가 실제 입력된 실측값 — AI 시뮬레이션 안내 문구 없이 표시 가능.';

-- 코디 저장: 성별(mannequin_size)과 슬롯별 핏 정보(base_size/fit_type/measurements/fabric/back_image_url)를
-- 함께 저장하도록 재정의. 기존 호출부(SaveOutfitDialog)는 새 필드를 생략해도 그대로 동작한다(모두 옵션).
drop function if exists public.save_outfit(text, text, text, text, text, boolean, jsonb, jsonb, text);
create function public.save_outfit(
  p_title text,
  p_description text,
  p_image_url text,
  p_image_path text,
  p_character_gender text,
  p_is_public boolean,
  p_items jsonb,
  p_tags jsonb default '[]'::jsonb,
  p_guest_session_id text default null,
  p_mannequin_size text default null
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
    user_id, guest_session_id, author_name, character_gender, mannequin_size,
    title, description, image_url, image_path, is_public
  ) values (
    v_user_id,
    case when v_user_id is null then p_guest_session_id else null end,
    v_author_name,
    case when p_character_gender in ('male', 'female') then p_character_gender else 'male' end,
    nullif(p_mannequin_size, ''),
    left(trim(p_title), 80),
    nullif(left(coalesce(p_description, ''), 300), ''),
    p_image_url,
    p_image_path,
    coalesce(p_is_public, false)
  ) returning id into v_outfit_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if v_item->>'slot' in ('top', 'bottom', 'outer', 'skirt', 'dress', 'shoes', 'accessory')
      and coalesce(v_item->>'image_url', '') <> '' then
      insert into public.outfit_items (
        outfit_id, slot, garment_id, label, image_url, source, design_id,
        base_size, fit_type, measurements, fabric, has_measurements, back_image_url
      )
      values (
        v_outfit_id,
        v_item->>'slot',
        nullif(v_item->>'garment_id', ''),
        nullif(left(coalesce(v_item->>'label', ''), 200), ''),
        v_item->>'image_url',
        nullif(v_item->>'source', ''),
        nullif(v_item->>'design_id', '')::uuid,
        nullif(v_item->>'base_size', ''),
        case when v_item->>'fit_type' in ('oversize', 'semi_oversize', 'regular', 'slim') then v_item->>'fit_type' else null end,
        v_item->'measurements',
        v_item->'fabric',
        coalesce((v_item->>'has_measurements')::boolean, false),
        nullif(v_item->>'back_image_url', '')
      )
      on conflict (outfit_id, slot) do update set
        garment_id = excluded.garment_id,
        label = excluded.label,
        image_url = excluded.image_url,
        source = excluded.source,
        design_id = excluded.design_id,
        base_size = excluded.base_size,
        fit_type = excluded.fit_type,
        measurements = excluded.measurements,
        fabric = excluded.fabric,
        has_measurements = excluded.has_measurements,
        back_image_url = excluded.back_image_url;
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

revoke all on function public.save_outfit(text, text, text, text, text, boolean, jsonb, jsonb, text, text) from public;
grant execute on function public.save_outfit(text, text, text, text, text, boolean, jsonb, jsonb, text, text) to anon, authenticated;

-- 코디 상세/내 코디 조회에 mannequin_size + 슬롯별 핏 정보를 포함하도록 재정의. 새로고침 후에도
-- 저장한 코디를 그대로 복원하는 데 쓰인다. returns table의 컬럼 목록이 바뀌므로(mannequin_size 등
-- 추가) Postgres가 CREATE OR REPLACE를 거부한다(42P13) — 먼저 DROP 후 다시 만든다.
drop function if exists public.get_outfit_detail(uuid);
create function public.get_outfit_detail(p_outfit_id uuid)
returns table (
  id uuid,
  user_id uuid,
  title text,
  description text,
  image_url text,
  author_name text,
  character_gender text,
  mannequin_size text,
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
    o.mannequin_size,
    o.is_public, o.like_count,
    (v_user_id is not null and exists(
      select 1 from public.outfit_likes l where l.outfit_id = o.id and l.user_id = v_user_id
    )) as liked_by_me,
    (v_user_id is not null and v_user_id = o.user_id) as is_owner,
    o.created_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'slot', i.slot, 'garmentId', i.garment_id, 'label', i.label,
        'imageUrl', i.image_url, 'source', i.source, 'designId', i.design_id,
        'baseSize', i.base_size, 'fitType', i.fit_type, 'measurements', i.measurements,
        'fabric', i.fabric, 'hasMeasurements', i.has_measurements, 'backImageUrl', i.back_image_url
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

revoke all on function public.get_outfit_detail(uuid) from public;
grant execute on function public.get_outfit_detail(uuid) to anon, authenticated;

drop function if exists public.list_my_outfits();
create function public.list_my_outfits()
returns table (
  id uuid,
  title text,
  description text,
  image_url text,
  is_public boolean,
  like_count integer,
  created_at timestamptz,
  character_gender text,
  mannequin_size text,
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
    o.id, o.title, o.description, o.image_url, o.is_public, o.like_count, o.created_at,
    o.character_gender, o.mannequin_size,
    coalesce((
      select jsonb_agg(t.tag order by t.tag) from public.outfit_tags t where t.outfit_id = o.id
    ), '[]'::jsonb) as tags
  from public.outfits o
  where o.user_id = v_user_id
  order by o.created_at desc;
end;
$$;

revoke all on function public.list_my_outfits() from public;
grant execute on function public.list_my_outfits() to authenticated;

-- --- 가상 피팅 생성 요청의 중복 실행 방지 (request-id 기반). AI 생성 자체는 저장되는 코디와 별개로,
-- 같은 요청이 두 번 재생성되지 않도록 짧게 상태만 추적한다. Edge Function(서비스 역할 키)만 접근한다.
create table if not exists public.virtual_fitting_requests (
  request_id text primary key,
  status text not null default 'processing' check (status in ('processing', 'done')),
  result jsonb,
  created_at timestamptz not null default now()
);

create index if not exists virtual_fitting_requests_created_at_idx
  on public.virtual_fitting_requests (created_at);

alter table public.virtual_fitting_requests enable row level security;
revoke all on table public.virtual_fitting_requests from anon, authenticated;

comment on table public.virtual_fitting_requests is
  'virtual-fitting Edge Function 전용 요청 ID 기반 중복 실행 방지 테이블. 서비스 역할 키로만 접근하며, 클라이언트는 직접 조회/수정할 수 없다.';
