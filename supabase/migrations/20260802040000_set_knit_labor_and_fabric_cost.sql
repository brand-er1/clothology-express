-- 니트 생산 공임·평균 원단비와 패치 전용 안내를 반영한다.

update public.quote_garment_prices
set production_min = 20000,
    production_max = 20000,
    production_is_starting_from = false,
    pricing_note = '장당 생산 공임 20,000원 기준입니다. 평균 원단비 13,000원/장은 별도이며, 로고·이미지는 프린팅·직자수 없이 패치 방식만 가능합니다. 패턴비 대신 프로그램비 150,000원이 적용되고 생산 필수·MOQ 총 100장 이상입니다.',
    source_version = '2026-08-02',
    updated_at = now()
where category_key = 'knit';

update public.fundings
set fabric_unit_cost = 13000,
    updated_at = now()
where status in ('pending', 'rejected')
  and lower(coalesce(cloth_type, '')) ~ '(니트|knit)'
  and fabric_unit_cost in (0, 10000);

create or replace function public.apply_funding_minimum_moq()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.moq := greatest(
    coalesce(new.moq, 20),
    public.minimum_funding_moq(new.cloth_type, new.material)
  );

  if lower(coalesce(new.cloth_type, '')) ~ '(니트|knit)'
    and coalesce(new.fabric_unit_cost, 0) in (0, 10000) then
    new.fabric_unit_cost := 13000;
  end if;

  return new;
end;
$$;

comment on function public.apply_funding_minimum_moq() is
  '카테고리별 최소 MOQ와 니트 기본 원단비 13,000원을 적용';
