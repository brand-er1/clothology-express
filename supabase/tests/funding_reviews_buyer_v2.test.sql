-- 펀딩 구매 리뷰 v2 권한/데이터 테스트 (로컬 Postgres + Supabase auth 스텁에서 전체 migration 적용 후 실행)
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/funding_reviews_buyer_v2.test.sql
-- 성공하면 마지막에 'ALL FUNDING REVIEW V2 TESTS PASSED' 가 출력된다. 전체를 롤백하므로 데이터가 남지 않는다.
--
-- 역할: 구매자(실결제·배송완료) / 비구매자 / 모의결제 구매자 / 배송 전 구매자 / 환불 구매자 / 제작자 / 다른 제작자 /
--       Super Admin / CS Admin / 비회원

begin;

set local session_replication_role = replica;

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-00000000000a', 'creator@test.local'),
  ('20000000-0000-0000-0000-00000000000b', 'other-creator@test.local'),
  ('20000000-0000-0000-0000-0000000000b1', 'buyer@test.local'),
  ('20000000-0000-0000-0000-0000000000b2', 'nonbuyer@test.local'),
  ('20000000-0000-0000-0000-0000000000b3', 'mockbuyer@test.local'),
  ('20000000-0000-0000-0000-0000000000b4', 'shipping@test.local'),
  ('20000000-0000-0000-0000-0000000000b5', 'refunded@test.local'),
  ('20000000-0000-0000-0000-0000000000b6', 'buyer6@test.local'),
  ('20000000-0000-0000-0000-0000000000ad', 'admin@test.local'),
  ('20000000-0000-0000-0000-0000000000c5', 'cs@test.local');

insert into public.profiles (id, username, full_name) values
  ('20000000-0000-0000-0000-00000000000a', 'maker', '제작자'),
  ('20000000-0000-0000-0000-00000000000b', 'maker2', '다른제작자'),
  ('20000000-0000-0000-0000-0000000000b1', 'real_buyer', '김구매'),
  ('20000000-0000-0000-0000-0000000000b2', null, '박비구매'),
  ('20000000-0000-0000-0000-0000000000b3', null, '이모의'),
  ('20000000-0000-0000-0000-0000000000b4', null, '최배송'),
  ('20000000-0000-0000-0000-0000000000b5', null, '정환불'),
  ('20000000-0000-0000-0000-0000000000b6', 'six', '육구매'),
  ('20000000-0000-0000-0000-0000000000ad', 'admin', '관리자'),
  ('20000000-0000-0000-0000-0000000000c5', 'cs', '상담원')
on conflict (id) do update set username = excluded.username, full_name = excluded.full_name;

insert into public.admin_members (user_id, role, status) values
  ('20000000-0000-0000-0000-0000000000ad', 'super_admin', 'active'),
  ('20000000-0000-0000-0000-0000000000c5', 'cs_admin', 'active');

insert into public.fundings (id, creator_id, product_name, cloth_type, material, size, image_url, moq, current_orders,
                             status, reviewed_at, funding_days, price, color_options, size_options)
values
  ('20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-00000000000a', '리뷰 후드티', 'hoodie', 'cotton', 'M',
   'https://example.com/a.png', 20, 10, 'closed', now() - interval '30 day', 30, 39000, array['BLACK'], array['M', 'L']);

insert into public.funding_participations (id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price,
  status, payment_provider, payment_status, payment_approved_at, payment_cancelled_at, partner_order_id, shipping_status, production_stage)
