-- Supabase can retain explicit default grants for API roles even after a
-- function-level PUBLIC revoke. Keep creator mutations unavailable to anon.
revoke execute on function public.update_creator_funding(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text[],
  text[],
  jsonb
) from anon;

grant execute on function public.update_creator_funding(
  uuid,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text[],
  text[],
  jsonb
) to authenticated;

revoke execute on function public.save_my_brand_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from anon;

grant execute on function public.save_my_brand_profile(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

revoke execute on function public.submit_funding_for_review(uuid) from anon;
grant execute on function public.submit_funding_for_review(uuid) to authenticated;

create index if not exists brands_creator_profile_user_id_idx
  on public.brands(creator_profile_user_id);
