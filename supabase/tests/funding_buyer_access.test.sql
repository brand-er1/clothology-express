-- 구매자 관리 권한 테스트 (로컬 Postgres + Supabase auth 스텁에서 전체 migration 적용 후 실행)
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/funding_buyer_access.test.sql
-- 실패하면 예외로 중단된다. 마지막에 'ALL BUYER ACCESS TESTS PASSED' 가 출력되면 성공.
-- 전체를 하나의 트랜잭션으로 실행하고 롤백하므로 데이터가 남지 않는다.

begin;

-- 시드는 상표 검수·알림 등 이 기능과 무관한 트리거를 끄고 넣는다(테스트 대상 RPC/RLS 에는 영향 없음).
set local session_replication_role = replica;

-- ---------------------------------------------------------------------------
-- 시드: 제작자 A/B, 일반 구매자, Super Admin, CS Admin
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'creator-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'creator-b@test.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'buyer@test.local'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000c5', 'cs@test.local');

insert into public.profiles (id, full_name, phone_number, address) values
  ('00000000-0000-0000-0000-00000000000a', '제작자에이', '01011112222', null),
  ('00000000-0000-0000-0000-00000000000b', '제작자비', '01033334444', null),
  ('00000000-0000-0000-0000-0000000000c1', '김구매', '01012345678', '서울특별시 강남구 테헤란로 1'),
  ('00000000-0000-0000-0000-0000000000ad', '관리자', null, null),
  ('00000000-0000-0000-0000-0000000000c5', '상담원', null, null)
on conflict (id) do update set full_name = excluded.full_name, phone_number = excluded.phone_number, address = excluded.address;

insert into public.admin_members (user_id, role, status) values
  ('00000000-0000-0000-0000-0000000000ad', 'super_admin', 'active'),
  ('00000000-0000-0000-0000-0000000000c5', 'cs_admin', 'active');

insert into public.creator_profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', '크리에이터 A'),
  ('00000000-0000-0000-0000-00000000000b', '크리에이터 B');

insert into public.brands (id, owner_user_id, creator_profile_user_id, brand_name) values
  ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', '브랜드에이'),
  ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '브랜드비');

insert into public.fundings (id, creator_id, brand_id, product_name, cloth_type, material, size, image_url, moq, status, color_options, size_options)
values
  ('00000000-0000-0000-0000-00000000f00a', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000ba',
   '에이 후드티', 'hoodie', 'cotton', 'M', 'https://example.com/a.png', 20, 'pending', array['BLACK','WHITE'], array['S','M','L']),
  ('00000000-0000-0000-0000-00000000f00b', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000bb',
   '비 티셔츠', 'tshirt', 'cotton', 'M', 'https://example.com/b.png', 20, 'pending', array['NAVY'], array['M']);

insert into public.funding_participations (
  id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price,
  status, payment_provider, payment_status, payment_approved_at, partner_order_id,
  orderer_name, orderer_phone, orderer_email, recipient_name, recipient_phone, postal_code,
  shipping_address, shipping_address_detail, delivery_message, courier, tracking_number, shipping_status
) values
  ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000f00a', '00000000-0000-0000-0000-0000000000c1',
   'BLACK', 'M', 2, 39000, 'pledged', 'mock', 'paid', now(), 'BRANDER-A-0001',
   '김구매', '010-1234-5678', 'buyer@test.local', '김수령', '010-9876-5432', '06236',
   '서울특별시 강남구 테헤란로 1', '101동 202호', '문 앞에 놓아주세요', 'CJ대한통운', '012345678901', 'shipped'),
  ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-00000000f00a', '00000000-0000-0000-0000-0000000000c1',
   'WHITE', 'L', 1, 39000, 'pledged', 'mock', 'ready', null, 'BRANDER-A-0002',
   '김구매', '010-1234-5678', null, null, null, '01234', '부산광역시 해운대구', null, null, null, null, 'preparing'),
  ('00000000-0000-0000-0000-0000000a0003', '00000000-0000-0000-0000-00000000f00a', '00000000-0000-0000-0000-0000000000c1',
   'BLACK', 'S', 3, 39000, 'cancelled', 'mock', 'cancelled', now(), 'BRANDER-A-0003',
   '김구매', '010-1234-5678', null, null, null, null, null, null, null, null, null, 'preparing'),
  ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-00000000f00b', '00000000-0000-0000-0000-0000000000c1',
   'NAVY', 'M', 5, 29000, 'pledged', 'mock', 'paid', now(), 'BRANDER-B-0001',
   '이비밀', '010-5555-6666', 'secret@test.local', '이비밀', '010-5555-6666', '04524',
   '서울특별시 중구 세종대로 110', null, null, null, null, 'preparing');

