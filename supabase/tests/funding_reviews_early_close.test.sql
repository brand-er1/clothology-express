-- 펀딩 리뷰 · 조기 마감 권한/데이터 테스트 (로컬 Postgres + Supabase auth 스텁에서 전체 migration 적용 후 실행)
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/funding_reviews_early_close.test.sql
-- 성공하면 마지막에 'ALL REVIEW / EARLY CLOSE TESTS PASSED' 가 출력된다. 전체를 롤백하므로 데이터가 남지 않는다.

begin;

-- 시드는 이 기능과 무관한 트리거(상표 검수 등)를 끄고 넣는다.
set local session_replication_role = replica;

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-00000000000a', 'creator-a@test.local'),
  ('10000000-0000-0000-0000-00000000000b', 'creator-b@test.local'),
  ('10000000-0000-0000-0000-0000000000b1', 'buyer1@test.local'),
  ('10000000-0000-0000-0000-0000000000b2', 'nonbuyer@test.local'),
  ('10000000-0000-0000-0000-0000000000b3', 'cancelled@test.local'),
  ('10000000-0000-0000-0000-0000000000b4', 'undelivered@test.local'),
  ('10000000-0000-0000-0000-0000000000b5', 'buyer5@test.local'),
  ('10000000-0000-0000-0000-0000000000b6', 'buyer6@test.local'),
  ('10000000-0000-0000-0000-0000000000ad', 'admin@test.local'),
  ('10000000-0000-0000-0000-0000000000c5', 'cs@test.local');

insert into public.profiles (id, username, full_name, phone_number) values
  ('10000000-0000-0000-0000-00000000000a', 'creator_a', '제작자에이', '01011110000'),
  ('10000000-0000-0000-0000-00000000000b', 'creator_b', '제작자비', '01022220000'),
  ('10000000-0000-0000-0000-0000000000b1', 'hoodie_lover', '김구매', '01012345678'),
  ('10000000-0000-0000-0000-0000000000b2', null, '박비구매', '01000000002'),
  ('10000000-0000-0000-0000-0000000000b3', null, '이취소', '01000000003'),
  ('10000000-0000-0000-0000-0000000000b4', null, '최배송전', '01000000004'),
  ('10000000-0000-0000-0000-0000000000b5', null, '정미달', '01000000005'),
  ('10000000-0000-0000-0000-0000000000b6', 'x@mail.com', '한별점', '01000000006'),
  ('10000000-0000-0000-0000-0000000000ad', 'admin', '관리자', null),
  ('10000000-0000-0000-0000-0000000000c5', 'cs', '상담원', null)
on conflict (id) do update set username = excluded.username, full_name = excluded.full_name, phone_number = excluded.phone_number;

insert into public.admin_members (user_id, role, status) values
  ('10000000-0000-0000-0000-0000000000ad', 'super_admin', 'active'),
  ('10000000-0000-0000-0000-0000000000c5', 'cs_admin', 'active');

insert into public.platform_settings (key, value) values ('notification_channels', '{"sms": true}'::jsonb)
on conflict (key) do update set value = excluded.value;

-- FA: 제작자 A · 목표 20 / 유효 33장(165%)   FB: 제작자 B · 목표 30 / 유효 18장(60%)
insert into public.fundings (id, creator_id, product_name, cloth_type, material, size, image_url, moq, current_orders,
                             status, reviewed_at, funding_days, price, color_options, size_options)
values
  ('10000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-00000000000a', '에이 후드티', 'hoodie', 'cotton', 'M',
   'https://example.com/a.png', 20, 33, 'approved', now() - interval '1 day', 30, 39000, array['BLACK'], array['M', 'L']),
  ('10000000-0000-0000-0000-0000000000fb', '10000000-0000-0000-0000-00000000000b', '비 티셔츠', 'tshirt', 'cotton', 'M',
   'https://example.com/b.png', 30, 18, 'approved', now() - interval '1 day', 30, 29000, array['NAVY'], array['M']);

insert into public.funding_participations (id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price,
  status, payment_provider, payment_status, payment_approved_at, partner_order_id, orderer_name, orderer_phone, shipping_status, production_stage)
