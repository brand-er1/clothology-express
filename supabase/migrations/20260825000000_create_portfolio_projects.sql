-- Backs the redesigned "포트폴리오" (Selected Works) page. The 12 pieces shown there today
-- live only in a static frontend file (src/data/portfolioProducts.ts) with no way for an admin
-- to edit copy, add extra gallery images, reorder, or hide a project without a code change. This
-- table makes that content admin-manageable while the static file stays untouched as a fallback
-- (used elsewhere on the homepage teaser, and as a safety net if this table is ever empty).
create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  name_ko text not null,
  name_en text not null,
  category text not null,
  main_image_path text not null,
  -- Extra gallery images beyond the main image (finished product, lookbook, detail, fabric,
  -- printing/embroidery, pattern/sample, production process) — each a storage path or URL.
  additional_image_paths jsonb not null default '[]'::jsonb,
  country text,
  quantity text,
  -- Production services used on this project, e.g. ["Design","Fabric","Pattern","Sample","Production"].
  services jsonb not null default '[]'::jsonb,
  description text,
  is_visible boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portfolio_projects_display_order_idx
  on public.portfolio_projects (display_order);

alter table public.portfolio_projects enable row level security;

drop policy if exists "Visible portfolio projects are public" on public.portfolio_projects;
create policy "Visible portfolio projects are public"
  on public.portfolio_projects for select
  using (is_visible or public.is_admin(auth.uid()));

drop policy if exists "Admins can manage portfolio projects" on public.portfolio_projects;
create policy "Admins can manage portfolio projects"
  on public.portfolio_projects for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

comment on table public.portfolio_projects is
  '포트폴리오(Selected Works) 프로젝트 — 관리자 화면에서 프로젝트명/이미지/카테고리/제작국가/수량/서비스/설명/노출여부/노출순서를 관리한다.';
comment on column public.portfolio_projects.main_image_path is
  '대표 이미지 경로 또는 URL (정적 파일 경로 "/portfolio/xxx.webp" 또는 Storage 공개 URL 모두 허용)';
comment on column public.portfolio_projects.additional_image_paths is
  '추가 이미지 배열 — 완성 제품/룩북/디테일/원단/프린팅·자수/패턴·샘플/생산 과정 등';
comment on column public.portfolio_projects.services is
  '제작 서비스 배열 — 예: ["Design","Fabric","Pattern","Sample","Printing","Production"]';

-- Seed from the existing static portfolio data (src/data/portfolioProducts.ts) so nothing already
-- shown on the site is lost — this table becomes the new source of truth going forward, the
-- static file stays as-is for the homepage teaser and as a fallback.
insert into public.portfolio_projects
  (name_ko, name_en, category, main_image_path, display_order, is_visible)
values
  ('퍼포먼스 쇼츠', 'PERFORMANCE SHORTS', 'BOTTOM', '/portfolio/performance-shorts.webp', 1, true),
  ('벌룬 카고 쇼츠', 'BALLOON CARGO SHORTS', 'BOTTOM', '/portfolio/balloon-cargo-shorts.webp', 2, true),
  ('와이드 트라우저', 'WIDE TROUSERS', 'BOTTOM', '/portfolio/wide-trousers.webp', 3, true),
  ('카모 헨리넥', 'CAMO HENLEY', 'TOP', '/portfolio/camo-henley.webp', 4, true),
  ('롤드 헴 롱슬리브', 'ROLLED HEM LONG SLEEVE', 'TOP', '/portfolio/rolled-hem-long-sleeve.webp', 5, true),
  ('버건디 레더 재킷', 'BURGUNDY LEATHER JACKET', 'OUTER', '/portfolio/burgundy-leather-jacket.webp', 6, true),
  ('후드 풀오버', 'HOOD PULLOVER', 'HOODIE', '/portfolio/hood-pullover.webp', 7, true),
  ('히든 셔츠', 'HIDDEN SHIRT', 'TOP', '/portfolio/hidden-shirt.webp', 8, true),
  ('워크 재킷', 'WORK JACKET', 'OUTER', '/portfolio/work-jacket.webp', 9, true),
  ('리브 하프집업', 'RIB HALF-ZIP', 'TOP', '/portfolio/rib-half-zip.webp', 10, true),
  ('테크니컬 셸', 'TECHNICAL SHELL', 'TECHNICAL', '/portfolio/technical-shell.webp', 11, true),
  ('스터드 후디', 'STUDDED HOODIE', 'HOODIE', '/portfolio/studded-hoodie.webp', 12, true)
on conflict do nothing;
