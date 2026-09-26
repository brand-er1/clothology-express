-- 컬러 옵션별 상품 이미지 (AI 컬러 변형) + 주문 컬러 연결
--
-- 원칙
--  * 추가(additive) 전용. 기존 펀딩/주문/모의결제/결제/회원/브랜드 데이터는 삭제·초기화하지 않는다.
--  * funding_colors 가 컬러 옵션의 기준 데이터이고, 기존 fundings.color_options(text[])는
--    양방향으로 자동 동기화된다 → 기존 주문 검증(create_mock_funding_order 등)·편집 화면이 그대로 동작한다.
--  * 펀딩 상세 · AI 상세페이지 · 주문 · 관리가 같은 컬러 데이터(funding_colors / funding_color_images)를 공유한다.
--  * 컬러 삭제는 소프트 삭제(status='deleted'). 기존 주문의 컬러 정보는 보존된다.

-- ---------------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------------

create table if not exists public.funding_colors (
  id uuid primary key default gen_random_uuid(),
  funding_id uuid not null references public.fundings(id) on delete cascade,
  name text not null,
  hex text,
  sort_order integer not null default 0,
  is_base boolean not null default false,
  status text not null default 'active',
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_colors_name_length check (char_length(btrim(name)) between 1 and 30),
  constraint funding_colors_hex_format check (hex is null or hex ~ '^#[0-9A-Fa-f]{6}$'),
  constraint funding_colors_status_check check (status in ('active', 'deleted'))
);

create unique index if not exists funding_colors_active_name_key
  on public.funding_colors (funding_id, lower(btrim(name))) where status = 'active';
create index if not exists funding_colors_funding_idx on public.funding_colors (funding_id, sort_order);

comment on table public.funding_colors is
  '펀딩 상품의 컬러 옵션(기준 데이터). fundings.color_options 와 자동 동기화된다. is_base = 원본 디자인 이미지의 컬러.';

create table if not exists public.funding_color_images (
  id uuid primary key default gen_random_uuid(),
  color_id uuid not null references public.funding_colors(id) on delete cascade,
  funding_id uuid not null references public.fundings(id) on delete cascade,
  view text not null,
  status text not null default 'generating',
  source text not null default 'ai',
  image_url text,
  storage_path text,
  prompt text,
  provider text,
  model text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funding_color_images_view_check check (view in ('front', 'back')),
  constraint funding_color_images_status_check check (status in ('generating', 'preview', 'approved', 'rejected', 'failed', 'replaced')),
  constraint funding_color_images_source_check check (source in ('original', 'ai', 'upload')),
  constraint funding_color_images_url_check check (image_url is null or image_url ~ '^https?://')
);

-- 컬러·면(앞/뒤)마다 고객에게 보이는 승인 이미지는 1장
create unique index if not exists funding_color_images_approved_key
  on public.funding_color_images (color_id, view) where status = 'approved';
create index if not exists funding_color_images_color_idx on public.funding_color_images (color_id, view, created_at desc);
create index if not exists funding_color_images_funding_idx on public.funding_color_images (funding_id);

comment on table public.funding_color_images is
  '컬러별 상품 이미지(앞/뒤). AI 생성 결과는 preview 로 저장되고 제작자가 승인(approved)해야 고객에게 노출된다.';

drop trigger if exists funding_colors_set_updated_at on public.funding_colors;
create trigger funding_colors_set_updated_at before update on public.funding_colors
for each row execute function public.set_creator_brand_updated_at();
drop trigger if exists funding_color_images_set_updated_at on public.funding_color_images;
create trigger funding_color_images_set_updated_at before update on public.funding_color_images
for each row execute function public.set_creator_brand_updated_at();

-- ---------------------------------------------------------------------------
-- 2. 권한 (제작자 본인 또는 fundings.manage 관리자)
-- ---------------------------------------------------------------------------

