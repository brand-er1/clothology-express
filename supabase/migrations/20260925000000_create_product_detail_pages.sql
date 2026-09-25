-- AI product detail pages (상세페이지) for fundings.
--
-- Additive only: no existing table, column, policy or row is changed. A detail
-- page is structured JSON (page row + ordered section rows) that the frontend
-- renders with one of the detail-page templates; it never stores generated HTML.
--
--   product_detail_pages  one per design/funding, owned by its creator
--   detail_page_sections  ordered sections (hero, story, design, ...) of a page
--   generated_assets      AI detail-page image generations (status, prompt, reference, result)
--
-- Generated images are stored in the existing public `generated_images` bucket under
-- detail-pages/{user_id}/{detail_page_id}/... by the generate-detail-image edge function.

create table if not exists public.product_detail_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Set when the creator presses "펀딩 시작하기". One detail page per funding.
  funding_id uuid unique references public.fundings(id) on delete set null,
  design_id uuid references public.designs(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  template text not null default 'minimal'
    check (template in ('minimal', 'street', 'luxury', 'sports', 'casual')),
  title text not null default '',
  title_en text not null default '',
  subtitle text not null default '',
  main_copy text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'linked')),
  -- Verified product facts gathered from the design flow / funding (image,
  -- type, fabric, color, fit, decorations, estimate, price...). Only these
  -- facts are ever shown as specifications.
  source jsonb not null default '{}'::jsonb,
  -- AI generation metadata (provider, generated_at, fallback reason).
  generation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_detail_pages_user_idx
  on public.product_detail_pages (user_id, updated_at desc);

