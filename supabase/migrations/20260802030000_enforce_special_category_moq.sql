-- 니트와 레더 자켓은 생산처 기준 MOQ 100장을 공통 적용한다.

create or replace function public.minimum_funding_moq(
  p_cloth_type text,
  p_material text
)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(p_cloth_type, '')) ~ '(니트|knit)'
      then 100
    when lower(coalesce(p_cloth_type, '')) ~ '(자켓|재킷|jacket)'
      and (
        lower(coalesce(p_cloth_type, '')) ~ '(레더|가죽|leather)'
        or lower(coalesce(p_material, '')) ~ '(레더|가죽|leather)'
      )
      then 100
    else 20
  end;
$$;

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
  return new;
end;
$$;

drop trigger if exists apply_funding_minimum_moq on public.fundings;
create trigger apply_funding_minimum_moq
before insert or update of cloth_type, material, moq
on public.fundings
for each row
execute function public.apply_funding_minimum_moq();

update public.fundings
set moq = public.minimum_funding_moq(cloth_type, material)
where status in ('pending', 'rejected')
  and moq < public.minimum_funding_moq(cloth_type, material);

update public.quote_garment_prices
set moq = 100,
    updated_at = now()
where category_key = 'knit';

comment on function public.minimum_funding_moq(text, text) is
  '기본 MOQ 20장, 니트 및 레더 자켓 MOQ 100장 규칙';