values
  -- 배송 완료된 실제 구매자(2건)
  ('10000000-0000-0000-0000-00000000a001', '10000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-0000000000b1',
   'BLACK', 'M', 30, 39000, 'pledged', 'mock', 'paid', now(), 'BRANDER-FA-1', '김구매', '010-1234-5678', 'delivered', 'delivered'),
  ('10000000-0000-0000-0000-00000000a002', '10000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-0000000000b1',
   'BLACK', 'L', 1, 39000, 'fulfilled', 'mock', 'paid', now(), 'BRANDER-FA-2', '김구매', '010-1234-5678', 'preparing', 'delivered'),
  -- 취소 주문
  ('10000000-0000-0000-0000-00000000a003', '10000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-0000000000b3',
   'BLACK', 'M', 2, 39000, 'cancelled', 'mock', 'cancelled', now(), 'BRANDER-FA-3', '이취소', '010-0000-0003', 'delivered', 'delivered'),
  -- 결제 완료 · 배송 전
  ('10000000-0000-0000-0000-00000000a004', '10000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-0000000000b4',
   'BLACK', 'M', 1, 39000, 'pledged', 'mock', 'paid', now(), 'BRANDER-FA-4', '최배송전', '010-0000-0004', 'preparing', 'production'),
  -- 배송 완료(별점 3)
  ('10000000-0000-0000-0000-00000000a006', '10000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-0000000000b6',
   'BLACK', 'L', 1, 39000, 'pledged', 'mock', 'paid', now(), 'BRANDER-FA-6', '한별점', '010-0000-0006', 'delivered', 'delivered'),
  -- FB 참여자(목표 미달)
  ('10000000-0000-0000-0000-00000000b001', '10000000-0000-0000-0000-0000000000fb', '10000000-0000-0000-0000-0000000000b5',
   'NAVY', 'M', 18, 29000, 'pledged', 'mock', 'paid', now(), 'BRANDER-FB-1', '정미달', '010-0000-0005', 'preparing', 'funding');

set local session_replication_role = origin;

grant usage on schema public to authenticated, anon;

