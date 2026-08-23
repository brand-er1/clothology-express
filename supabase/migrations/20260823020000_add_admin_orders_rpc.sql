-- The admin "제작 의뢰 관리" screen has always read orders directly
-- (select * from orders, filtered by the browser), relying on an RLS policy on
-- `orders` that predates this migrations folder and that we can't inspect here.
-- A guest ready-made-group-wear order (user_id null, confirmed live in
-- production) submitted successfully but never appeared for the admin even
-- after a hard refresh — while the same admin already sees every other order
-- type (all of which have a non-null user_id) without issue. That points at
-- the existing orders SELECT policy not accounting for a null user_id, and
-- since we can't see or safely rewrite a policy we don't have the definition
-- of, the fix follows this codebase's own established pattern for every other
-- admin list (get_admin_generated_images, get_admin_customers,
-- get_admin_closet_activity, ...): a SECURITY DEFINER RPC that checks
-- is_admin() itself and then bypasses table RLS entirely, rather than relying
-- on it.
create or replace function public.get_admin_orders()
returns setof public.orders
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  return query
  select *
  from public.orders
  where status not in ('draft', 'deleted')
  order by created_at desc;
end;
$$;

revoke all on function public.get_admin_orders() from public;
grant execute on function public.get_admin_orders() to authenticated;