create table if not exists public.detail_page_sections (
  id uuid primary key default gen_random_uuid(),
  detail_page_id uuid not null references public.product_detail_pages(id) on delete cascade,
  section_type text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  content jsonb not null default '{}'::jsonb,
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists detail_page_sections_page_idx
  on public.detail_page_sections (detail_page_id, sort_order);

-- One row per AI detail-page image generation (and per regeneration). Written only by
-- the generate-detail-image edge function (service role); owners can read their rows.
create table if not exists public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  detail_page_id uuid not null references public.product_detail_pages(id) on delete cascade,
  image_type text not null
    check (image_type in ('hero', 'product_front', 'product_back', 'detail', 'editorial', 'lifestyle', 'fabric', 'mood')),
  style text not null default 'minimal',
  reference_image text not null,
  prompt text not null default '',
  user_instruction text,
  provider text,
  model text,
  generated_image text,
  storage_path text,
  generation_status text not null default 'pending'
    check (generation_status in ('pending', 'generating', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generated_assets_page_idx
  on public.generated_assets (detail_page_id, image_type, created_at desc);

create or replace function public.touch_detail_page_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists product_detail_pages_touch_updated_at on public.product_detail_pages;
create trigger product_detail_pages_touch_updated_at
before update on public.product_detail_pages
for each row execute function public.touch_detail_page_updated_at();

drop trigger if exists detail_page_sections_touch_updated_at on public.detail_page_sections;
create trigger detail_page_sections_touch_updated_at
before update on public.detail_page_sections
for each row execute function public.touch_detail_page_updated_at();

drop trigger if exists generated_assets_touch_updated_at on public.generated_assets;
create trigger generated_assets_touch_updated_at
before update on public.generated_assets
for each row execute function public.touch_detail_page_updated_at();

alter table public.product_detail_pages enable row level security;
alter table public.detail_page_sections enable row level security;
alter table public.generated_assets enable row level security;

-- Readable by the owner, admins, and everyone once the linked funding is on sale.
-- The fundings subquery runs under fundings' own RLS, so a non-public funding
-- never exposes its page.
drop policy if exists "Detail pages are readable" on public.product_detail_pages;
create policy "Detail pages are readable"
  on public.product_detail_pages for select
  using (
    user_id = (select auth.uid())
    or public.is_admin((select auth.uid()))
    or exists (
      select 1 from public.fundings funding
      where funding.id = product_detail_pages.funding_id
        and funding.creator_id = product_detail_pages.user_id
        and funding.status in ('approved', 'closed')
    )
  );

drop policy if exists "Creators create own detail pages" on public.product_detail_pages;
create policy "Creators create own detail pages"
  on public.product_detail_pages for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      funding_id is null
      or exists (
        select 1 from public.fundings funding
        where funding.id = product_detail_pages.funding_id
          and funding.creator_id = (select auth.uid())
      )
    )
    and (
      brand_id is null
      or exists (
        select 1 from public.brands brand
        where brand.id = product_detail_pages.brand_id
          and brand.owner_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Creators update own detail pages" on public.product_detail_pages;
create policy "Creators update own detail pages"
  on public.product_detail_pages for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      funding_id is null
      or exists (
        select 1 from public.fundings funding
        where funding.id = product_detail_pages.funding_id
          and funding.creator_id = (select auth.uid())
      )
    )
    and (
      brand_id is null
      or exists (
        select 1 from public.brands brand
        where brand.id = product_detail_pages.brand_id
          and brand.owner_user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "Creators delete own unlinked detail pages" on public.product_detail_pages;
create policy "Creators delete own unlinked detail pages"
  on public.product_detail_pages for delete
  to authenticated
  using (user_id = (select auth.uid()) and funding_id is null);

-- Sections follow their page: visible when the page is visible (page RLS
-- applies inside the subquery), writable only by the page owner.
drop policy if exists "Detail page sections are readable" on public.detail_page_sections;
create policy "Detail page sections are readable"
  on public.detail_page_sections for select
  using (
    exists (
      select 1 from public.product_detail_pages page
      where page.id = detail_page_sections.detail_page_id
    )
  );

drop policy if exists "Owners manage detail page sections" on public.detail_page_sections;
create policy "Owners manage detail page sections"
  on public.detail_page_sections for all
  to authenticated
  using (
    exists (
      select 1 from public.product_detail_pages page
      where page.id = detail_page_sections.detail_page_id
        and page.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.product_detail_pages page
      where page.id = detail_page_sections.detail_page_id
        and page.user_id = (select auth.uid())
    )
  );

drop policy if exists "Owners read generated assets" on public.generated_assets;
create policy "Owners read generated assets"
  on public.generated_assets for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_admin((select auth.uid())));

-- Saves a whole detail page (page fields + ordered sections) atomically, so a
-- debounced autosave never leaves a half-written page. SECURITY INVOKER: every
-- statement runs under the RLS policies above, so callers can only write their
-- own page. Sections missing from p_sections are removed from that page only.
create or replace function public.save_product_detail_page(
  p_page_id uuid,
  p_page jsonb,
  p_sections jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated_at timestamptz;
  v_section_ids uuid[];
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if jsonb_typeof(p_sections) is distinct from 'array' then
    raise exception '섹션 데이터 형식이 올바르지 않습니다.';
  end if;

  update public.product_detail_pages
  set template = coalesce(p_page->>'template', template),
      title = coalesce(p_page->>'title', title),
      title_en = coalesce(p_page->>'title_en', title_en),
      subtitle = coalesce(p_page->>'subtitle', subtitle),
      main_copy = coalesce(p_page->>'main_copy', main_copy),
      status = case
        when status = 'linked' then status
        else coalesce(p_page->>'status', status)
      end,
      source = coalesce(p_page->'source', source),
      generation = coalesce(p_page->'generation', generation)
  where id = p_page_id
    and user_id = auth.uid()
  returning updated_at into v_updated_at;

  if v_updated_at is null then
    raise exception '상세페이지를 저장할 권한이 없습니다.';
  end if;

  select coalesce(array_agg((section->>'id')::uuid), '{}')
  into v_section_ids
  from jsonb_array_elements(p_sections) section;

  delete from public.detail_page_sections
  where detail_page_id = p_page_id
    and not (id = any(v_section_ids));

  insert into public.detail_page_sections (
    id, detail_page_id, section_type, sort_order, is_visible, content, images
  )
  select
    (section->>'id')::uuid,
    p_page_id,
    section->>'section_type',
    coalesce((section->>'sort_order')::integer, ordinality::integer),
    coalesce((section->>'is_visible')::boolean, true),
    coalesce(section->'content', '{}'::jsonb),
    coalesce(section->'images', '[]'::jsonb)
  from jsonb_array_elements(p_sections) with ordinality as rows(section, ordinality)
  on conflict (id) do update
  set section_type = excluded.section_type,
      sort_order = excluded.sort_order,
      is_visible = excluded.is_visible,
      content = excluded.content,
      images = excluded.images
  where public.detail_page_sections.detail_page_id = p_page_id;

  return v_updated_at;
end;
$$;

revoke all on function public.save_product_detail_page(uuid, jsonb, jsonb) from public;
grant execute on function public.save_product_detail_page(uuid, jsonb, jsonb) to authenticated;