values
  -- 실결제 · 배송완료
  ('20000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-0000000000b1',
   'BLACK', 'M', 2, 39000, 'pledged', 'kakaopay', 'paid', now(), null, 'BRANDER-R-1', 'delivered', 'delivered'),
  -- 모의결제 · 배송완료
  ('20000000-0000-0000-0000-00000000a003', '20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-0000000000b3',
   'BLACK', 'L', 1, 39000, 'pledged', 'mock', 'paid', now(), null, 'BRANDER-R-3', 'delivered', 'delivered'),
  -- 실결제 · 제작 단계는 delivered 지만 배송 상태는 배송중 → 배송완료 아님
  ('20000000-0000-0000-0000-00000000a004', '20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-0000000000b4',
   'BLACK', 'M', 1, 39000, 'fulfilled', 'kakaopay', 'paid', now(), null, 'BRANDER-R-4', 'shipped', 'delivered'),
  -- 실결제 · 배송완료 후 환불
  ('20000000-0000-0000-0000-00000000a005', '20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-0000000000b5',
   'BLACK', 'M', 1, 39000, 'cancelled', 'kakaopay', 'cancelled', now(), now(), 'BRANDER-R-5', 'delivered', 'delivered'),
  -- 실결제 · 배송완료 (별점 2)
  ('20000000-0000-0000-0000-00000000a006', '20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-0000000000b6',
   'BLACK', 'L', 1, 39000, 'pledged', 'kakaopay', 'paid', now(), null, 'BRANDER-R-6', 'delivered', 'delivered');

insert into storage.objects (bucket_id, name, owner, metadata) values
  ('funding-reviews', '20000000-0000-0000-0000-0000000000b1/p1.jpg', '20000000-0000-0000-0000-0000000000b1', '{"mimetype": "image/jpeg", "size": 2048}'),
  ('funding-reviews', '20000000-0000-0000-0000-0000000000b1/p2.webp', '20000000-0000-0000-0000-0000000000b1', '{"mimetype": "image/webp", "size": 2048}'),
  ('funding-reviews', '20000000-0000-0000-0000-0000000000b1/p3.png', '20000000-0000-0000-0000-0000000000b1', '{"mimetype": "image/png", "size": 2048}'),
  ('funding-reviews', '20000000-0000-0000-0000-0000000000b1/huge.jpg', '20000000-0000-0000-0000-0000000000b1', '{"mimetype": "image/jpeg", "size": 9999999}');

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

create or replace function pg_temp.summary() returns jsonb language sql as $$
  select public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa')->'summary'
$$;

-- 테스트 전용: 리뷰 id 조회(테이블은 authenticated 가 직접 읽을 수 없으므로, 거부 사유가 RPC 의 권한 검증이 되도록 분리)
create or replace function pg_temp.rid(p_participation uuid) returns uuid language sql security definer as $$
  select id from public.funding_reviews where participation_id = p_participation
$$;

create or replace function pg_temp.rstatus(p_participation uuid) returns text language sql security definer as $$
  select status from public.funding_reviews where participation_id = p_participation
$$;

grant execute on function pg_temp.rid(uuid) to authenticated, anon;
grant execute on function pg_temp.rstatus(uuid) to authenticated, anon;
grant execute on function pg_temp.expect_denied(text, text) to authenticated, anon;
grant execute on function pg_temp.expect_error(text, text, text) to authenticated, anon;
grant execute on function pg_temp.assert(boolean, text) to authenticated, anon;
grant execute on function pg_temp.summary() to authenticated, anon;

set local role authenticated;

-- =========================================================================
-- A. 작성 권한 (구매자 / 모의결제 / 배송 전 / 환불 / 비구매자)
-- =========================================================================

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b1', true);
select pg_temp.assert((select can_review and block_reason is null and payment_type = 'REAL'
  from public.get_my_funding_review_eligibility('20000000-0000-0000-0000-0000000000fa')), 'A1. real delivered buyer can review');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b3', true);
select pg_temp.assert((select block_reason = 'mock_payment' and payment_type = 'MOCK'
  from public.get_my_funding_review_eligibility('20000000-0000-0000-0000-0000000000fa')), 'A2. mock order blocked by default');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a003', 5, '모의결제로 참여했어요 좋아요')$q$, '%모의결제%', 'A2. mock create blocked');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b4', true);
select pg_temp.assert((select block_reason = 'not_delivered'
  from public.get_my_funding_review_eligibility('20000000-0000-0000-0000-0000000000fa')), 'A3. production delivered but shipping not delivered');
