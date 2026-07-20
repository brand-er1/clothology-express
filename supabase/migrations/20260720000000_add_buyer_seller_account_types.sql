alter table public.profiles
  add column if not exists account_type text not null default 'seller';

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('seller', 'buyer'));

update public.profiles as profile
set account_type = case
  when auth_user.raw_user_meta_data ->> 'account_type' = 'buyer' then 'buyer'
  else 'seller'
end
from auth.users as auth_user
where auth_user.id = profile.id;

create or replace function public.sync_profile_account_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set account_type = case
    when new.raw_user_meta_data ->> 'account_type' = 'buyer' then 'buyer'
    else 'seller'
  end
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists zz_sync_profile_account_type on auth.users;

create trigger zz_sync_profile_account_type
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.sync_profile_account_type();

