-- Creator/brand identity for funding projects.
-- This migration is intentionally additive: existing profiles, fundings,
-- participations, orders and payment records are preserved.

create table public.creator_profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null,
  profile_image_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_profiles_display_name_length
    check (char_length(btrim(display_name)) between 1 and 60),
  constraint creator_profiles_bio_length
    check (bio is null or char_length(bio) <= 500)
);

comment on table public.creator_profiles is
  '펀딩 제작자의 공개 프로필. 주문/배송용 개인정보가 있는 profiles와 분리한다.';

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  creator_profile_user_id uuid not null references public.creator_profiles(user_id) on delete restrict,
  brand_name text not null,
  normalized_brand_name text generated always as (
    lower(regexp_replace(btrim(brand_name), '[[:space:]]+', ' ', 'g'))
  ) stored,
  brand_logo_url text,
  short_description text,
  description text,
  instagram_url text,
  website_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_one_per_owner unique (owner_user_id),
  constraint brands_creator_matches_owner check (creator_profile_user_id = owner_user_id),
  constraint brands_name_length check (char_length(btrim(brand_name)) between 1 and 80),
  constraint brands_short_description_length
    check (short_description is null or char_length(short_description) <= 120),
  constraint brands_description_length
    check (description is null or char_length(description) <= 3000),
  constraint brands_status_check check (status in ('active', 'suspended'))
);

create unique index brands_normalized_brand_name_key
  on public.brands(normalized_brand_name);

create index brands_status_created_at_idx
  on public.brands(status, created_at desc);

comment on table public.brands is
  '제작자가 BRAND-ER 플랫폼에서 운영하는 공개 브랜드. BRAND-ER 자체 브랜드와 사용자 브랜드를 구분한다.';
comment on column public.brands.normalized_brand_name is
  '앞뒤 공백 제거, 연속 공백 축약, 소문자 변환을 적용한 중복 검사 전용 이름.';

create or replace function public.set_creator_brand_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_creator_brand_updated_at() from public;

create trigger creator_profiles_set_updated_at
before update on public.creator_profiles
for each row execute function public.set_creator_brand_updated_at();

create trigger brands_set_updated_at
before update on public.brands
for each row execute function public.set_creator_brand_updated_at();

alter table public.creator_profiles enable row level security;
alter table public.brands enable row level security;

create policy "Creator profiles are public"
  on public.creator_profiles for select
  to anon, authenticated
  using (true);

create policy "Users can create own creator profile"
  on public.creator_profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update own creator profile"
  on public.creator_profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete own creator profile"
  on public.creator_profiles for delete
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

create policy "Brands are public"
  on public.brands for select
  to anon, authenticated
  using (true);

create policy "Users can create own brand"
  on public.brands for insert
  to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and creator_profile_user_id = (select auth.uid())
    and status = 'active'
  );

create policy "Owners can update own brand"
  on public.brands for update
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (
    owner_user_id = (select auth.uid())
    and creator_profile_user_id = (select auth.uid())
  );

create policy "Admins can update brands"
  on public.brands for update
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create policy "Owners and admins can delete brands"
  on public.brands for delete
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    or public.is_admin((select auth.uid()))
  );

grant select on public.creator_profiles, public.brands to anon;
grant select, insert, update, delete on public.creator_profiles, public.brands to authenticated;

create or replace function public.save_my_brand_profile(
  p_display_name text,
  p_profile_image_url text,
  p_creator_bio text,
  p_brand_name text,
  p_brand_logo_url text,
  p_short_description text,
  p_description text,
  p_instagram_url text,
  p_website_url text
)
returns public.brands
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_brand public.brands%rowtype;
begin
  if v_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if nullif(btrim(p_display_name), '') is null then
    raise exception '제작자명을 입력해주세요.';
  end if;
  if nullif(btrim(p_brand_name), '') is null then
    raise exception '브랜드명을 입력해주세요.';
  end if;

  insert into public.creator_profiles (
    user_id,
    display_name,
    profile_image_url,
    bio
  )
  values (
    v_user_id,
    btrim(p_display_name),
    nullif(btrim(coalesce(p_profile_image_url, '')), ''),
    nullif(btrim(coalesce(p_creator_bio, '')), '')
  )
  on conflict (user_id) do update
  set display_name = excluded.display_name,
      profile_image_url = excluded.profile_image_url,
      bio = excluded.bio;

  insert into public.brands (
    owner_user_id,
    creator_profile_user_id,
    brand_name,
    brand_logo_url,
    short_description,
    description,
    instagram_url,
    website_url
  )
  values (
    v_user_id,
    v_user_id,
    btrim(p_brand_name),
    nullif(btrim(coalesce(p_brand_logo_url, '')), ''),
    nullif(btrim(coalesce(p_short_description, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_instagram_url, '')), ''),
    nullif(btrim(coalesce(p_website_url, '')), '')
  )
  on conflict (owner_user_id) do update
  set brand_name = excluded.brand_name,
      brand_logo_url = excluded.brand_logo_url,
      short_description = excluded.short_description,
      description = excluded.description,
      instagram_url = excluded.instagram_url,
      website_url = excluded.website_url
  returning * into v_brand;

  -- Keep older header/community/admin surfaces compatible while all callers
  -- migrate from profiles.brand_name to the normalized brands table.
  update public.profiles
  set brand_name = v_brand.brand_name,
      avatar_url = nullif(btrim(coalesce(p_profile_image_url, '')), ''),
      bio = nullif(btrim(coalesce(p_creator_bio, '')), ''),
      updated_at = now()
  where id = v_user_id;

  return v_brand;
