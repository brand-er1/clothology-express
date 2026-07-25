create table if not exists public.quote_material_surcharges (
  material_key text primary key,
  material_label text not null,
  aliases text[] not null default '{}',
  sample_surcharge integer not null default 0 check (sample_surcharge >= 0),
  production_unit_surcharge integer not null default 0
    check (production_unit_surcharge >= 0),
  pricing_note text,
  source_label text not null default '브랜더 운영 단가',
  source_version text not null default '2026-07-25',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quote_material_surcharges enable row level security;

drop policy if exists "Authenticated users can read material quote surcharges"
  on public.quote_material_surcharges;
create policy "Authenticated users can read material quote surcharges"
  on public.quote_material_surcharges
  for select
  to authenticated
  using (active);

comment on table public.quote_material_surcharges is
  '소재 선택에 따라 추가되는 1회 샘플비와 장당 생산공임';

insert into public.quote_material_surcharges (
  material_key,
  material_label,
  aliases,
  sample_surcharge,
  production_unit_surcharge,
  pricing_note
)
values
  (
    'denim',
    '데님',
    array['데님', 'denim', '청지'],
    50000,
    2000,
    '데님 소재는 샘플비 50,000원과 생산공임 장당 2,000원이 추가됩니다.'
  ),
  (
    'leather',
    '레더',
    array['레더', '가죽', 'leather', '비건 레더', '인조가죽'],
    50000,
    2000,
    '레더 소재는 샘플비 50,000원과 생산공임 장당 2,000원이 추가됩니다.'
  )
on conflict (material_key) do update
set
  material_label = excluded.material_label,
  aliases = excluded.aliases,
  sample_surcharge = excluded.sample_surcharge,
  production_unit_surcharge = excluded.production_unit_surcharge,
  pricing_note = excluded.pricing_note,
  source_label = excluded.source_label,
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
values (
  'washing_finish',
  '워싱 가공',
  array['washing'],
  10000,
  10000,
  false,
  '생성 이미지에서 워싱이 확인되면 장당 10,000원이 추가됩니다.',
  '브랜더 운영 단가',
  '2026-07-25'
)
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
