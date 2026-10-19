-- 펀딩 상품 문의 · AI 디자인 관리 · 대시보드 · 리뷰 관리 권한/데이터 테스트
-- (로컬 Postgres + scripts/admin-db-tests/00_supabase_stub.sql + 전체 migration 적용 후 실행)
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/funding_inquiries_ai_designs.test.sql
-- 성공하면 마지막에 'ALL INQUIRY / AI DESIGN TESTS PASSED' 가 출력된다. 전체를 롤백하므로 데이터가 남지 않는다.

begin;

set local session_replication_role = replica;

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-00000000000a', 'creator-a@test.local'),
  ('20000000-0000-0000-0000-00000000000b', 'creator-b@test.local'),
  ('20000000-0000-0000-0000-0000000000c1', 'customer1@test.local'),
  ('20000000-0000-0000-0000-0000000000c2', 'customer2@test.local'),
  ('20000000-0000-0000-0000-0000000000ad', 'super@test.local'),
  ('20000000-0000-0000-0000-0000000000c5', 'cs@test.local'),
  ('20000000-0000-0000-0000-0000000000a0', 'ops@test.local');

insert into public.profiles (id, username, full_name, phone_number) values
  ('20000000-0000-0000-0000-00000000000a', 'creator_a', '제작자에이', '010-1111-0000'),
  ('20000000-0000-0000-0000-00000000000b', 'creator_b', '제작자비', '010-2222-0000'),
  ('20000000-0000-0000-0000-0000000000c1', 'hoodie_fan', '김고객', '010-3333-0000'),
  ('20000000-0000-0000-0000-0000000000c2', null, '박고객', null),
  ('20000000-0000-0000-0000-0000000000ad', 'super', '슈퍼관리자', null),
  ('20000000-0000-0000-0000-0000000000c5', 'cs', '상담원', null),
  ('20000000-0000-0000-0000-0000000000a0', 'ops', '운영자', null)
on conflict (id) do update set username = excluded.username, full_name = excluded.full_name, phone_number = excluded.phone_number;

insert into public.admin_members (user_id, role, status) values
  ('20000000-0000-0000-0000-0000000000ad', 'super_admin', 'active'),
  ('20000000-0000-0000-0000-0000000000c5', 'cs_admin', 'active'),
  ('20000000-0000-0000-0000-0000000000a0', 'operations_admin', 'active');

insert into public.platform_settings (key, value) values ('notification_channels', '{"sms": true}'::jsonb)
on conflict (key) do update set value = excluded.value;

-- 제작자 B 는 SMS 수신을 끔. 제작자 A 는 펀딩 성공 알림만 끔(문의 SMS 는 받아야 함).
insert into public.creator_notification_settings (user_id, phone_number, sms_notifications_enabled, funding_success_notifications_enabled) values
  ('20000000-0000-0000-0000-00000000000a', '01011110000', true, false),
  ('20000000-0000-0000-0000-00000000000b', '01022220000', false, true);

insert into public.fundings (id, creator_id, product_name, cloth_type, material, size, image_url, image_path, moq, current_orders,
                             status, reviewed_at, funding_days, price, color_options, size_options)
values
  ('20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-00000000000a', '에이 후드티', 'hoodie', 'cotton', 'M',
   'https://example.com/a.png', null, 20, 3, 'approved', now() - interval '1 day', 30, 39000, array['BLACK'], array['M']),
  ('20000000-0000-0000-0000-0000000000fb', '20000000-0000-0000-0000-00000000000b', '비 티셔츠', 'tshirt', 'cotton', 'M',
   'https://example.com/b.png', null, 30, 0, 'approved', now() - interval '1 day', 30, 29000, array['NAVY'], array['M']),
  ('20000000-0000-0000-0000-0000000000ff', '20000000-0000-0000-0000-00000000000a', '승인 대기 셔츠', 'shirt', 'cotton', 'M',
   'https://example.com/p.png', null, 20, 0, 'pending', null, 30, 49000, array['WHITE'], array['M']),
  -- 고객1 이 직접 만든 펀딩(대표 이미지 = 고객1 의 AI 이미지)
  ('20000000-0000-0000-0000-0000000000fc', '20000000-0000-0000-0000-0000000000c1', '고객1 니트', 'knit', 'wool', 'M',
   'https://cdn.test/gen/c1-knit.png', 'c1/knit.png', 20, 0, 'approved', now() - interval '1 day', 30, 59000, array['IVORY'], array['M']);

