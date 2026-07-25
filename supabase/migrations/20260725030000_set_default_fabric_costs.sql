alter table public.fundings
  alter column fabric_unit_cost set default 10000;

update public.fundings
set fabric_unit_cost = case
  when material ~* '(데님|denim|레더|leather|가죽)' then 15000
  else 10000
end
where fabric_unit_cost = 0;