set local session_replication_role = origin;

grant usage on schema public to authenticated, anon;

-- 공통 헬퍼: 지정한 사용자로 호출했을 때 42501(권한 없음)로 거부되는지
create or replace function pg_temp.expect_denied(p_sql text, p_label text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL [%]: 권한 없는 호출이 성공했습니다', p_label;
exception
  when insufficient_privilege then null; -- 42501 (RPC 거부 또는 EXECUTE 권한 없음)
end;
$$;

create or replace function pg_temp.assert(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAIL [%]', p_label; end if;
end;
$$;

grant execute on function pg_temp.expect_denied(text, text) to authenticated, anon;
grant execute on function pg_temp.assert(boolean, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 1. 관리자: 모든 펀딩 구매자 조회
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', true);

select pg_temp.assert(jsonb_array_length(public.get_funding_buyers('00000000-0000-0000-0000-00000000f00a')->'rows') = 3, '1. admin funding A');
select pg_temp.assert(jsonb_array_length(public.get_funding_buyers('00000000-0000-0000-0000-00000000f00b')->'rows') = 1, '1. admin funding B');
select pg_temp.assert(public.get_funding_buyers('00000000-0000-0000-0000-00000000f00b')->>'access' = 'admin', '1. admin access label');
select pg_temp.assert((public.admin_list_buyers()->>'total')::int = 4, '1. admin list all');
select pg_temp.assert((public.admin_list_buyers(p_brand_id => '00000000-0000-0000-0000-0000000000bb')->>'total')::int = 1, '1. admin by brand');
select pg_temp.assert((public.admin_list_buyers(p_creator_id => '00000000-0000-0000-0000-00000000000a')->>'total')::int = 3, '1. admin by creator');
select pg_temp.assert((public.admin_list_buyers(p_status => 'cancelled')->>'total')::int = 1, '1. admin status cancelled');
select pg_temp.assert((public.admin_list_buyers(p_status => 'shipped')->>'total')::int = 1, '1. admin status shipped');
select pg_temp.assert((public.admin_list_buyers(p_status => 'pending')->>'total')::int = 1, '1. admin status pending');
select pg_temp.assert((public.admin_list_buyers(p_search => '5432')->>'total')::int = 1, '1. admin search recipient phone digits');
select pg_temp.assert((public.admin_list_buyers(p_search => 'BRANDER-B')->>'total')::int = 1, '1. admin search order number');
select pg_temp.assert((public.admin_list_buyers(p_search => '이비밀')->>'total')::int = 1, '1. admin search korean name');
select pg_temp.assert((public.admin_list_buyers(p_limit => 2, p_offset => 2)->'rows') is not null
  and jsonb_array_length(public.admin_list_buyers(p_limit => 2, p_offset => 2)->'rows') = 2, '1. admin paging');
select pg_temp.assert((public.admin_list_buyers()->'summary'->>'quantity')::int = 7, '1. admin summary paid quantity (2+5)');
select pg_temp.assert(jsonb_array_length(public.admin_buyer_filter_options()->'fundings') = 2, '1. admin filter options');
select pg_temp.assert((public.admin_export_buyers(p_scope => 'all', p_reason => '배송 준비')->>'count')::int = 4, '1. admin export all');
-- 사유 누락은 일반 오류(P0001)로 거부된다
do $$ begin
  perform public.admin_export_buyers(p_reason => '');
  raise exception 'FAIL [1. admin export without reason succeeded]';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
end $$;

-- CS Admin 도 orders.pii 가 있으므로 조회 가능
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c5', true);
select pg_temp.assert((public.admin_list_buyers()->>'total')::int = 4, '1. cs admin with orders.pii');

-- ---------------------------------------------------------------------------
-- 2. 제작자 A: 본인 펀딩 구매자 조회 / 3. 제작자 B 의 구매자 조회 불가
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);

select pg_temp.assert(jsonb_array_length(public.get_funding_buyers('00000000-0000-0000-0000-00000000f00a')->'rows') = 3, '2. creator A own funding');
select pg_temp.assert(public.get_funding_buyers('00000000-0000-0000-0000-00000000f00a')->>'access' = 'creator', '2. creator access label');
select pg_temp.assert((public.export_funding_buyers('00000000-0000-0000-0000-00000000f00a')->>'count')::int = 3, '2. creator A export own');
select pg_temp.assert((public.export_funding_buyers('00000000-0000-0000-0000-00000000f00a',
  array['00000000-0000-0000-0000-0000000a0001']::uuid[], 'selected')->>'count')::int = 1, '2. creator A export selected');

select pg_temp.expect_denied($q$select public.get_funding_buyers('00000000-0000-0000-0000-00000000f00b')$q$, '3. A reads B funding');
select pg_temp.expect_denied($q$select public.export_funding_buyers('00000000-0000-0000-0000-00000000f00b')$q$, '3. A exports B funding');
select pg_temp.expect_denied($q$select public.get_funding_buyers('00000000-0000-0000-0000-0000deadbeef')$q$, '3. unknown funding id');
select pg_temp.expect_denied($q$select public.admin_list_buyers()$q$, '3. creator calls admin list');
select pg_temp.expect_denied($q$select public.admin_export_buyers(p_reason => 'x y')$q$, '3. creator calls admin export');
select pg_temp.expect_denied($q$select public.admin_buyer_filter_options()$q$, '3. creator calls admin options');
-- B 의 주문 ID 를 A 의 펀딩 export 에 섞어 넣어도 반환되지 않는다
select pg_temp.assert((public.export_funding_buyers('00000000-0000-0000-0000-00000000f00a',
  array['00000000-0000-0000-0000-0000000b0001']::uuid[], 'selected')->>'count')::int = 0, '3. B order id smuggled into A export');
-- 내부 함수 직접 호출 불가
select pg_temp.expect_denied($q$select * from public._funding_buyer_rows()$q$, '3. internal rows fn');
select pg_temp.expect_denied($q$select public._funding_buyer_access('00000000-0000-0000-0000-00000000f00a')$q$, '3. internal access fn');
-- RLS: 테이블 직접 조회 시 본인 펀딩 주문만 보인다
select pg_temp.assert((select count(*) from public.funding_participations) = 3, '3. RLS creator A sees only own funding rows');
select pg_temp.assert(not exists (select 1 from public.funding_participations where funding_id = '00000000-0000-0000-0000-00000000f00b'), '3. RLS hides B rows');
-- 다운로드 기록: 직접 쓰기 불가, 본인 기록만 조회
select pg_temp.expect_denied($q$insert into public.buyer_export_logs (actor_id, actor_role, scope) values (auth.uid(), 'creator', 'all')$q$, '3. direct log insert');
select pg_temp.assert((select count(*) from public.buyer_export_logs) = 3 and not exists (select 1 from public.buyer_export_logs where actor_id <> auth.uid()), '3. creator sees own export logs only');

-- ---------------------------------------------------------------------------
-- 4. 일반 구매자: 구매자 명단 접근 불가 (본인 주문만 RLS 로 조회)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select pg_temp.expect_denied($q$select public.get_funding_buyers('00000000-0000-0000-0000-00000000f00a')$q$, '4. buyer reads list');
select pg_temp.expect_denied($q$select public.export_funding_buyers('00000000-0000-0000-0000-00000000f00a')$q$, '4. buyer exports');
select pg_temp.expect_denied($q$select public.admin_list_buyers()$q$, '4. buyer admin list');
select pg_temp.assert((select count(*) from public.buyer_export_logs) = 0, '4. buyer sees no export logs');

-- ---------------------------------------------------------------------------
-- 5/6. 비로그인(anon) · 직접 API 호출
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_denied($q$select public.get_funding_buyers('00000000-0000-0000-0000-00000000f00a')$q$, '5. anon list');
select pg_temp.expect_denied($q$select public.export_funding_buyers('00000000-0000-0000-0000-00000000f00a')$q$, '5. anon export');
select pg_temp.expect_denied($q$select public.admin_list_buyers()$q$, '5. anon admin list');
-- authenticated 역할이지만 sub 가 없는 토큰
reset role;
set local role authenticated;
select pg_temp.expect_denied($q$select public.get_funding_buyers('00000000-0000-0000-0000-00000000f00a')$q$, '6. authenticated without uid');

-- ---------------------------------------------------------------------------
-- 7/8/9. 엑셀 데이터 = 주문 DB / 한글 / 전화번호 앞자리 0
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $$
declare
  v_row jsonb;
begin
  select r into v_row
  from jsonb_array_elements(public.export_funding_buyers('00000000-0000-0000-0000-00000000f00a')->'rows') r
  where r->>'id' = '00000000-0000-0000-0000-0000000a0001';

  perform pg_temp.assert(v_row->>'order_number' = 'BRANDER-A-0001', '7. order number');
  perform pg_temp.assert(v_row->>'funding_name' = '에이 후드티', '7/8. funding name');
  perform pg_temp.assert(v_row->>'brand_name' = '브랜드에이', '7/8. brand name');
  perform pg_temp.assert(v_row->>'creator_name' = '크리에이터 A', '7/8. creator name');
  perform pg_temp.assert(v_row->>'buyer_name' = '김구매', '8. korean buyer name');
  perform pg_temp.assert(v_row->>'buyer_phone' = '010-1234-5678', '9. phone keeps leading zero');
  perform pg_temp.assert(v_row->>'recipient_phone' = '010-9876-5432', '9. recipient phone');
  perform pg_temp.assert(v_row->>'postal_code' = '06236', '9. postal code keeps leading zero');
  perform pg_temp.assert(v_row->>'tracking_number' = '012345678901', '9. tracking keeps leading zero');
  perform pg_temp.assert(v_row->>'address' = '서울특별시 강남구 테헤란로 1', '8. korean address');
  perform pg_temp.assert(v_row->>'address_detail' = '101동 202호', '8. address detail');
  perform pg_temp.assert(v_row->>'courier' = 'CJ대한통운', '7. courier');
  perform pg_temp.assert((v_row->>'quantity')::int = 2 and (v_row->>'total_amount')::int = 78000 and (v_row->>'unit_price')::int = 39000, '7. amounts');
  perform pg_temp.assert(v_row->>'status_group' = 'paid' and v_row->>'shipping_status' = 'shipped', '7. status');

  -- 전체 export 행 = DB 행 (관리자 기준 비교를 위해 행 수/수량 합 비교)
  perform pg_temp.assert(
    (select sum((r->>'quantity')::int) from jsonb_array_elements(public.export_funding_buyers('00000000-0000-0000-0000-00000000f00a')->'rows') r) = 6,
    '7. export quantity sum equals DB');
end $$;

reset role;
select pg_temp.assert(
  (select count(*) from public.buyer_export_logs where actor_id = '00000000-0000-0000-0000-00000000000a') >= 3,
  'export logs recorded');
select pg_temp.assert(
  exists (select 1 from public.admin_audit_logs where action = 'buyers.export'),
  'admin export audited');

select 'ALL BUYER ACCESS TESTS PASSED' as result;

rollback;