-- 문의 사진(Storage 객체)
insert into storage.objects (bucket_id, name, owner) values
  ('funding-inquiries', '20000000-0000-0000-0000-0000000000c1/size.jpg', '20000000-0000-0000-0000-0000000000c1'),
  ('funding-inquiries', '20000000-0000-0000-0000-0000000000c1/private.jpg', '20000000-0000-0000-0000-0000000000c1'),
  ('funding-inquiries', '20000000-0000-0000-0000-0000000000c2/other.jpg', '20000000-0000-0000-0000-0000000000c2');

-- AI 이미지 / 디자인 / 업로드 의뢰
insert into public.generated_images (id, user_id, prompt, stored_image_url, image_path, cloth_type, material, detail, generation_prompt, created_at) values
  ('20000000-0000-0000-0000-0000000001a1', '20000000-0000-0000-0000-0000000000c1', '아이보리 케이블 니트',
   'https://cdn.test/gen/c1-knit.png', 'c1/knit.png', 'knit', 'wool', '꽈배기 패턴', 'ivory cable knit sweater', now() - interval '2 day'),
  ('20000000-0000-0000-0000-0000000001a2', '20000000-0000-0000-0000-0000000000c2', '블랙 후드',
   'https://cdn.test/gen/c2-hood.png', 'c2/hood.png', 'hoodie', null, null, null, now()),
  -- 브라우저 임시(data:) 이미지는 목록에서 제외
  ('20000000-0000-0000-0000-0000000001a3', '20000000-0000-0000-0000-0000000000c2', '임시',
   'data:image/png;base64,AAAA', null, 'tshirt', null, null, null, now());

insert into public.designs (id, user_id, front_image_url, image_path, product_type, color, fabric, fit, prompt, source, created_at) values
  -- generated_images 와 같은 이미지 → 별도 항목이 아니라 핏/컬러만 보탠다
  ('20000000-0000-0000-0000-0000000002d1', '20000000-0000-0000-0000-0000000000c1', 'https://cdn.test/gen/c1-knit.png', 'c1/knit.png',
   'knit', 'IVORY', 'wool', 'oversized', '아이보리 케이블 니트', 'customize', now() - interval '2 day'),
  -- generated_images 에 없는 디자인 기록
  ('20000000-0000-0000-0000-0000000002d2', '20000000-0000-0000-0000-0000000000c2', 'https://cdn.test/gen/c2-pants.png', 'c2/pants.png',
   'pants', 'GRAY', 'nylon', 'wide', '그레이 와이드 팬츠', 'closet', now() - interval '1 day');

insert into public.orders (id, user_id, cloth_type, material, image_path, generated_image_url, request_source, reference_image_paths, created_at) values
  ('20000000-0000-0000-0000-0000000003e1', '20000000-0000-0000-0000-0000000000c2', 'jacket', 'denim', 'uploads/c2-jacket.png', null,
   'design_upload', '["uploads/c2-jacket.png", "uploads/c2-jacket-back.png"]'::jsonb, now() - interval '3 hour'),
  -- AI 디자인 제작 의뢰는 업로드가 아니므로 제외
  ('20000000-0000-0000-0000-0000000003e2', '20000000-0000-0000-0000-0000000000c1', 'knit', 'wool', 'c1/knit.png', null,
   'ai_design', null, now());

set local session_replication_role = origin;

grant usage on schema public, storage to authenticated, anon;
grant select on storage.objects to anon, authenticated;

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

create or replace function pg_temp.as_user(p_user text)
returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user, ''), true);
$$;

grant execute on function pg_temp.expect_denied(text, text) to authenticated, anon;
grant execute on function pg_temp.expect_error(text, text, text) to authenticated, anon;
grant execute on function pg_temp.assert(boolean, text) to authenticated, anon;
grant execute on function pg_temp.as_user(text) to authenticated, anon;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated, anon;

set local role authenticated;

-- =========================================================================
-- 1. 고객 문의 작성
-- =========================================================================

select pg_temp.as_user('20000000-0000-0000-0000-0000000000c1');
insert into ids values ('public_q', public.create_funding_product_inquiry(
  '20000000-0000-0000-0000-0000000000fa', 'size_fit', '사이즈 문의', '키 175 에 L 이 맞을까요?',
  array['20000000-0000-0000-0000-0000000000c1/size.jpg'], false));
