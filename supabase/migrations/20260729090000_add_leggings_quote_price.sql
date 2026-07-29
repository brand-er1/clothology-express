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
values (
  'leggings',
  '레깅스',
  array['레깅스', 'leggings', '요가 레깅스', '스포츠 레깅스'],
  17000,
  17000,
  false,
  120000,
  120000,
  20,
  '기본 레깅스 기준입니다. 프린팅·자수·워싱·부자재는 분석 결과에 따라 별도 합산됩니다.',
  '브랜더 운영 단가',
  '2026-07-29'
)
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

comment on column public.quote_garment_prices.category_key is
  '타이즈 가격은 별도 행을 만들지 않고 견적 함수에서 반팔·긴팔·일반 팬츠 행을 참조한다.';