create or replace function pg_temp.expect_denied(p_sql text, p_label text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL [%]: 권한 없는 호출이 성공했습니다', p_label;
exception
  when insufficient_privilege then null;
end;
$$;

create or replace function pg_temp.expect_error(p_sql text, p_like text, p_label text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL [%]: 실패해야 하는 호출이 성공했습니다', p_label;
exception
  when others then
    if sqlerrm like 'FAIL [%' then raise; end if;
    if sqlerrm not like p_like then raise exception 'FAIL [%]: 예상과 다른 오류 %', p_label, sqlerrm; end if;
end;
$$;

create or replace function pg_temp.assert(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAIL [%]', p_label; end if;
end;
$$;

grant execute on function pg_temp.expect_denied(text, text) to authenticated, anon;
grant execute on function pg_temp.expect_error(text, text, text) to authenticated, anon;
grant execute on function pg_temp.assert(boolean, text) to authenticated, anon;

set local role authenticated;

-- =========================================================================
-- 리뷰
-- =========================================================================

-- 1. 실제 구매자(배송 완료)는 작성 가능
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b1', true);
select pg_temp.assert((select count(*) from public.get_my_funding_review_eligibility('10000000-0000-0000-0000-0000000000fa') where can_review) = 2, '1. eligibility lists 2 reviewable orders');
select pg_temp.assert(public.create_funding_review('10000000-0000-0000-0000-00000000a001', 5, '핏이 정말 예쁘고 원단이 두꺼워요!', array['10000000-0000-0000-0000-0000000000b1/a.jpg']) is not null, '1. buyer review #1');
select pg_temp.assert(public.create_funding_review('10000000-0000-0000-0000-00000000a002', 4, '두 번째 구매, 사이즈 L 도 만족합니다.') is not null, '1. buyer review #2 (another order)');
-- 동일 주문 2번째 리뷰 불가
select pg_temp.expect_error($q$select public.create_funding_review('10000000-0000-0000-0000-00000000a001', 5, '한 번 더 쓰려고 합니다 열글자')$q$, '%이미 리뷰%', '1. one review per order');
-- 별점 / 내용 / 남의 폴더 사진 검증
select pg_temp.expect_denied($q$select public.create_funding_review('10000000-0000-0000-0000-00000000a006', 5, '열 글자 이상 리뷰입니다')$q$, '1. cannot review another buyer''s order');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b6', true);
select pg_temp.expect_error($q$select public.create_funding_review('10000000-0000-0000-0000-00000000a006', 6, '열 글자 이상 리뷰입니다')$q$, '%별점%', '1. rating range');
select pg_temp.expect_error($q$select public.create_funding_review('10000000-0000-0000-0000-00000000a006', 3, '짧음')$q$, '%10자%', '1. content length');
select pg_temp.expect_error($q$select public.create_funding_review('10000000-0000-0000-0000-00000000a006', 3, '열 글자 이상 리뷰입니다', array['10000000-0000-0000-0000-0000000000b1/a.jpg'])$q$, '%사진 경로%', '1. cannot attach others photos');
select pg_temp.assert(public.create_funding_review('10000000-0000-0000-0000-00000000a006', 3, '보통이에요. 배송은 빨랐습니다.') is not null, '1. buyer6 review');

-- 2. 비구매자: 남의 주문 ID 로 작성 불가
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b2', true);
select pg_temp.expect_denied($q$select public.create_funding_review('10000000-0000-0000-0000-00000000a004', 5, '구매하지 않았지만 써봅니다')$q$, '2. non-buyer');
select pg_temp.assert((select count(*) from public.get_my_funding_review_eligibility('10000000-0000-0000-0000-0000000000fa')) = 0, '2. non-buyer has no orders');
-- 테이블 직접 쓰기/읽기 불가
select pg_temp.expect_denied($q$insert into public.funding_reviews (funding_id, participation_id, reviewer_id, rating, content, nickname) values ('10000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-00000000a004', auth.uid(), 5, '직접 넣는 리뷰입니다', 'x')$q$, '2. direct insert');
select pg_temp.expect_denied($q$select * from public.funding_reviews$q$, '2. direct select');

-- 3. 취소 주문자 불가 / 배송 전 불가
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b3', true);
select pg_temp.expect_denied($q$select public.create_funding_review('10000000-0000-0000-0000-00000000a003', 1, '취소했지만 리뷰를 씁니다')$q$, '3. cancelled order');
select pg_temp.assert((select block_reason from public.get_my_funding_review_eligibility('10000000-0000-0000-0000-0000000000fa')) = 'cancelled', '3. cancelled reason');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b4', true);
select pg_temp.expect_denied($q$select public.create_funding_review('10000000-0000-0000-0000-00000000a004', 5, '아직 못 받았지만 기대돼요')$q$, '3. not delivered');

-- 비회원
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_denied($q$select public.create_funding_review('10000000-0000-0000-0000-00000000a001', 5, '비회원이 쓰는 리뷰입니다')$q$, '2. anon write');

-- 4. 평균 별점 (비회원도 조회 가능)
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa')->'summary'->>'average')::numeric = 4.0, '4. average (5+4+3)/3');
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa')->'summary'->>'count')::int = 3, '4. count');
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa', 'rating_asc')->'rows'->0->>'rating')::int = 3, '4. sort rating asc');
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa', 'rating_desc')->'rows'->0->>'rating')::int = 5, '4. sort rating desc');
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa')->'rows'->0->>'verified_purchase')::boolean, '4. verified badge');
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa', 'rating_desc')->'rows'->0->>'nickname') = 'hoodie_lover', '4. nickname from username');
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa', 'rating_asc')->'rows'->0->>'nickname') = '한*점', '4. email-like username → masked name');
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa', 'rating_desc')->'rows'->0->>'selected_size') = 'M', '4. purchase option snapshot');

-- 리뷰 작성 후 주문이 환불되면 리뷰는 집계·목록에서 빠진다
reset role;
update public.funding_participations set status = 'cancelled', payment_status = 'cancelled' where id = '10000000-0000-0000-0000-00000000a006';
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa')->'summary'->>'average')::numeric = 4.5, '4. refunded order review excluded');
update public.funding_participations set status = 'pledged', payment_status = 'paid' where id = '10000000-0000-0000-0000-00000000a006';
-- DB 트리거: 관리자 권한(postgres)으로 직접 넣어도 실제 구매 조건이 아니면 거부
select pg_temp.expect_denied($q$insert into public.funding_reviews (funding_id, participation_id, reviewer_id, rating, content, nickname) values ('10000000-0000-0000-0000-0000000000fa', '10000000-0000-0000-0000-00000000a004', '10000000-0000-0000-0000-0000000000b4', 5, '트리거 우회 시도 리뷰', 'x')$q$, '3. trigger blocks undelivered insert');

-- 펀딩 문의 (기존 CS 문의 재사용)
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b2', true);
select pg_temp.assert(public.create_funding_inquiry('10000000-0000-0000-0000-0000000000fa', '사이즈 문의', '키 175에 몸무게 70이면 어떤 사이즈가 맞을까요?') is not null, 'inquiry create');
select pg_temp.assert((select count(*) from public.list_my_funding_inquiries('10000000-0000-0000-0000-0000000000fa')) = 1, 'inquiry list mine');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b1', true);
select pg_temp.assert((select count(*) from public.list_my_funding_inquiries('10000000-0000-0000-0000-0000000000fa')) = 0, 'inquiry not visible to others');

-- =========================================================================
-- 조기 마감
-- =========================================================================

-- 6. 다른 제작자 / 구매자 / CS 관리자 / 비회원 불가
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-00000000000b', true);
select pg_temp.expect_denied($q$select public.creator_early_close_funding('10000000-0000-0000-0000-0000000000fa')$q$, '6. other creator');
select pg_temp.expect_denied($q$select public.admin_early_close_funding('10000000-0000-0000-0000-0000000000fa', '테스트 사유')$q$, '6. creator calls admin rpc');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b1', true);
select pg_temp.expect_denied($q$select public.creator_early_close_funding('10000000-0000-0000-0000-0000000000fa')$q$, '6. buyer');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000c5', true);
select pg_temp.expect_denied($q$select public.admin_early_close_funding('10000000-0000-0000-0000-0000000000fa', '테스트 사유')$q$, '6. cs admin lacks fundings.manage');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_denied($q$select public.creator_early_close_funding('10000000-0000-0000-0000-0000000000fa')$q$, '6. no uid');
reset role;
set local role anon;
select pg_temp.expect_denied($q$select public.creator_early_close_funding('10000000-0000-0000-0000-0000000000fa')$q$, '6. anon');
select pg_temp.expect_denied($q$select public.admin_early_close_funding('10000000-0000-0000-0000-0000000000fa', '테스트 사유')$q$, '6. anon admin rpc');
reset role;
select pg_temp.assert((select status from public.fundings where id = '10000000-0000-0000-0000-0000000000fa') = 'approved', '6. still open after denied attempts');

-- 5. 제작자 A: 본인 펀딩 조기 마감 (목표 달성 165%)
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-00000000000a', true);
do $$
declare v jsonb;
begin
  v := public.creator_early_close_funding('10000000-0000-0000-0000-0000000000fa');
  perform pg_temp.assert(v->>'result' = 'success', '5. result success');
  perform pg_temp.assert((v->>'quantity')::int = 33, '5. valid quantity 30+1+1+1 (cancelled excluded)');
  perform pg_temp.assert((v->>'achievement_rate')::numeric = 165.00, '5. achievement rate 165%');
  perform pg_temp.assert((v->>'amount')::bigint = 33 * 39000, '5. final amount');
  perform pg_temp.assert((v->>'notified_participants')::int = 3, '5. notified paid participants b1,b4,b6');
end $$;
select pg_temp.expect_error($q$select public.creator_early_close_funding('10000000-0000-0000-0000-0000000000fa')$q$, '%이미 조기 마감%', '5. cannot close twice');

-- 8. 조기 마감 후 신규 결제 불가
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000b2', true);
select pg_temp.expect_error($q$select public.create_mock_funding_order('10000000-0000-0000-0000-0000000000fa', 'BLACK', 'M', 1, '박비구매', '010-0000-0002', 'n@test.local', '박비구매', '010-0000-0002', '06000', '서울', '1층', null, true)$q$, '%', '8. new order blocked');

-- 7. 관리자: 다른 제작자의 펀딩도 조기 마감 (목표 미달 60%) — 사유 필수
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-0000000000ad', true);
select pg_temp.expect_error($q$select public.admin_early_close_funding('10000000-0000-0000-0000-0000000000fb', '')$q$, '%사유%', '7. admin reason required');
do $$
declare v jsonb;
begin
  v := public.admin_early_close_funding('10000000-0000-0000-0000-0000000000fb', '제작자 요청으로 조기 마감');
  perform pg_temp.assert(v->>'result' = 'unmet', '7/11. unmet result');
  perform pg_temp.assert((v->>'achievement_rate')::numeric = 60.00, '7/11. unmet rate 60%');
  perform pg_temp.assert(v->>'closed_by_role' = 'admin', '7. admin role');
end $$;
select pg_temp.assert((select count(*) from public.admin_list_early_close_logs()) = 2, '7. admin sees close logs');
select pg_temp.assert((select close_type from public.admin_list_funding_closures(array['10000000-0000-0000-0000-0000000000fb'::uuid])) = 'admin_early', '7. close type admin_early');
select pg_temp.assert((select close_type from public.admin_list_funding_closures(array['10000000-0000-0000-0000-0000000000fa'::uuid])) = 'creator_early', '7. close type creator_early');
-- 조기 마감 기록은 클라이언트가 직접 볼 수 없다
select pg_temp.expect_denied($q$select * from public.funding_early_close_logs$q$, '7. log table not readable directly');
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-00000000000a', true);
select pg_temp.expect_denied($q$select * from public.admin_list_early_close_logs()$q$, '7. creator cannot read admin logs');
-- 클라이언트가 조기 마감 컬럼을 직접 되돌릴 수 없다
-- 클라이언트가 조기 마감 상태를 직접 되돌릴 수 없다(RLS 로 0건 갱신되거나 가드 트리거가 거부)
do $$
begin
  update public.fundings set early_closed = false, status = 'approved' where id = '10000000-0000-0000-0000-0000000000fa';
exception when insufficient_privilege then null;
end $$;
reset role;
select pg_temp.assert((select early_closed and status = 'closed' from public.fundings where id = '10000000-0000-0000-0000-0000000000fa'), '9. cannot undo early close via table update');
set local role authenticated;

reset role;

-- 9/10. 기존 주문·결제·달성률·매출 유지
select pg_temp.assert((select count(*) from public.funding_participations where funding_id = '10000000-0000-0000-0000-0000000000fa') = 5, '9. all orders kept');
select pg_temp.assert((select count(*) from public.funding_participations where funding_id = '10000000-0000-0000-0000-0000000000fa' and payment_status = 'paid') = 4, '9. paid orders kept');
select pg_temp.assert((select current_orders from public.fundings where id = '10000000-0000-0000-0000-0000000000fa') = 33, '10. current_orders (achievement base) unchanged');
select pg_temp.assert((select current_orders from public.fundings where id = '10000000-0000-0000-0000-0000000000fb') = 18, '10. FB current_orders unchanged');
select pg_temp.assert((select status from public.fundings where id = '10000000-0000-0000-0000-0000000000fa') = 'closed' and (select early_closed from public.fundings where id = '10000000-0000-0000-0000-0000000000fa'), '5. status closed + early_closed');
select pg_temp.assert((select success_at is not null and funding_status = 'success' from public.fundings where id = '10000000-0000-0000-0000-0000000000fa'), '5. goal met → success (제작 준비)');
select pg_temp.assert((select success_at is null from public.fundings where id = '10000000-0000-0000-0000-0000000000fb'), '11. unmet stays unsuccessful');
select pg_temp.assert((select final_amount from public.funding_early_close_logs where funding_id = '10000000-0000-0000-0000-0000000000fa') = 33 * 39000, '10. log final amount');
select pg_temp.assert((select closed_by_role = 'creator' and original_end_date is not null and final_participant_count = 3 and final_quantity = 33
  from public.funding_early_close_logs where funding_id = '10000000-0000-0000-0000-0000000000fa'), '7. creator log fields');
select pg_temp.assert(exists (select 1 from public.admin_audit_logs where action = 'funding.early_close'), '7. admin action audited');
-- 리뷰 데이터 유지
select pg_temp.assert((public.get_funding_reviews('10000000-0000-0000-0000-0000000000fa')->'summary'->>'count')::int = 3, '9. reviews kept after close');
-- 자동 환불 없음
select pg_temp.assert((select payment_status from public.funding_participations where id = '10000000-0000-0000-0000-00000000b001') = 'paid', '11. no auto refund on unmet close');

-- 12. 구매자 알림 (사이트 알림 + SMS 발송 큐)
select pg_temp.assert((select count(*) from public.community_notifications where funding_id = '10000000-0000-0000-0000-0000000000fa' and type = 'funding_early_closed'
  and message like '%목표 달성으로 조기 마감되었습니다. 제작 준비가 시작될 예정입니다.%') = 3, '12. success notification copy');
select pg_temp.assert((select count(*) from public.community_notifications where funding_id = '10000000-0000-0000-0000-0000000000fb' and type = 'funding_early_closed'
  and message like '%목표 수량에 도달하지 못한 상태로 조기 마감%') = 1, '12. unmet notification copy');
select pg_temp.assert(not exists (select 1 from public.community_notifications where funding_id = '10000000-0000-0000-0000-0000000000fa'
  and recipient_id = '10000000-0000-0000-0000-0000000000b3'), '12. cancelled buyer not notified');
select pg_temp.assert((select count(*) from public.notification_logs where funding_id = '10000000-0000-0000-0000-0000000000fa'
  and event_type = 'funding_early_closed' and channel = 'sms' and status = 'pending' and (payload->>'succeeded')::boolean) = 3, '12. sms jobs queued');
select pg_temp.assert((select actor_id from public.community_notifications where funding_id = '10000000-0000-0000-0000-0000000000fb' limit 1)
  = '10000000-0000-0000-0000-0000000000ad', '12. admin close actor');

select 'ALL REVIEW / EARLY CLOSE TESTS PASSED' as result;

rollback;
