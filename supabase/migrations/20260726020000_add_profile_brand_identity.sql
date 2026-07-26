alter table public.profiles
  add column if not exists brand_name text;

comment on column public.profiles.brand_name is
  'Public-facing brand name selected by the member. It is not a trademark ownership verification.';

update public.profiles as profile
set brand_name = nullif(trim(auth_user.raw_user_meta_data ->> 'brand_name'), '')
from auth.users as auth_user
where auth_user.id = profile.id
  and profile.brand_name is null
  and nullif(trim(auth_user.raw_user_meta_data ->> 'brand_name'), '') is not null;

create or replace function public.sync_profile_brand_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    username = coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
      username
    ),
    brand_name = coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'brand_name'), ''),
      brand_name
    )
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists zz_sync_profile_brand_identity on auth.users;

create trigger zz_sync_profile_brand_identity
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_profile_brand_identity();