end;
$$;

revoke all on function public.save_my_brand_profile(
  text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.save_my_brand_profile(
  text, text, text, text, text, text, text, text, text
) to authenticated;

-- Promote the existing public identity only when a member already supplied a
-- legacy brand_name. Duplicate normalized names are deliberately skipped so
-- the migration never guesses which account owns a name.
with candidates as (
  select
    p.id as user_id,
    coalesce(nullif(btrim(p.username), ''), nullif(btrim(p.brand_name), ''), '제작자') as display_name,
    p.avatar_url as profile_image_url,
    p.bio,
    count(*) over (
      partition by lower(regexp_replace(btrim(p.brand_name), '[[:space:]]+', ' ', 'g'))
    ) as normalized_name_count
  from public.profiles p
  where nullif(btrim(p.brand_name), '') is not null
)
insert into public.creator_profiles (user_id, display_name, profile_image_url, bio)
select user_id, display_name, profile_image_url, bio
from candidates
where normalized_name_count = 1
on conflict (user_id) do nothing;

with candidates as (
  select
    p.id as owner_user_id,
    btrim(p.brand_name) as brand_name,
    count(*) over (
      partition by lower(regexp_replace(btrim(p.brand_name), '[[:space:]]+', ' ', 'g'))
    ) as normalized_name_count
  from public.profiles p
  where nullif(btrim(p.brand_name), '') is not null
)
insert into public.brands (
  owner_user_id,
  creator_profile_user_id,
  brand_name
)
select owner_user_id, owner_user_id, brand_name
from candidates
where normalized_name_count = 1
on conflict do nothing;

alter table public.fundings
  add column brand_id uuid references public.brands(id) on delete restrict;

alter table public.fundings
  drop constraint if exists fundings_status_check,
  add constraint fundings_status_check
    check (status in ('draft', 'pending', 'approved', 'rejected', 'closed'));

create index fundings_brand_id_status_created_at_idx
  on public.fundings(brand_id, status, created_at desc);

comment on column public.fundings.brand_id is
  '펀딩을 실제 운영하는 브랜드. 기존 미확인 펀딩은 관리자 지정 전까지 null을 유지한다.';

-- Existing rows are linked only when the funding creator already has one
-- unambiguous migrated brand. No row is assigned to BRAND-ER by default.
update public.fundings funding
set brand_id = brand.id
from public.brands brand
where funding.brand_id is null
  and brand.owner_user_id = funding.creator_id;

create or replace function public.enforce_funding_brand_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_brand_id uuid;
  v_owner_user_id uuid;
  v_brand_status text;
begin
  if tg_op = 'INSERT' and new.brand_id is null then
    select brand.id
      into v_brand_id
    from public.brands brand
    where brand.owner_user_id = new.creator_id
      and brand.status = 'active';

    if v_brand_id is null then
      raise exception '펀딩을 만들기 전에 제작자 프로필과 브랜드를 등록해주세요.';
    end if;
    new.brand_id := v_brand_id;
  end if;

  if tg_op = 'UPDATE' and old.brand_id is not null and new.brand_id is null then
    raise exception '연결된 브랜드는 해제할 수 없습니다.';
  end if;

  if new.brand_id is not null then
    select brand.owner_user_id, brand.status
      into v_owner_user_id, v_brand_status
    from public.brands brand
    where brand.id = new.brand_id;

    if v_owner_user_id is null then
      raise exception '등록된 브랜드를 찾을 수 없습니다.';
    end if;
    if v_brand_status <> 'active' then
      raise exception '현재 사용할 수 없는 브랜드입니다.';
    end if;
    if v_owner_user_id <> new.creator_id then
      raise exception '펀딩 제작자와 브랜드 소유자가 일치하지 않습니다.';
    end if;
  end if;

  if (
    (tg_op = 'INSERT' and new.status = 'approved')
    or (
      tg_op = 'UPDATE'
      and old.status is distinct from new.status
      and new.status = 'approved'
    )
  ) and new.brand_id is null then
    raise exception '브랜드를 지정한 뒤 펀딩을 승인해주세요.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_funding_brand_ownership() from public;

create trigger fundings_enforce_brand_ownership
before insert or update of creator_id, brand_id, status on public.fundings
for each row execute function public.enforce_funding_brand_ownership();

drop policy if exists "Approved fundings are public" on public.fundings;
create policy "Approved fundings are public"
  on public.fundings for select
  using (
    status in ('approved', 'closed')
    or creator_id = (select auth.uid())
    or public.is_admin((select auth.uid()))
  );

-- Include brand ownership in the Data API write rules. The nullable branch on
-- UPDATE is retained solely so legacy unlinked fundings stay editable until an
-- administrator assigns their correct brand.
drop policy if exists "Creators can create pending fundings" on public.fundings;
create policy "Creators can create pending fundings"
  on public.fundings for insert
  to authenticated
  with check (
    creator_id = (select auth.uid())
    and status = 'draft'
    and moq >= 20
    and brand_id is not null
    and exists (
      select 1
      from public.brands brand
      where brand.id = fundings.brand_id
        and brand.owner_user_id = (select auth.uid())
        and brand.status = 'active'
    )
    and trademark_screening_required = true
    and exists (
      select 1
      from public.trademark_screenings screening
      where screening.id = fundings.trademark_screening_id
        and screening.user_id = (select auth.uid())
        and screening.source = 'final_design'
        and screening.decision in ('clear', 'review')
        and screening.image_url = fundings.image_url
    )
  );

drop policy if exists "Creators can edit unapproved fundings" on public.fundings;
create policy "Creators can edit unapproved fundings"
  on public.fundings for update
  to authenticated
  using (
    creator_id = (select auth.uid())
    and status in ('draft', 'pending', 'rejected')
  )
  with check (
    creator_id = (select auth.uid())
    and status in ('draft', 'pending', 'rejected')
    and moq >= 20
    and (
      brand_id is null
      or exists (
        select 1
        from public.brands brand
        where brand.id = fundings.brand_id
          and brand.owner_user_id = (select auth.uid())
          and brand.status = 'active'
      )
    )
    and (
      (
        trademark_screening_required = false
        and trademark_screening_id is null
      )
      or exists (
        select 1
        from public.trademark_screenings screening
        where screening.id = fundings.trademark_screening_id
          and screening.user_id = (select auth.uid())
          and screening.source = 'final_design'
          and screening.decision in ('clear', 'review')
          and screening.image_url = fundings.image_url
      )
    )
  );

create or replace function public.update_creator_funding(
  p_funding_id uuid,
  p_product_name text,
  p_description text,
  p_moq integer,
  p_price integer,
  p_estimate_direct_unit_min integer,
  p_estimate_direct_unit_max integer,
  p_estimate_development_total integer,
  p_fabric_unit_cost integer,
  p_funding_days integer,
  p_color_options text[],
  p_size_options text[],
  p_measurements jsonb
)
returns public.fundings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
  v_minimum_moq integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_funding
  from public.fundings
  where id = p_funding_id and creator_id = auth.uid()
  for update;

  if not found then
    raise exception '펀딩을 수정할 권한이 없습니다.';
  end if;
  if nullif(btrim(p_product_name), '') is null then
    raise exception '상품명을 입력해주세요.';
  end if;

  v_minimum_moq := public.minimum_funding_moq(v_funding.cloth_type, v_funding.material);

  if v_funding.status in ('draft', 'pending', 'rejected') then
    if p_moq < v_minimum_moq then
      raise exception '최소 제작 수량은 %장입니다.', v_minimum_moq;
    end if;
    if p_price is not null and p_price < 0 then
      raise exception '판매가는 0원 이상이어야 합니다.';
    end if;
    if p_fabric_unit_cost < 0 then
      raise exception '원단비는 0원 이상이어야 합니다.';
    end if;
    if p_estimate_direct_unit_min is not null and p_estimate_direct_unit_min < 0 then
      raise exception '제작 견적은 0원 이상이어야 합니다.';
    end if;
    if p_estimate_direct_unit_max is not null and p_estimate_direct_unit_max < 0 then
      raise exception '제작 견적은 0원 이상이어야 합니다.';
    end if;
    if p_estimate_development_total is not null and p_estimate_development_total < 0 then
      raise exception '개발비 견적은 0원 이상이어야 합니다.';
    end if;
    if p_estimate_direct_unit_min is not null
      and p_estimate_direct_unit_max is not null
      and p_estimate_direct_unit_min > p_estimate_direct_unit_max then
      raise exception '최소 제작 견적은 최대 제작 견적보다 클 수 없습니다.';
    end if;
    if p_funding_days < 1 or p_funding_days > 90 then
      raise exception '진행 기간은 1일부터 90일까지 설정할 수 있습니다.';
    end if;
    if cardinality(p_color_options) = 0 or cardinality(p_size_options) = 0 then
      raise exception '컬러와 사이즈를 한 개 이상 등록해주세요.';
    end if;

    update public.fundings
    set product_name = btrim(p_product_name),
        description = p_description,
        moq = p_moq,
        price = p_price,
        estimate_direct_unit_min = p_estimate_direct_unit_min,
        estimate_direct_unit_max = p_estimate_direct_unit_max,
        estimate_development_total = p_estimate_development_total,
        fabric_unit_cost = p_fabric_unit_cost,
        funding_days = p_funding_days,
        color_options = p_color_options,
        size_options = p_size_options,
        measurements = p_measurements,
        updated_at = now()
    where id = p_funding_id
    returning * into v_funding;
  else
    if p_moq <> v_funding.moq
      or p_price is distinct from v_funding.price
      or p_estimate_direct_unit_min is distinct from v_funding.estimate_direct_unit_min
      or p_estimate_direct_unit_max is distinct from v_funding.estimate_direct_unit_max
      or p_estimate_development_total is distinct from v_funding.estimate_development_total
      or p_fabric_unit_cost <> v_funding.fabric_unit_cost
      or p_funding_days <> v_funding.funding_days
      or p_color_options is distinct from v_funding.color_options
      or p_size_options is distinct from v_funding.size_options
      or p_measurements is distinct from v_funding.measurements then
      raise exception '승인된 펀딩은 상품명과 상세 설명만 수정할 수 있습니다.';
    end if;

    update public.fundings
    set product_name = btrim(p_product_name),
        description = p_description,
        updated_at = now()
    where id = p_funding_id
    returning * into v_funding;
  end if;

  return v_funding;
end;
$$;

create or replace function public.submit_funding_for_review(p_funding_id uuid)
returns public.fundings
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_funding
  from public.fundings
  where id = p_funding_id
    and creator_id = auth.uid()
  for update;

  if not found then
    raise exception '펀딩을 승인 요청할 권한이 없습니다.';
  end if;
  if v_funding.status not in ('draft', 'rejected') then
    raise exception '준비 중이거나 수정이 필요한 펀딩만 승인 요청할 수 있습니다.';
  end if;
  if v_funding.brand_id is null then
    raise exception '제작자와 브랜드를 먼저 연결해주세요.';
  end if;
  if nullif(btrim(v_funding.product_name), '') is null
    or nullif(btrim(coalesce(v_funding.description, '')), '') is null then
    raise exception '상품명과 상세 설명을 입력해주세요.';
  end if;
  if cardinality(v_funding.color_options) = 0
    or cardinality(v_funding.size_options) = 0 then
    raise exception '컬러와 사이즈를 한 개 이상 등록해주세요.';
  end if;

  update public.fundings
  set status = 'pending',
      admin_comment = null,
      reviewed_at = null,
      reviewed_by = null,
      updated_at = now()
  where id = p_funding_id
  returning * into v_funding;

  return v_funding;
end;
$$;

revoke all on function public.submit_funding_for_review(uuid) from public;
grant execute on function public.submit_funding_for_review(uuid) to authenticated;

-- Public creator/brand assets. Downloads are public; writes are restricted to
-- the authenticated user's top-level UUID folder.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'creator-assets',
  'creator-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Creator assets are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'creator-assets');

create policy "Users can upload own creator assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'creator-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update own creator assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'creator-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'creator-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete own creator assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'creator-assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