insert into ids values ('private_q', public.create_funding_product_inquiry(
  '20000000-0000-0000-0000-0000000000fa', 'exchange_refund', '환불 문의', '주문 번호 공유드립니다. 환불 가능할까요?',
  array['20000000-0000-0000-0000-0000000000c1/private.jpg'], true));
insert into ids values ('fb_q', public.create_funding_product_inquiry(
  '20000000-0000-0000-0000-0000000000fb', 'fabric', '원단 두께', '여름에도 입을 수 있는 두께인가요?', '{}', false));

select pg_temp.expect_denied($q$select public.create_funding_product_inquiry('20000000-0000-0000-0000-0000000000fa', 'other', '남의 사진', '다른 회원 사진을 붙입니다', array['20000000-0000-0000-0000-0000000000c2/other.jpg'], false)$q$, '1. cannot attach another member''s photo');
select pg_temp.expect_error($q$select public.create_funding_product_inquiry('20000000-0000-0000-0000-0000000000fa', 'other', '없는 사진', '업로드하지 않은 사진', array['20000000-0000-0000-0000-0000000000c1/none.jpg'], false)$q$, '%찾을 수 없습니다%', '1. photo must exist in storage');
select pg_temp.expect_error($q$select public.create_funding_product_inquiry('20000000-0000-0000-0000-0000000000fa', 'unknown', '유형 오류', '알 수 없는 유형입니다', '{}', false)$q$, '%funding_inquiries_type_check%', '1. inquiry type check');
select pg_temp.expect_error($q$select public.create_funding_product_inquiry('20000000-0000-0000-0000-0000000000ff', 'other', '대기 펀딩', '승인 전 펀딩에 문의합니다', '{}', false)$q$, '%문의할 수 없는%', '1. pending funding');
select pg_temp.expect_denied($q$insert into public.funding_inquiries (funding_id, author_id, nickname, title, content) values ('20000000-0000-0000-0000-0000000000fa', auth.uid(), 'x', '직접 입력', '직접 입력한 문의')$q$, '1. direct insert blocked');
select pg_temp.expect_denied($q$update public.funding_inquiries set answer_content = '셀프 답변', status = 'answered'$q$, '1. direct update blocked');

-- 제작자는 본인 펀딩에 문의할 수 없다
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($q$select public.create_funding_product_inquiry('20000000-0000-0000-0000-0000000000fa', 'other', '셀프 문의', '내 펀딩에 문의합니다', '{}', false)$q$, '%본인이 등록한 펀딩%', '1. creator cannot ask own funding');

-- 비로그인은 작성 불가
select pg_temp.as_user(null);
select pg_temp.expect_denied($q$select public.create_funding_product_inquiry('20000000-0000-0000-0000-0000000000fa', 'other', '비회원', '비회원 문의입니다', '{}', false)$q$, '1. anonymous cannot ask');

-- =========================================================================
-- 2. 공개 / 비공개 열람
-- =========================================================================