create or replace function public._can_manage_funding_user(p_user_id uuid, p_funding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and (
    exists (select 1 from public.fundings f where f.id = p_funding_id and f.creator_id = p_user_id)
    or public._admin_has_permission(p_user_id, 'fundings.manage')
  );
$$;

revoke all on function public._can_manage_funding_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public._can_manage_funding_user(uuid, uuid) to service_role;

create or replace function public.can_manage_funding(p_funding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._can_manage_funding_user(auth.uid(), p_funding_id);
$$;

revoke all on function public.can_manage_funding(uuid) from public;
-- anon 도 RLS 정책 평가에 필요(로그인하지 않았으면 항상 false)
grant execute on function public.can_manage_funding(uuid) to anon, authenticated;

alter table public.funding_colors enable row level security;
alter table public.funding_color_images enable row level security;

-- 공개 조회: 조회 가능한 펀딩(fundings RLS 가 판단)의 활성 컬러 / 승인 이미지만
drop policy if exists "Visible funding colors are public" on public.funding_colors;
create policy "Visible funding colors are public"
  on public.funding_colors for select
  to anon, authenticated
  using (
    (status = 'active' and exists (select 1 from public.fundings f where f.id = funding_id))
    or public.can_manage_funding(funding_id)
  );

drop policy if exists "Approved color images are public" on public.funding_color_images;
create policy "Approved color images are public"
  on public.funding_color_images for select
  to anon, authenticated
  using (
    (status = 'approved' and exists (select 1 from public.fundings f where f.id = funding_id))
    or public.can_manage_funding(funding_id)
  );

-- 쓰기는 RPC(SECURITY DEFINER) / Edge Function(service role)만
revoke insert, update, delete on public.funding_colors from anon, authenticated;
revoke insert, update, delete on public.funding_color_images from anon, authenticated;
grant select on public.funding_colors, public.funding_color_images to anon, authenticated;
grant all on public.funding_colors, public.funding_color_images to service_role;

-- ---------------------------------------------------------------------------
-- 3. color_options ↔ funding_colors 동기화
-- ---------------------------------------------------------------------------

-- funding_colors → fundings.color_options (컬러 추가/삭제/이름변경/순서변경 후 호출)
create or replace function public._sync_funding_color_options(p_funding_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('brander.color_sync', 'on', true);
  update public.fundings f
  set color_options = coalesce((
        select array_agg(c.name order by c.sort_order, c.created_at)
        from public.funding_colors c
        where c.funding_id = p_funding_id and c.status = 'active'
      ), '{}'::text[]),
      updated_at = now()
  where f.id = p_funding_id;
  perform set_config('brander.color_sync', 'off', true);
end;
$$;

revoke all on function public._sync_funding_color_options(uuid) from public, anon, authenticated;

-- fundings.color_options → funding_colors (기존 편집 화면/신규 펀딩 등록 경로)
create or replace function public._reconcile_funding_colors_from_options()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_position integer;
  v_existing uuid;
begin
  if coalesce(current_setting('brander.color_sync', true), 'off') = 'on' then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.color_options is not distinct from old.color_options then
    return null;
  end if;

  for v_name, v_position in
    select btrim(o.name), o.ord::integer
    from unnest(coalesce(new.color_options, '{}'::text[])) with ordinality as o(name, ord)
    where nullif(btrim(o.name), '') is not null
  loop
    select id into v_existing from public.funding_colors
    where funding_id = new.id and status = 'active' and lower(btrim(name)) = lower(v_name);
    if v_existing is null then
      insert into public.funding_colors (funding_id, name, sort_order, created_by)
      values (new.id, v_name, v_position, auth.uid())
      on conflict do nothing;
    else
      update public.funding_colors set sort_order = v_position where id = v_existing and sort_order <> v_position;
    end if;
  end loop;

  update public.funding_colors c
  set status = 'deleted', deleted_at = now()
  where c.funding_id = new.id and c.status = 'active'
    and not exists (
      select 1 from unnest(coalesce(new.color_options, '{}'::text[])) o(name)
      where lower(btrim(o.name)) = lower(btrim(c.name))
    );

  -- 기준(base) 컬러가 없으면 첫 컬러를 기준으로
  if not exists (select 1 from public.funding_colors where funding_id = new.id and status = 'active' and is_base) then
    update public.funding_colors set is_base = true
    where id = (select id from public.funding_colors where funding_id = new.id and status = 'active' order by sort_order, created_at limit 1);
  end if;
  return null;
end;
$$;

revoke all on function public._reconcile_funding_colors_from_options() from public, anon, authenticated;

drop trigger if exists fundings_reconcile_colors on public.fundings;
create trigger fundings_reconcile_colors
after insert or update of color_options on public.fundings
for each row execute function public._reconcile_funding_colors_from_options();

-- ---------------------------------------------------------------------------
-- 4. 주문(참여) 컬러 연결: product_id / color_id / color_name
-- ---------------------------------------------------------------------------

alter table public.funding_participations
  add column if not exists color_id uuid references public.funding_colors(id) on delete set null;

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'funding_participations' and column_name = 'product_id') then
    alter table public.funding_participations add column product_id uuid generated always as (funding_id) stored;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'funding_participations' and column_name = 'color_name') then
    alter table public.funding_participations add column color_name text generated always as (selected_color) stored;
  end if;
end $$;

comment on column public.funding_participations.product_id is '상품 ID. 현재는 펀딩 = 상품이므로 funding_id 와 같다(향후 상품 분리 대비).';
comment on column public.funding_participations.color_id is '주문 시점의 funding_colors.id. 컬러 이름이 바뀌어도 컬러별 집계가 유지된다.';
comment on column public.funding_participations.color_name is '주문 시점의 컬러명(selected_color).';

create index if not exists funding_participations_color_idx on public.funding_participations (funding_id, color_id);

create or replace function public._set_participation_color_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.selected_color is distinct from old.selected_color or new.color_id is null then
    select c.id into new.color_id
    from public.funding_colors c
    where c.funding_id = new.funding_id and lower(btrim(c.name)) = lower(btrim(new.selected_color))
    order by (c.status = 'active') desc, c.created_at desc
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public._set_participation_color_id() from public, anon, authenticated;

drop trigger if exists funding_participations_set_color on public.funding_participations;
create trigger funding_participations_set_color
before insert or update of selected_color on public.funding_participations
for each row execute function public._set_participation_color_id();

-- ---------------------------------------------------------------------------
-- 5. 기존 데이터 백필 (컬러 행 생성 + 원본 이미지를 기준 컬러 앞면으로 + 주문 color_id)
-- ---------------------------------------------------------------------------

insert into public.funding_colors (funding_id, name, sort_order)
select f.id, btrim(o.name), o.ord::integer
from public.fundings f
cross join lateral unnest(f.color_options) with ordinality as o(name, ord)
where nullif(btrim(o.name), '') is not null
  and not exists (select 1 from public.funding_colors c where c.funding_id = f.id)
on conflict do nothing;

insert into public.funding_colors (funding_id, name, sort_order)
select f.id, btrim(f.color), 1
from public.fundings f
where coalesce(array_length(f.color_options, 1), 0) = 0
  and nullif(btrim(coalesce(f.color, '')), '') is not null
  and btrim(f.color) <> '기본 색상'
  and not exists (select 1 from public.funding_colors c where c.funding_id = f.id)
on conflict do nothing;

update public.funding_colors c
set is_base = true
where c.id in (
  select distinct on (c2.funding_id) c2.id
  from public.funding_colors c2
  join public.fundings f on f.id = c2.funding_id
  where c2.status = 'active'
    and not exists (select 1 from public.funding_colors b where b.funding_id = c2.funding_id and b.is_base)
  order by c2.funding_id, (lower(btrim(c2.name)) = lower(btrim(coalesce(f.color, '')))) desc, c2.sort_order, c2.created_at
);

insert into public.funding_color_images (color_id, funding_id, view, status, source, image_url, storage_path, approved_at)
select c.id, c.funding_id, 'front', 'approved', 'original', f.image_url, f.image_path, now()
from public.funding_colors c
join public.fundings f on f.id = c.funding_id
where c.is_base and c.status = 'active' and f.image_url ~ '^https?://'
  and not exists (select 1 from public.funding_color_images i where i.color_id = c.id)
on conflict do nothing;

update public.funding_participations fp
set color_id = c.id
from public.funding_colors c
where fp.color_id is null
  and c.funding_id = fp.funding_id
  and lower(btrim(c.name)) = lower(btrim(fp.selected_color));

-- ---------------------------------------------------------------------------
-- 6. 컬러 관리 RPC (제작자 / 관리자 공통)
-- ---------------------------------------------------------------------------

create or replace function public._require_funding_manager(p_funding_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not public._can_manage_funding_user(v_user, p_funding_id) then
    raise exception '이 펀딩의 컬러를 관리할 권한이 없습니다.' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

revoke all on function public._require_funding_manager(uuid) from public, anon, authenticated;

-- 컬러 추가 / 이름·색상 변경
create or replace function public.save_funding_color(
  p_funding_id uuid,
  p_color_id uuid default null,
  p_name text default null,
  p_hex text default null
)
returns public.funding_colors
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public._require_funding_manager(p_funding_id);
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_hex text := nullif(btrim(coalesce(p_hex, '')), '');
  v_row public.funding_colors%rowtype;
begin
  if char_length(v_name) not between 1 and 30 then
    raise exception '컬러명은 1~30자로 입력해주세요.';
  end if;
  if v_hex is not null and v_hex !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception '색상 코드는 #RRGGBB 형식이어야 합니다.';
  end if;
  if exists (
    select 1 from public.funding_colors
    where funding_id = p_funding_id and status = 'active' and lower(btrim(name)) = lower(v_name)
      and (p_color_id is null or id <> p_color_id)
  ) then
    raise exception '이미 등록된 컬러입니다: %', v_name;
  end if;

  if p_color_id is null then
    if (select count(*) from public.funding_colors where funding_id = p_funding_id and status = 'active') >= 12 then
      raise exception '컬러는 최대 12개까지 등록할 수 있습니다.';
    end if;
    insert into public.funding_colors (funding_id, name, hex, sort_order, created_by, is_base)
    values (
      p_funding_id, v_name, upper(v_hex),
      coalesce((select max(sort_order) from public.funding_colors where funding_id = p_funding_id and status = 'active'), 0) + 1,
      v_user,
      not exists (select 1 from public.funding_colors where funding_id = p_funding_id and status = 'active')
    )
    returning * into v_row;
  else
    update public.funding_colors
    set name = v_name, hex = upper(v_hex)
    where id = p_color_id and funding_id = p_funding_id and status = 'active'
    returning * into v_row;
    if not found then
      raise exception '컬러를 찾을 수 없습니다.';
    end if;
  end if;

  perform public._sync_funding_color_options(p_funding_id);
  return v_row;
end;
$$;

revoke all on function public.save_funding_color(uuid, uuid, text, text) from public, anon;
grant execute on function public.save_funding_color(uuid, uuid, text, text) to authenticated;

-- 컬러 삭제(소프트). 기존 주문의 컬러 정보는 그대로 남는다.
create or replace function public.delete_funding_color(p_color_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_color public.funding_colors%rowtype;
  v_orders integer;
begin
  select * into v_color from public.funding_colors where id = p_color_id and status = 'active';
  if not found then
    raise exception '컬러를 찾을 수 없습니다.';
  end if;
  perform public._require_funding_manager(v_color.funding_id);
  if (select count(*) from public.funding_colors where funding_id = v_color.funding_id and status = 'active') <= 1 then
    raise exception '컬러는 최소 1개 이상 있어야 합니다.';
  end if;

  update public.funding_colors set status = 'deleted', deleted_at = now(), is_base = false where id = p_color_id;
  if v_color.is_base then
    update public.funding_colors set is_base = true
    where id = (select id from public.funding_colors where funding_id = v_color.funding_id and status = 'active' order by sort_order, created_at limit 1);
  end if;
  perform public._sync_funding_color_options(v_color.funding_id);

  select count(*) into v_orders from public.funding_participations
  where color_id = p_color_id and status <> 'cancelled' and payment_status in ('paid', 'ready', 'unpaid');
  return jsonb_build_object('deleted', true, 'existing_orders', v_orders);
end;
$$;

revoke all on function public.delete_funding_color(uuid) from public, anon;
grant execute on function public.delete_funding_color(uuid) to authenticated;

create or replace function public.reorder_funding_colors(p_funding_id uuid, p_color_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._require_funding_manager(p_funding_id);
  update public.funding_colors c
  set sort_order = o.ord::integer
  from unnest(p_color_ids) with ordinality as o(id, ord)
  where c.id = o.id and c.funding_id = p_funding_id and c.status = 'active';
  perform public._sync_funding_color_options(p_funding_id);
end;
$$;

revoke all on function public.reorder_funding_colors(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_funding_colors(uuid, uuid[]) to authenticated;

create or replace function public.set_funding_base_color(p_color_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding uuid;
begin
  select funding_id into v_funding from public.funding_colors where id = p_color_id and status = 'active';
  if v_funding is null then
    raise exception '컬러를 찾을 수 없습니다.';
  end if;
  perform public._require_funding_manager(v_funding);
  update public.funding_colors set is_base = (id = p_color_id) where funding_id = v_funding and status = 'active';
end;
$$;

revoke all on function public.set_funding_base_color(uuid) from public, anon;
grant execute on function public.set_funding_base_color(uuid) to authenticated;

-- AI 결과 승인/거절 (승인하면 같은 컬러·면의 이전 이미지는 replaced)
create or replace function public.review_funding_color_image(p_image_id uuid, p_action text)
returns public.funding_color_images
language plpgsql
security definer
set search_path = public
as $$
declare
  v_image public.funding_color_images%rowtype;
  v_user uuid;
begin
  select * into v_image from public.funding_color_images where id = p_image_id for update;
  if not found then
    raise exception '이미지를 찾을 수 없습니다.';
  end if;
  v_user := public._require_funding_manager(v_image.funding_id);

  if p_action = 'approve' then
    if v_image.status not in ('preview', 'rejected', 'replaced') or v_image.image_url is null then
      raise exception '승인할 수 없는 이미지 상태입니다.';
    end if;
    update public.funding_color_images set status = 'replaced'
    where color_id = v_image.color_id and view = v_image.view and status = 'approved' and id <> p_image_id;
    update public.funding_color_images
    set status = 'approved', approved_by = v_user, approved_at = now()
    where id = p_image_id
    returning * into v_image;
  elsif p_action = 'reject' then
    update public.funding_color_images set status = 'rejected' where id = p_image_id returning * into v_image;
  else
    raise exception '알 수 없는 작업입니다.';
  end if;
  return v_image;
end;
$$;

revoke all on function public.review_funding_color_image(uuid, text) from public, anon;
grant execute on function public.review_funding_color_image(uuid, text) to authenticated;

-- 이미지 교체: 제작자가 직접 올린 이미지를 바로 승인 이미지로 등록
create or replace function public.register_funding_color_image_upload(p_color_id uuid, p_view text, p_image_url text)
returns public.funding_color_images
language plpgsql
security definer
set search_path = public
as $$
declare
  v_color public.funding_colors%rowtype;
  v_user uuid;
  v_row public.funding_color_images%rowtype;
begin
  select * into v_color from public.funding_colors where id = p_color_id and status = 'active';
  if not found then
    raise exception '컬러를 찾을 수 없습니다.';
  end if;
  v_user := public._require_funding_manager(v_color.funding_id);
  if p_view not in ('front', 'back') then
    raise exception '앞면(front) 또는 뒷면(back)만 지정할 수 있습니다.';
  end if;
  if coalesce(p_image_url, '') !~ '^https://' then
    raise exception '이미지 주소가 올바르지 않습니다.';
  end if;

  update public.funding_color_images set status = 'replaced'
  where color_id = p_color_id and view = p_view and status = 'approved';
  insert into public.funding_color_images (color_id, funding_id, view, status, source, image_url, created_by, approved_by, approved_at)
  values (p_color_id, v_color.funding_id, p_view, 'approved', 'upload', p_image_url, v_user, v_user, now())
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.register_funding_color_image_upload(uuid, text, text) from public, anon;
grant execute on function public.register_funding_color_image_upload(uuid, text, text) to authenticated;

-- 컬러별 주문 수량 (제작자 / 관리자 fundings.view)
create or replace function public.get_funding_color_summary(p_funding_id uuid)
returns table (
  color_id uuid,
  color_name text,
  hex text,
  sort_order integer,
  color_status text,
  paid_quantity bigint,
  paid_orders bigint,
  pending_quantity bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not (public._can_manage_funding_user(v_user, p_funding_id) or public._admin_has_permission(v_user, 'fundings.view')) then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;

  return query
  with orders as (
    select fp.color_id, fp.selected_color, fp.quantity, fp.payment_status
    from public.funding_participations fp
    where fp.funding_id = p_funding_id and fp.status <> 'cancelled'
  )
  select c.id, c.name, c.hex, c.sort_order, c.status,
         coalesce(sum(o.quantity) filter (where o.payment_status = 'paid'), 0)::bigint,
         count(o.quantity) filter (where o.payment_status = 'paid')::bigint,
         coalesce(sum(o.quantity) filter (where o.payment_status in ('ready', 'unpaid')), 0)::bigint
  from public.funding_colors c
  left join orders o on o.color_id = c.id
  where c.funding_id = p_funding_id
    and (c.status = 'active' or exists (select 1 from orders o2 where o2.color_id = c.id))
  group by c.id
  union all
  -- 컬러 행과 연결되지 않은 과거 주문(컬러명 기준)
  select null::uuid, o.selected_color, null::text, 999, 'unlinked',
         coalesce(sum(o.quantity) filter (where o.payment_status = 'paid'), 0)::bigint,
         count(*) filter (where o.payment_status = 'paid')::bigint,
         coalesce(sum(o.quantity) filter (where o.payment_status in ('ready', 'unpaid')), 0)::bigint
  from orders o
  where o.color_id is null
  group by o.selected_color
  order by 5, 4;
end;
$$;

revoke all on function public.get_funding_color_summary(uuid) from public, anon;
grant execute on function public.get_funding_color_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. AI 사용량: 컬러 이미지 기능 추가 (기존 detail_copy/detail_image 동작은 그대로)
-- ---------------------------------------------------------------------------

alter table public.ai_usage_logs
  drop constraint if exists ai_usage_logs_feature_check,
  add constraint ai_usage_logs_feature_check check (feature in ('detail_copy', 'detail_image', 'color_image'));

insert into public.platform_settings (key, value, description) values
  ('ai_color_image_daily_limit', '40'::jsonb, '제작자 1인당 하루 AI 컬러 상품 이미지 생성 한도(성공+실패 시도 포함).')
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
  if p_feature not in ('detail_copy', 'detail_image', 'color_image') then
    raise exception 'unknown feature';
  end if;
  v_daily_limit := case p_feature
    when 'detail_image' then public._platform_setting_numeric('ai_detail_image_daily_limit', 40)
    when 'color_image' then public._platform_setting_numeric('ai_color_image_daily_limit', 40)
    else public._platform_setting_numeric('ai_detail_copy_daily_limit', 60) end::integer;
  v_label := case p_feature when 'detail_copy' then '문구' when 'color_image' then '컬러 이미지' else '이미지' end;
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

-- 컬러 이미지는 상세페이지가 없을 수 있으므로 funding_id 를 직접 받는다(기존 인자는 그대로 호환).
drop function if exists public.log_ai_usage(uuid, text, text, text, text, uuid, text, integer, text, jsonb);
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
  p_funding_id uuid default null
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
      case when p_feature in ('detail_image', 'color_image') then 'ai_image_unit_cost_usd' else 'ai_copy_unit_cost_usd' end,
      case when p_feature in ('detail_image', 'color_image') then 0.04 else 0.002 end);
  end if;
  insert into public.ai_usage_logs (
    user_id, feature, status, provider, model, detail_page_id, funding_id, image_type,
    estimated_cost_usd, latency_ms, error_message, metadata
  ) values (
    p_user_id, p_feature, p_status, p_provider, p_model, p_detail_page_id,
    coalesce(p_funding_id, (select funding_id from public.product_detail_pages where id = p_detail_page_id)),
    p_image_type, v_cost, p_latency_ms, left(p_error, 1000), coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_ai_usage(uuid, text, text, text, text, uuid, text, integer, text, jsonb, uuid) from public, anon, authenticated;
