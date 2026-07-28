create index if not exists generated_images_user_created_at_idx
  on public.generated_images (user_id, created_at desc);

create or replace function public.get_admin_generated_images()
returns table (
  id uuid,
  user_id uuid,
  image_url text,
  image_path text,
  cloth_type text,
  material text,
  detail text,
  prompt text,
  generation_prompt text,
  created_at timestamptz,
  brand_name text,
  customer_name text,
  username text,
  phone_number text,
  conversion_status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
  select
    generated.id,
    generated.user_id,
    coalesce(generated.stored_image_url, generated.original_image_url) as image_url,
    generated.image_path,
    generated.cloth_type,
    generated.material,
    generated.detail,
    generated.prompt,
    generated.generation_prompt,
    generated.created_at,
    profile.brand_name,
    profile.full_name as customer_name,
    profile.username,
    profile.phone_number,
    case
      when exists (
        select 1
        from public.fundings funding
        where funding.creator_id = generated.user_id
          and (
            (
              generated.image_path is not null
              and funding.image_path = generated.image_path
            )
            or funding.image_url = generated.stored_image_url
            or funding.image_url = generated.original_image_url
          )
      ) then 'funding'
      when exists (
        select 1
        from public.orders production_order
        where production_order.user_id = generated.user_id
          and production_order.status::text not in ('draft', 'deleted')
          and (
            (
              generated.image_path is not null
              and production_order.image_path = generated.image_path
            )
            or production_order.generated_image_url = generated.stored_image_url
            or production_order.generated_image_url = generated.original_image_url
          )
      ) then 'direct'
      else 'image_only'
    end as conversion_status
  from public.generated_images generated
  left join public.profiles profile on profile.id = generated.user_id
  order by generated.created_at desc;
end;
$$;

revoke all on function public.get_admin_generated_images() from public;
grant execute on function public.get_admin_generated_images() to authenticated;