select pg_temp.expect_denied($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a004', 5, '아직 배송중인데 써봅니다')$q$, 'A3. not delivered create');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b5', true);
select pg_temp.assert((select block_reason = 'cancelled'
  from public.get_my_funding_review_eligibility('20000000-0000-0000-0000-0000000000fa')), 'A4. refunded order');
select pg_temp.expect_denied($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a005', 1, '환불했지만 리뷰를 씁니다')$q$, 'A4. refunded create');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b2', true);
select pg_temp.assert((select count(*) from public.get_my_funding_review_eligibility('20000000-0000-0000-0000-0000000000fa')) = 0, 'A5. non-buyer no orders');
select pg_temp.expect_denied($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, '남의 주문으로 리뷰를 씁니다')$q$, 'A5. non-buyer with other order id');

-- =========================================================================
-- B. 작성 입력 검증 + 사이즈/품질
-- =========================================================================

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b1', true);
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, repeat('가', 1001))$q$, '%1000자%', 'B1. content max 1000');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 0, '열 글자 이상 리뷰입니다')$q$, '%별점%', 'B1. rating min');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, '열 글자 이상 리뷰입니다', '{}', 'tiny')$q$, '%사이즈%', 'B2. size feedback enum');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, '열 글자 이상 리뷰입니다', '{}', null, 'great')$q$, '%품질%', 'B2. quality feedback enum');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, '열 글자 이상 리뷰입니다', array['20000000-0000-0000-0000-0000000000b1/ghost.jpg'])$q$, '%업로드되지%', 'B3. image must exist in storage');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, '열 글자 이상 리뷰입니다', array['20000000-0000-0000-0000-0000000000b1/huge.jpg'])$q$, '%허용되지%', 'B3. image size limit');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, '열 글자 이상 리뷰입니다', array['20000000-0000-0000-0000-0000000000b1/x.gif'])$q$, '%경로%', 'B3. image extension');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, '열 글자 이상 리뷰입니다', array['20000000-0000-0000-0000-0000000000b1/p1.jpg','20000000-0000-0000-0000-0000000000b1/p1.jpg'])$q$, '%중복%', 'B3. duplicate image');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, '열 글자 이상 리뷰입니다', array['a/1.jpg','a/2.jpg','a/3.jpg','a/4.jpg','a/5.jpg','a/6.jpg'])$q$, '%5장%', 'B3. max 5 images');

select pg_temp.assert(public.create_funding_review('20000000-0000-0000-0000-00000000a001', 5, '핏이 예쁘고 원단이 탄탄해요. 만족합니다!',
  array['20000000-0000-0000-0000-0000000000b1/p1.jpg', '20000000-0000-0000-0000-0000000000b1/p2.webp'], 'fit', 'good') is not null, 'B4. buyer creates review with photos + feedback');
select pg_temp.expect_error($q$select public.create_funding_review('20000000-0000-0000-0000-00000000a001', 4, '한 번 더 작성하려고 합니다')$q$, '%이미 리뷰%', 'B5. one review per order');
select pg_temp.assert((select review_id is not null and block_reason = 'already_reviewed' and review->>'size_feedback' = 'fit'
  from public.get_my_funding_review_eligibility('20000000-0000-0000-0000-0000000000fa')), 'B6. eligibility returns my review');
select pg_temp.assert((select count(*) from public.get_my_funding_review_states() where review is not null) = 1, 'B6. my page review states');

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b6', true);
select pg_temp.assert(public.create_funding_review('20000000-0000-0000-0000-00000000a006', 2, '사이즈가 생각보다 작게 나왔어요.', '{}', 'small', 'average') is not null, 'B7. second buyer review');