reset role;
set local role anon;
select pg_temp.as_user(null);
select pg_temp.assert((public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa') ->> 'total')::int = 2, '2. anon sees both rows in list');
select pg_temp.assert((
  select r ->> 'title' = '비공개 문의입니다.' and r ->> 'content' is null and r -> 'answer' = 'null'::jsonb and jsonb_array_length(r -> 'image_paths') = 0
  from jsonb_array_elements(public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa') -> 'rows') r
  where (r ->> 'is_private')::boolean), '2. anon: private inquiry masked');
select pg_temp.assert((
  select r ->> 'content' = '키 175 에 L 이 맞을까요?' from jsonb_array_elements(public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa') -> 'rows') r
  where not (r ->> 'is_private')::boolean), '2. anon: public inquiry visible');
select pg_temp.expect_denied($q$select * from public.funding_inquiries$q$, '2. anon direct table select blocked');
-- Storage: 공개 문의 사진만 읽힌다
select pg_temp.assert((select array_agg(name order by name) from storage.objects where bucket_id = 'funding-inquiries')
  = array['20000000-0000-0000-0000-0000000000c1/size.jpg'], '2. anon reads only public inquiry photo');
reset role;
set local role authenticated;

select pg_temp.as_user('20000000-0000-0000-0000-0000000000c2');
select pg_temp.assert((select count(id) from public.funding_inquiries) = 2, '2. other customer: RLS shows only public rows (FA+FB)');
select pg_temp.assert(not exists (select 1 from public.funding_inquiries where is_private), '2. other customer: no private rows via table');
select pg_temp.expect_denied($q$select answer_author_id from public.funding_inquiries$q$, '2. answerer account id not exposed');
select pg_temp.expect_denied($q$select hidden_reason from public.funding_inquiries$q$, '2. hidden reason not exposed');
select pg_temp.assert((select count(*) from storage.objects where bucket_id = 'funding-inquiries') = 2, '2. other customer: own photo + public photo');
select pg_temp.expect_error($q$select public.delete_my_funding_inquiry((select v from ids where k = 'public_q'))$q$, '%본인이 작성한%', '2. cannot delete others inquiry');
select pg_temp.expect_error($q$select public.update_my_funding_inquiry((select v from ids where k = 'public_q'), 'other', '수정', '남의 문의 수정 시도', '{}', false)$q$, '%본인이 작성한%', '2. cannot edit others inquiry');

select pg_temp.as_user('20000000-0000-0000-0000-0000000000c1');
select pg_temp.assert((
  select r ->> 'content' like '주문 번호%' from jsonb_array_elements(public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa', 'mine') -> 'rows') r
  where (r ->> 'is_private')::boolean), '2. author sees own private inquiry');
select pg_temp.assert((select count(*) from storage.objects where bucket_id = 'funding-inquiries') = 2, '2. author reads own photos');

-- 다른 제작자는 비공개 문의를 볼 수 없고 답변할 수 없다
select pg_temp.as_user('20000000-0000-0000-0000-00000000000b');
select pg_temp.assert(not exists (select 1 from public.funding_inquiries where is_private), '2. other creator: no private rows');
select pg_temp.assert(not ((public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa') -> 'viewer' ->> 'can_answer')::boolean), '2. other creator: cannot answer flag');
select pg_temp.expect_denied($q$select public.answer_funding_inquiry((select v from ids where k = 'public_q'), '다른 제작자의 답변')$q$, '2. other creator cannot answer');
select pg_temp.expect_denied($q$select public.set_funding_inquiry_status((select v from ids where k = 'public_q'), 'pending')$q$, '2. other creator cannot change status');

-- 담당 제작자: 비공개 포함 전체 열람
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(id) from public.funding_inquiries where funding_id = '20000000-0000-0000-0000-0000000000fa') = 2, '2. creator sees all own funding inquiries');
select pg_temp.assert((
  select bool_and((r ->> 'can_view')::boolean) from jsonb_array_elements(public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa') -> 'rows') r), '2. creator list unmasked');
select pg_temp.assert((select count(*) from storage.objects where bucket_id = 'funding-inquiries') = 2, '2. creator reads both photos of own funding');
select pg_temp.assert((select count(id) from public.funding_inquiries where funding_id = '20000000-0000-0000-0000-0000000000fb') = 1, '2. creator A sees FB public only');

-- =========================================================================
-- 3. 알림
-- =========================================================================

reset role;
select pg_temp.assert((select count(*) from public.community_notifications where recipient_id = '20000000-0000-0000-0000-00000000000a' and type = 'funding_inquiry') = 2, '3. creator A got 2 site notifications');
select pg_temp.assert((select count(*) from public.notification_logs where event_type = 'funding_inquiry_created' and channel = 'sms' and status = 'pending' and recipient_id = '20000000-0000-0000-0000-00000000000a') = 2, '3. creator A sms jobs pending');
select pg_temp.assert((select skip_reason from public.notification_logs where event_type = 'funding_inquiry_created' and channel = 'sms' and recipient_id = '20000000-0000-0000-0000-00000000000b') = '제작자가 SMS 수신을 끔', '3. creator B opted out of SMS → skipped');
-- 디스패처(service_role): 펀딩 성공 알림만 끈 제작자 A 의 문의 SMS 는 발송 대상이다
set local role service_role;
select pg_temp.assert((select count(*) from public.claim_notification_jobs(null, null, 20) where event_type = 'funding_inquiry_created' and phone = '01011110000') = 2, '3. claim returns creator A inquiry sms with phone');
-- 같은 작업은 두 번 가져가지 않는다(중복 발송 방지)
select pg_temp.assert((select count(*) from public.claim_notification_jobs(null, null, 20)) = 0, '3. no double claim');
reset role;
set local role authenticated;

-- =========================================================================
-- 4. 제작자 답변
-- =========================================================================

select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.assert(public.answer_funding_inquiry((select v from ids where k = 'public_q'), '키 175 라면 L 을 추천드립니다.') ->> 'answer_role' = 'creator', '4. creator answer role');
select pg_temp.assert((public.answer_funding_inquiry((select v from ids where k = 'public_q'), '키 175 라면 L 을 추천드립니다. (수정)') ->> 'first_answer')::boolean = false, '4. creator edits answer');
select pg_temp.assert(public.set_funding_inquiry_status((select v from ids where k = 'public_q'), 'pending') = 'pending', '4. creator marks as pending again');
select pg_temp.assert(public.set_funding_inquiry_status((select v from ids where k = 'public_q'), 'answered') = 'answered', '4. creator marks answered');
select pg_temp.expect_error($q$select public.set_funding_inquiry_status((select v from ids where k = 'private_q'), 'answered')$q$, '%답변을 먼저%', '4. cannot mark answered without answer');

reset role;
select pg_temp.assert((select count(*) from public.community_notifications where recipient_id = '20000000-0000-0000-0000-0000000000c1' and type = 'funding_inquiry_answer') = 1, '4. customer notified once (edit does not re-notify)');
select pg_temp.assert(not exists (select 1 from public.notification_logs where event_type = 'funding_inquiry_answered' and channel <> 'site'), '4. no customer sms job');
set local role authenticated;

-- 답변 후에는 작성자도 수정/삭제 불가
select pg_temp.as_user('20000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($q$select public.delete_my_funding_inquiry((select v from ids where k = 'public_q'))$q$, '%답변이 등록된%', '4. answered inquiry cannot be deleted');
select pg_temp.expect_error($q$select public.update_my_funding_inquiry((select v from ids where k = 'public_q'), 'other', '수정', '답변 후 수정 시도입니다', '{}', false)$q$, '%답변이 등록된%', '4. answered inquiry cannot be edited');
select pg_temp.assert((
  select r -> 'answer' ->> 'role' = 'creator' from jsonb_array_elements(public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa', 'mine') -> 'rows') r
  where r ->> 'id' = (select v::text from ids where k = 'public_q')), '4. customer sees creator answer');
-- 답변 전 문의는 수정 · 삭제 가능
select pg_temp.assert(public.update_my_funding_inquiry((select v from ids where k = 'fb_q'), 'fabric', '원단 두께 문의', '여름에도 입을 수 있는 두께인지 궁금합니다', '{}', true) = '{}'::text[], '4. author edits pending inquiry');
select pg_temp.assert(public.delete_my_funding_inquiry((select v from ids where k = 'fb_q')) = '{}'::text[], '4. author deletes pending inquiry');

-- =========================================================================
-- 5. 관리자
-- =========================================================================

-- 일반 회원 / 제작자는 관리자 RPC 를 호출할 수 없다
select pg_temp.as_user('20000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_denied($q$select public.admin_list_funding_inquiries()$q$, '5. customer → admin inquiries denied');
select pg_temp.expect_denied($q$select public.admin_list_ai_designs()$q$, '5. customer → admin ai designs denied');
select pg_temp.expect_denied($q$select public.admin_get_ai_design('ai:20000000-0000-0000-0000-0000000001a2')$q$, '5. customer → ai design detail denied');
select pg_temp.expect_denied($q$select public.admin_get_platform_overview()$q$, '5. customer → overview denied');
select pg_temp.expect_denied($q$select public.admin_set_funding_inquiry_hidden((select v from ids where k = 'public_q'), true, '스팸')$q$, '5. customer → hide denied');
select pg_temp.expect_denied($q$select public.admin_list_funding_reviews()$q$, '5. customer → admin reviews denied');
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.expect_denied($q$select public.admin_list_ai_designs()$q$, '5. creator → admin ai designs denied');
select pg_temp.expect_denied($q$select public.admin_get_funding_inquiry((select v from ids where k = 'private_q'))$q$, '5. creator → admin inquiry detail denied');

-- 운영 관리자(cs.view 만): 조회 가능, 답변 불가
select pg_temp.as_user('20000000-0000-0000-0000-0000000000a0');
select pg_temp.assert((public.admin_list_funding_inquiries() ->> 'total')::int = 2, '5. ops lists all inquiries');
select pg_temp.expect_denied($q$select public.answer_funding_inquiry((select v from ids where k = 'private_q'), '운영자 답변')$q$, '5. ops cannot answer (no cs.manage)');

-- CS 관리자: 비공개 포함 전체 조회 · 관리자 답변 · 숨김
select pg_temp.as_user('20000000-0000-0000-0000-0000000000c5');
select pg_temp.assert((public.admin_list_funding_inquiries('pending') ->> 'total')::int = 1, '5. cs filter pending');
select pg_temp.assert((public.admin_list_funding_inquiries('all', '20000000-0000-0000-0000-00000000000a') ->> 'total')::int = 2, '5. cs filter by creator');
select pg_temp.assert((public.admin_list_funding_inquiries('all', null, null, null, 'exchange_refund') ->> 'total')::int = 1, '5. cs filter by type');
select pg_temp.assert((public.admin_list_funding_inquiries('all', null, null, null, null, null, null, 'hoodie') ->> 'total')::int = 2, '5. cs search nickname');
select pg_temp.assert((public.admin_list_funding_inquiries('all', null, null, null, null, (now() + interval '2 day')::date) ->> 'total')::int = 0, '5. cs date filter');
select pg_temp.assert(public.admin_get_funding_inquiry((select v from ids where k = 'private_q')) ->> 'content' like '주문 번호%', '5. cs reads private content');
select pg_temp.assert(public.answer_funding_inquiry((select v from ids where k = 'private_q'), '환불 규정을 안내드립니다.') ->> 'answer_role' = 'admin', '5. admin answer role');
select public.admin_set_funding_inquiry_hidden((select v from ids where k = 'public_q'), true, '부적절한 표현');
select pg_temp.expect_error($q$select public.admin_set_funding_inquiry_hidden((select v from ids where k = 'private_q'), true, '')$q$, '%사유%', '5. hide requires reason');

-- 관리자 답변은 제작자가 덮어쓸 수 없다
select pg_temp.as_user('20000000-0000-0000-0000-00000000000a');
select pg_temp.expect_denied($q$select public.answer_funding_inquiry((select v from ids where k = 'private_q'), '제작자가 덮어쓰기')$q$, '5. creator cannot overwrite admin answer');

-- 숨김 문의는 공개 목록에서 사라지고 작성자에게는 남는다
reset role;
set local role anon;
select pg_temp.as_user(null);
select pg_temp.assert((public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa') ->> 'total')::int = 1, '5. hidden removed from public list');
select pg_temp.assert(not exists (select 1 from storage.objects where bucket_id = 'funding-inquiries'), '5. hidden inquiry photo no longer public');
reset role;
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-0000000000c1');
select pg_temp.assert((public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa', 'mine') ->> 'total')::int = 2, '5. author still sees hidden inquiry');
select pg_temp.assert((
  select r -> 'answer' ->> 'role' = 'admin' from jsonb_array_elements(public.list_funding_inquiries('20000000-0000-0000-0000-0000000000fa', 'mine') -> 'rows') r
  where (r ->> 'is_private')::boolean), '5. customer sees BRAND-ER admin answer');

reset role;
select pg_temp.assert((select count(*) from public.admin_audit_logs where target_type = 'funding_inquiry') = 2, '5. admin answer + hide audited');
select pg_temp.assert((select count(*) from public.community_notifications where recipient_id = '20000000-0000-0000-0000-0000000000c1' and type = 'funding_inquiry_answer') = 2, '5. customer notified for admin answer');
set local role authenticated;

-- =========================================================================
-- 6. AI 디자인 관리
-- =========================================================================

select pg_temp.as_user('20000000-0000-0000-0000-0000000000ad');
select pg_temp.assert((public.admin_list_ai_designs() -> 'counts') = '{"ai": 3, "all": 4, "upload": 1}'::jsonb, '6. counts: 3 ai (merged + plain + design-only), 1 upload, data: excluded');
select pg_temp.assert((public.admin_list_ai_designs('upload') -> 'rows' -> 0 ->> 'key') = 'upload:20000000-0000-0000-0000-0000000003e1', '6. upload filter');
select pg_temp.assert((public.admin_list_ai_designs('all', 'linked') ->> 'total')::int = 1, '6. funding linked filter');
select pg_temp.assert((public.admin_list_ai_designs('all', 'linked') -> 'rows' -> 0 -> 'funding' ->> 'name') = '고객1 니트', '6. linked funding name');
select pg_temp.assert((public.admin_list_ai_designs('all', 'unlinked') ->> 'total')::int = 3, '6. funding unlinked filter');
select pg_temp.assert((public.admin_list_ai_designs('all', 'all', 'oldest') -> 'rows' -> 0 ->> 'key') = 'ai:20000000-0000-0000-0000-0000000001a1', '6. oldest sort');
select pg_temp.assert((public.admin_list_ai_designs('all', 'all', 'latest', '20000000-0000-0000-0000-0000000000c2') ->> 'total')::int = 3, '6. member filter');
select pg_temp.assert((public.admin_list_ai_designs('all', 'all', 'latest', null, 'pants') ->> 'total')::int = 1, '6. category filter');
select pg_temp.assert((public.admin_list_ai_designs('all', 'all', 'latest', null, null, '케이블') ->> 'total')::int = 1, '6. keyword search');
select pg_temp.assert((
  select d ->> 'fit' = 'oversized' and d ->> 'color' = 'IVORY' and d ->> 'prompt' = '아이보리 케이블 니트' and d -> 'funding' ->> 'phase' is not null
  from public.admin_get_ai_design('ai:20000000-0000-0000-0000-0000000001a1') d), '6. detail merges design fit/color + funding phase');
select pg_temp.assert((
  select d ->> 'fit' is null and d ->> 'prompt' is null and jsonb_array_length(d -> 'extra' -> 'reference_image_paths') = 2
  from public.admin_get_ai_design('upload:20000000-0000-0000-0000-0000000003e1') d), '6. upload detail: no invented fields, references listed');
select pg_temp.assert((public.admin_ai_design_filter_options() -> 'categories') = '["hoodie", "jacket", "knit", "pants"]'::jsonb, '6. category options');

-- =========================================================================
-- 7. 대시보드 / 리뷰 관리
-- =========================================================================

select pg_temp.assert((
  select o ->> 'inquiries' = '2' and o ->> 'inquiries_pending' = '0' and o ->> 'inquiries_answered' = '1' and o ->> 'ai_images' = '4'
  from public.admin_get_platform_overview() o), '7. overview counts');
select pg_temp.as_user('20000000-0000-0000-0000-0000000000a0');
select pg_temp.assert((
  select o ->> 'ai_images' = '4' and o ->> 'fundings' = '4' from public.admin_get_platform_overview() o), '7. ops overview');

reset role;
set local session_replication_role = replica;
insert into public.funding_participations (id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price,
  status, payment_provider, payment_status, payment_approved_at, partner_order_id, orderer_name, orderer_phone, shipping_status, production_stage)
values ('20000000-0000-0000-0000-00000000a001', '20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-0000000000c1',
  'BLACK', 'M', 1, 39000, 'pledged', 'mock', 'paid', now(), 'BRANDER-INQ-1', '김고객', '010-3333-0000', 'delivered', 'delivered');
insert into public.funding_reviews (id, funding_id, participation_id, reviewer_id, rating, content, nickname)
values ('20000000-0000-0000-0000-000000000441', '20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-00000000a001',
  '20000000-0000-0000-0000-0000000000c1', 1, '광고성 링크가 포함된 리뷰입니다.', 'hoodie_fan');
set local session_replication_role = origin;
set local role authenticated;

select pg_temp.as_user('20000000-0000-0000-0000-0000000000c5');
select pg_temp.assert((public.admin_list_funding_reviews() ->> 'total')::int = 1, '7. cs lists reviews');
select public.admin_set_funding_review_status('20000000-0000-0000-0000-000000000441', 'hidden', '광고');
select pg_temp.assert((public.admin_list_funding_reviews('hidden') ->> 'total')::int = 1, '7. review hidden');
reset role;
set local role anon;
select pg_temp.assert((public.get_funding_reviews('20000000-0000-0000-0000-0000000000fa') -> 'summary' ->> 'count')::int = 0, '7. hidden review not public');
reset role;
set local role authenticated;
select pg_temp.as_user('20000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_denied($q$select public.admin_set_funding_review_status('20000000-0000-0000-0000-000000000441', 'visible')$q$, '7. customer cannot change review status');

reset role;
select 'ALL INQUIRY / AI DESIGN TESTS PASSED';
rollback;
