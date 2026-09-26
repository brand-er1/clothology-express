-- hash of legacy business rows restricted to pre-existing columns
select 'profiles', md5(string_agg(md5(row(id,full_name,username,phone_number,address,brand_name,account_type)::text), ',' order by id)) from public.profiles
union all select 'fundings', md5(string_agg(md5(row(id,creator_id,brand_id,product_name,status,moq,price,current_orders,reviewed_at)::text), ',' order by id)) from public.fundings
union all select 'participations', md5(string_agg(md5(row(id,funding_id,participant_id,quantity,unit_price,total_amount,status,payment_provider,payment_status,partner_order_id,payment_approved_at,orderer_name,shipping_address,production_stage,shipping_status)::text), ',' order by id)) from public.funding_participations
union all select 'brands', md5(string_agg(md5(row(id,owner_user_id,brand_name,status)::text), ',' order by id)) from public.brands
union all select 'comments', md5(string_agg(md5(row(id,content,is_deleted)::text), ',' order by id)) from public.community_comments
union all select 'reports', md5(string_agg(md5(row(id,status,reason)::text), ',' order by id)) from public.community_reports
union all select 'user_roles', md5(string_agg(md5(row(user_id,role)::text), ',' order by user_id)) from public.user_roles
order by 1;