-- =========================================================================
-- C. 공개 조회 (비회원 포함) · 요약 · 정렬 · 포토 리뷰
-- =========================================================================

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert((pg_temp.summary()->>'count')::int = 2, 'C1. anon sees count');
select pg_temp.assert((pg_temp.summary()->>'average')::numeric = 3.5, 'C1. average (5+2)/2');
select pg_temp.assert((pg_temp.summary()->'distribution'->>'5')::int = 1 and (pg_temp.summary()->'distribution'->>'2')::int = 1, 'C1. distribution');
select pg_temp.assert((pg_temp.summary()->'size'->>'fit')::int = 1 and (pg_temp.summary()->'size'->>'small')::int = 1, 'C2. size summary');
select pg_temp.assert((pg_temp.summary()->'quality'->>'good')::int = 1, 'C2. quality summary');
select pg_temp.assert((pg_temp.summary()->>'photo_count')::int = 1, 'C3. photo count');
select pg_temp.assert(jsonb_array_length(public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa')->'photos') = 2, 'C3. photo strip');
select pg_temp.assert((public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa', 'latest', 10, 0, true)->>'filtered_count')::int = 1, 'C3. photo only filter');
select pg_temp.assert((public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa', 'rating_asc')->'rows'->0->>'rating')::int = 2, 'C4. sort asc');
select pg_temp.assert((public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa', 'rating_desc')->'rows'->0->>'rating')::int = 5, 'C4. sort desc');
select pg_temp.assert((public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa', 'rating_desc')->'rows'->0->>'verified_purchase')::boolean, 'C5. real purchase verified badge');
select pg_temp.assert(not (public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa')->'rows'->0->>'is_mine')::boolean, 'C5. anon is_mine false');
select pg_temp.expect_denied($q$select public.report_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'spam')$q$, 'C6. anon cannot report');
select pg_temp.expect_denied($q$select public.get_my_funding_review_states()$q$, 'C6. anon my states');
reset role;
set local role authenticated;

-- =========================================================================
-- D. 수정 (본인만) / DB 트리거
-- =========================================================================

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b1', true);
do $$
declare v jsonb; v_id uuid := pg_temp.rid('20000000-0000-0000-0000-00000000a001');
begin
  v := public.update_my_funding_review(v_id, 4, '한 달 입어보니 보풀이 조금 생겨서 4점으로 수정합니다.',
    array['20000000-0000-0000-0000-0000000000b1/p2.webp', '20000000-0000-0000-0000-0000000000b1/p3.png'], 'large', 'average');
  perform pg_temp.assert(v->'removed_paths' = '["20000000-0000-0000-0000-0000000000b1/p1.jpg"]'::jsonb, 'D1. removed paths returned');
end $$;
select pg_temp.assert((pg_temp.summary()->>'average')::numeric = 3.0, 'D1. average recalculated after edit (4+2)/2');
select pg_temp.assert((select (review->>'edited_at') is not null from public.get_my_funding_review_eligibility('20000000-0000-0000-0000-0000000000fa')), 'D1. edited_at set');

-- 다른 구매자 / 제작자 / 관리자도 남의 리뷰는 수정·삭제 불가
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b6', true);
select pg_temp.expect_denied($q$select public.update_my_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a001'), 1, '남의 리뷰를 바꿔봅니다 열자')$q$, 'D2. other buyer cannot edit');
select pg_temp.expect_denied($q$select public.delete_my_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a001'))$q$, 'D2. other buyer cannot delete');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-00000000000a', true);
select pg_temp.expect_denied($q$select public.update_my_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 5, '제작자가 별점을 올려봅니다')$q$, 'D3. creator cannot edit');
select pg_temp.expect_denied($q$select public.delete_my_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'))$q$, 'D3. creator cannot delete');
select pg_temp.expect_denied($q$update public.funding_reviews set rating = 5$q$, 'D3. creator direct update');
select pg_temp.expect_denied($q$delete from public.funding_reviews$q$, 'D3. creator direct delete');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000ad', true);
select pg_temp.expect_denied($q$select public.update_my_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 5, '관리자가 별점을 올려봅니다')$q$, 'D4. admin cannot edit content');

reset role;
select pg_temp.expect_denied($q$update public.funding_reviews set participation_id = '20000000-0000-0000-0000-00000000a003' where participation_id = '20000000-0000-0000-0000-00000000a006'$q$, 'D5. trigger blocks moving review to other order');
set local role authenticated;

-- =========================================================================
-- E. 제작자 조회 전용
-- =========================================================================

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-00000000000a', true);
select pg_temp.assert(jsonb_array_length(public.get_creator_funding_reviews('20000000-0000-0000-0000-0000000000fa')->'rows') = 2, 'E1. creator sees own funding reviews');
select pg_temp.assert((public.get_creator_funding_reviews('20000000-0000-0000-0000-0000000000fa')->'rows'->0->>'order_number') like 'BRANDER-R-%', 'E1. creator sees order number');
select pg_temp.assert((public.get_creator_funding_reviews('20000000-0000-0000-0000-0000000000fa')->'funding'->>'product_name') = '리뷰 후드티', 'E1. creator gets funding name');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-00000000000b', true);
select pg_temp.expect_denied($q$select public.get_creator_funding_reviews('20000000-0000-0000-0000-0000000000fa')$q$, 'E2. other creator denied');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b2', true);
select pg_temp.expect_denied($q$select public.get_creator_funding_reviews('20000000-0000-0000-0000-0000000000fa')$q$, 'E2. buyer denied');
select pg_temp.expect_denied($q$select public.admin_list_funding_reviews()$q$, 'E3. non-admin admin list denied');
select pg_temp.expect_denied($q$select * from public.funding_review_reports$q$, 'E3. reports table not readable');

-- =========================================================================
-- F. 신고 → 관리자 처리
-- =========================================================================

-- 비구매자·제작자 신고 가능, 본인 리뷰 신고 불가, 중복 신고 불가
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b2', true);
select pg_temp.expect_error($q$select public.report_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'bad')$q$, '%사유%', 'F1. reason enum');
select pg_temp.assert(public.report_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'abusive', '욕설이 포함되어 있어요') is not null, 'F1. non-buyer reports');
select pg_temp.expect_error($q$select public.report_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'spam')$q$, '%이미 신고%', 'F1. duplicate report');
select pg_temp.assert((public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa', 'rating_asc')->'rows'->0->>'reported_by_me')::boolean, 'F1. reported_by_me flag');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-00000000000a', true);
select pg_temp.assert(public.report_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'false_info') is not null, 'F1. creator can report');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b6', true);
select pg_temp.expect_error($q$select public.report_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'spam')$q$, '%본인%', 'F1. cannot report own review');

-- CS Admin: 신고 조회·기각/확인 가능, 숨김 조치는 content.manage 필요
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000c5', true);
select pg_temp.assert((select count(*) from public.admin_list_funding_review_reports('pending')) = 2, 'F2. cs admin lists reports');
select pg_temp.expect_denied($q$select public.admin_resolve_funding_review_report((select id from public.admin_list_funding_review_reports('pending') limit 1), 'reviewed', '숨김', 'hide_review')$q$, 'F2. cs admin cannot hide');
select pg_temp.expect_denied($q$select public.admin_moderate_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'hidden', '테스트')$q$, 'F2. cs admin cannot moderate');

-- Super Admin: 신고 처리로 숨김 → 평균·개수 즉시 갱신, 남은 신고 일괄 처리, 작성자 알림, Audit Log
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000ad', true);
select pg_temp.assert((select pending_report_count from public.admin_list_funding_reviews('all', true)) = 2, 'F3. admin review list reported only');
select public.admin_resolve_funding_review_report(
  (select id from public.admin_list_funding_review_reports('pending') where reason = 'abusive'), 'reviewed', '욕설 포함', 'hide_review');
select pg_temp.assert((select count(*) from public.admin_list_funding_review_reports('pending')) = 0, 'F3. sibling reports closed');
select pg_temp.assert(pg_temp.rstatus('20000000-0000-0000-0000-00000000a006') = 'hidden', 'F3. review hidden');
select pg_temp.assert((pg_temp.summary()->>'count')::int = 1 and (pg_temp.summary()->>'average')::numeric = 4.0, 'F3. summary updated after hide');
select pg_temp.assert((select count(*) from public.admin_list_funding_review_reports('reviewed')) = 2, 'F3. reports resolved');
reset role;
select pg_temp.assert(exists (select 1 from public.admin_audit_logs where action = 'content.funding_review_hidden'
  and admin_id = '20000000-0000-0000-0000-0000000000ad'), 'F3. audit logged');
select pg_temp.assert(exists (select 1 from public.community_notifications where recipient_id = '20000000-0000-0000-0000-0000000000b6' and message like '%리뷰 숨김%'), 'F3. reviewer notified');
set local role authenticated;

-- 숨김된 리뷰는 작성자가 수정·삭제(우회 재작성) 불가, 제작자 목록에는 숨김 상태로 표시
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b6', true);
select pg_temp.expect_denied($q$select public.update_my_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 5, '숨김 이후 내용을 바꿉니다')$q$, 'F4. hidden review cannot be edited');
select pg_temp.expect_denied($q$select public.delete_my_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'))$q$, 'F4. hidden review cannot be deleted by owner');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-00000000000a', true);
select pg_temp.assert((select count(*) from jsonb_array_elements(public.get_creator_funding_reviews('20000000-0000-0000-0000-0000000000fa')->'rows') x
  where x->>'status' = 'hidden' and not (x->>'is_public')::boolean) = 1, 'F4. creator sees hidden flag');

-- 복구 / 삭제(보관)
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000ad', true);
select public.admin_moderate_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'visible', null);
select pg_temp.assert((pg_temp.summary()->>'count')::int = 2, 'F5. restore');
select pg_temp.expect_error($q$select public.admin_moderate_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'removed', '')$q$, '%사유%', 'F5. reason required');
select public.admin_moderate_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a006'), 'removed', '개인정보 노출');
select pg_temp.assert((pg_temp.summary()->>'count')::int = 1, 'F5. soft removed excluded');
reset role;
select pg_temp.assert((select count(*) from public.funding_reviews where participation_id = '20000000-0000-0000-0000-00000000a006') = 1, 'F5. removed row preserved');
set local role authenticated;

-- =========================================================================
-- G. 모의결제 정책 토글
-- =========================================================================

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000ad', true);
select public.admin_update_setting('funding_review_allow_mock_orders', 'true'::jsonb, '베타 테스트');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b3', true);
select pg_temp.assert(public.create_funding_review('20000000-0000-0000-0000-00000000a003', 3, '모의결제 베타 참여 후기입니다.') is not null, 'G1. mock review allowed when enabled');
select pg_temp.assert((pg_temp.summary()->>'count')::int = 2, 'G1. mock review counted when enabled');
select pg_temp.assert((select x->>'purchase_type' = 'mock' and not (x->>'verified_purchase')::boolean
  from jsonb_array_elements(public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa')->'rows') x where (x->>'rating')::int = 3), 'G1. mock review not verified');
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000ad', true);
select public.admin_update_setting('funding_review_allow_mock_orders', 'false'::jsonb, '정식 오픈');
select pg_temp.assert((pg_temp.summary()->>'count')::int = 1 and (pg_temp.summary()->>'average')::numeric = 4.0, 'G2. mock reviews excluded when disabled');
reset role;
select pg_temp.assert((select count(*) from public.funding_reviews where participation_id = '20000000-0000-0000-0000-00000000a003') = 1, 'G2. mock review data preserved');
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b3', true);
select pg_temp.expect_denied($q$select public.update_my_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a003'), 4, '정식 오픈 후 수정합니다')$q$, 'G2. mock review edit blocked when disabled');

-- =========================================================================
-- H. 환불 후 / 본인 삭제 → 집계 갱신
-- =========================================================================

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000b1', true);
select pg_temp.assert(cardinality(public.delete_my_funding_review(pg_temp.rid('20000000-0000-0000-0000-00000000a001'))) = 2, 'H1. owner delete returns photo paths');
select pg_temp.assert((pg_temp.summary()->>'count')::int = 0 and (pg_temp.summary()->>'average')::numeric = 0, 'H1. summary after delete');
select pg_temp.assert((select can_review from public.get_my_funding_review_eligibility('20000000-0000-0000-0000-0000000000fa')), 'H1. can write again after own delete');

reset role;

select 'ALL FUNDING REVIEW V2 TESTS PASSED' as result;

rollback;
