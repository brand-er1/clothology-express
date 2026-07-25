create table if not exists public.quote_garment_prices (
  category_key text primary key,
  category_label text not null,
  aliases text[] not null default '{}',
  production_min integer,
  production_max integer,
  production_is_starting_from boolean not null default false,
  pattern_cost integer not null check (pattern_cost >= 0),
  sample_cost integer not null check (sample_cost >= 0),
  moq integer not null default 20 check (moq > 0),
  pricing_note text,
  source_file text not null,
  source_version text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint quote_garment_production_min_check
    check (production_min is null or production_min >= 0),
  constraint quote_garment_production_max_check
    check (production_max is null or production_max >= 0),
  constraint quote_garment_production_range_check
    check (
      production_min is null
      or production_max is null
      or production_max >= production_min
    )
);

create table if not exists public.quote_decoration_prices (
  price_key text primary key,
  price_label text not null,
  analysis_kinds text[] not null default '{}',
  unit_min integer not null check (unit_min >= 0),
  unit_max integer not null check (unit_max >= unit_min),
  is_starting_from boolean not null default false,
  pricing_note text,
  source_file text not null,
  source_version text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.quote_garment_prices enable row level security;
alter table public.quote_decoration_prices enable row level security;

drop policy if exists "Authenticated users can read garment quote prices"
  on public.quote_garment_prices;
create policy "Authenticated users can read garment quote prices"
  on public.quote_garment_prices
  for select
  to authenticated
  using (active);

drop policy if exists "Authenticated users can read decoration quote prices"
  on public.quote_decoration_prices;
create policy "Authenticated users can read decoration quote prices"
  on public.quote_decoration_prices
  for select
  to authenticated
  using (active);

comment on table public.quote_garment_prices is
  '브랜더 엑셀 단가표에서 이관한 의류별 생산·패턴·샘플 견적 데이터';
comment on table public.quote_decoration_prices is
  '브랜더 엑셀 단가표에서 이관한 위치별 프린팅·후가공 견적 데이터';

insert into public.quote_garment_prices (
  category_key,
  category_label,
  aliases,
  production_min,
  production_max,
  production_is_starting_from,
  pattern_cost,
  sample_cost,
  moq,
  pricing_note,
  source_file,
  source_version
)
values
  ('short_sleeve', '반팔 티셔츠', array['반팔', '티셔츠', 't-shirt'], 8000, 10000, false, 80000, 80000, 20, '기능성 의류(타이즈)는 추가 비용이 발생할 수 있습니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('long_sleeve', '긴팔 티셔츠', array['긴팔', '긴소매', 'long sleeve'], 10000, 15000, false, 100000, 100000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('sweatshirt', '맨투맨', array['맨투맨', '스웨트셔츠', 'sweatshirt'], 18000, 18000, false, 120000, 120000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('hoodie', '후드티', array['후드', '후드티', 'hoodie'], 20000, 20000, false, 150000, 150000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('jogger_pants', '조거팬츠', array['조거팬츠', '스웨트팬츠', 'jogger'], 20000, 30000, false, 120000, 130000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('pants', '일반 팬츠', array['팬츠', '긴바지', '슬랙스', 'trousers'], 23000, 33000, false, 150000, 150000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('short_pants', '반바지', array['반바지', '쇼츠', 'shorts'], 23000, 33000, false, 120000, 120000, 20, '반바지는 의류 공임표의 일반 팬츠 공임을 적용합니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('denim_pants', '데님 팬츠', array['데님', '청바지', 'jeans'], 30000, 55000, false, 250000, 300000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('shirt', '셔츠', array['셔츠', '남방', 'shirt'], 25000, 25000, false, 230000, 270000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('skirt', '스커트', array['스커트', '치마', 'skirt'], 22000, 22000, true, 150000, 170000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('dress', '원피스', array['원피스', '드레스', 'dress'], 30000, 30000, true, 170000, 190000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('vest', '베스트', array['베스트', '조끼', 'vest'], 20000, 35000, false, 80000, 80000, 20, null, '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('jumper', '점퍼', array['점퍼', '블루종', 'jumper'], 35000, 50000, false, 230000, 250000, 20, '기본 사양 기준입니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('jumper_lined', '점퍼(안감)', array['안감 점퍼', 'lined jumper'], 35000, 50000, false, 350000, 430000, 20, '안감 포함 기준입니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('jacket', '자켓', array['자켓', '재킷', 'jacket'], 45000, 50000, false, 200000, 200000, 20, '기본 사양 기준입니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('jacket_lined', '자켓(안감)', array['안감 자켓', 'lined jacket'], 45000, 50000, false, 300000, 400000, 20, '안감 포함 기준입니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('padding', '패딩 / 헤비 아우터', array['패딩', '다운', '헤비 아우터', 'puffer'], 60000, 100000, true, 400000, 800000, 200, '샘플만 진행할 수 없으며 생산 필수·MOQ 총 200장 기준입니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('knit', '니트', array['니트', '스웨터', 'knit'], null, null, false, 150000, 300000, 100, '패턴비 대신 프로그램비 150,000원이 적용됩니다. 샘플만 진행할 수 없으며 생산 필수·MOQ 총 100장 이상입니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25')
on conflict (category_key) do update
set
  category_label = excluded.category_label,
  aliases = excluded.aliases,
  production_min = excluded.production_min,
  production_max = excluded.production_max,
  production_is_starting_from = excluded.production_is_starting_from,
  pattern_cost = excluded.pattern_cost,
  sample_cost = excluded.sample_cost,
  moq = excluded.moq,
  pricing_note = excluded.pricing_note,
  source_file = excluded.source_file,
  source_version = excluded.source_version,
  active = true,
  updated_at = now();

insert into public.quote_decoration_prices (
  price_key,
  price_label,
  analysis_kinds,
  unit_min,
  unit_max,
  is_starting_from,
  pricing_note,
  source_file,
  source_version
)
values
  ('screen_print_1_color', '실크스크린(1도)', array['screen_print_1_color', 'unknown_print'], 2000, 3000, false, '색상 추가 시 비용이 증가합니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('screen_print_multi_color', '실크스크린(2~4도)', array['screen_print_multi_color'], 3000, 6000, false, '도수별 추가 비용이 발생합니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('dtf', 'DTF', array['dtf', 'transfer'], 8000, 8000, true, '사이즈에 따라 변동됩니다. 일반 전사는 DTF 기준으로 계산합니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('dtg', 'DTG', array['dtg'], 8000, 8000, true, '사이즈에 따라 변동됩니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('pu_high_frequency', 'PU / 고주파 패치', array['pu'], 5000, 5000, true, '소량 제작 시 별도 금형비(250,000원 이상)가 발생할 수 있습니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('embroidery', '자수', array['embroidery'], 4000, 4000, true, '면적·땀수에 따라 변동됩니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('patch_attach', '와펜 부착', array['patch'], 2000, 5000, false, '와펜 제작비는 별도입니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25'),
  ('silicone_patch', '실리콘 나염 / 패치', array['silicone_print'], 5000, 10000, false, '실리콘 패치 제작비는 별도입니다.', '브랜더_제작단가_통합표(1).xlsx', '2026-07-25')
on conflict (price_key) do update
set
  price_label = excluded.price_label,
  analysis_kinds = excluded.analysis_kinds,
  unit_min = excluded.unit_min,
  unit_max = excluded.unit_max,
  is_starting_from = excluded.is_starting_from,
  pricing_note = excluded.pricing_note,
  source_file = excluded.source_file,
  source_version = excluded.source_version,
  active = true,
  updated_at = now();

