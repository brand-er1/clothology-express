-- Female size 77 was removed from the product. Normalize any pre-release rows and enforce the
-- gender-specific preset list at the database boundary so stale clients cannot reintroduce it.

update public.outfits
set mannequin_size = case
  when character_gender = 'female' and lower(coalesce(mannequin_size, '')) in ('44', '55', '66')
    then lower(mannequin_size)
  when character_gender = 'female' then '55'
  when lower(coalesce(mannequin_size, '')) in ('l', 'xl', '2xl')
    then lower(mannequin_size)
  else 'l'
end;

create or replace function public.normalize_outfit_mannequin_size()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.character_gender = 'female' then
    new.mannequin_size := case
      when lower(coalesce(new.mannequin_size, '')) in ('44', '55', '66')
        then lower(new.mannequin_size)
      else '55'
    end;
  else
    new.mannequin_size := case
      when lower(coalesce(new.mannequin_size, '')) in ('l', 'xl', '2xl')
        then lower(new.mannequin_size)
      else 'l'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_outfit_mannequin_size_trigger on public.outfits;
create trigger normalize_outfit_mannequin_size_trigger
before insert or update of character_gender, mannequin_size on public.outfits
for each row execute function public.normalize_outfit_mannequin_size();

alter table public.outfits alter column mannequin_size set not null;
alter table public.outfits drop constraint if exists outfits_mannequin_size_matches_gender;
alter table public.outfits add constraint outfits_mannequin_size_matches_gender check (
  (character_gender = 'female' and mannequin_size in ('44', '55', '66'))
  or (character_gender = 'male' and mannequin_size in ('l', 'xl', '2xl'))
);

comment on column public.outfits.mannequin_size is
  '저장 시점의 마네킹 체형 사이즈 (여성: 44/55/66, 남성: l/xl/2xl).';
