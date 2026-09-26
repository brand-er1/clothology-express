\set ON_ERROR_STOP 1
-- 컬러 옵션 / 컬러별 이미지 / 주문 컬러 연결 (20_tests.sql 의 t_ok/t_fail/t_eq 헬퍼 사용)
reset role;
truncate public._t;
select set_config('request.jwt.claim.sub','',false);

-- 백필: 기존 펀딩의 color_options → funding_colors, 원본 이미지 = 기준 컬러 앞면, 기존 주문 color_id
select t_eq('backfill legacy colors', $$select string_agg(name || ':' || is_base, ',' order by sort_order) from funding_colors where funding_id='00000000-0000-0000-0000-0000000f0001' and status='active'$$, 'black:true');
select t_eq('backfill base front image = funding image', $$select i.view || '/' || i.status || '/' || i.source || '/' || (i.image_url = f.image_url) from funding_color_images i join fundings f on f.id=i.funding_id where i.funding_id='00000000-0000-0000-0000-0000000f0001'$$, 'front/approved/original/true');
select t_eq('backfill legacy order color_id', $$select (color_id is not null) || '/' || color_name || '/' || (product_id = funding_id) from funding_participations where id='00000000-0000-0000-0000-0000000e0001'$$, 'true/black/true');

-- 신규 펀딩 등록(color_options) → 컬러 행 자동 생성
insert into public.fundings (id, creator_id, brand_id, product_name, cloth_type, material, size, image_url, moq, price, funding_days, status, reviewed_at, color_options, size_options, estimate_direct_unit_max, estimate_development_total, trademark_screening_required)
values ('00000000-0000-0000-0000-000000002001','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','컬러 후드','hoodie','cotton','M','https://x/hood.png',20,40000,30,'approved', now(), array['BLACK','NAVY'], array['M','L'], 9000, 10000, false);
select t_eq('insert creates colors in order', $$select string_agg(name, ',' order by sort_order) from funding_colors where funding_id='00000000-0000-0000-0000-000000002001' and status='active'$$, 'BLACK,NAVY');
select t_eq('first color is base', $$select name from funding_colors where funding_id='00000000-0000-0000-0000-000000002001' and is_base$$, 'BLACK');
select id as black_id from funding_colors where funding_id='00000000-0000-0000-0000-000000002001' and name='BLACK' \gset
select id as navy_id from funding_colors where funding_id='00000000-0000-0000-0000-000000002001' and name='NAVY' \gset

-- 제작자: 진행 중(승인된) 펀딩에도 컬러 추가/이름변경/순서변경/삭제 가능, color_options 자동 동기화
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_eq('creator adds BURGUNDY to approved funding', $$select name from save_funding_color('00000000-0000-0000-0000-000000002001', null, ' BURGUNDY ', '#6d1f2f')$$, 'BURGUNDY');
select t_eq('hex normalized upper', $$select hex from funding_colors where funding_id='00000000-0000-0000-0000-000000002001' and name='BURGUNDY'$$, '#6D1F2F');
select t_fail('duplicate color rejected (case-insensitive)', $$select save_funding_color('00000000-0000-0000-0000-000000002001', null, 'navy', null)$$, '이미 등록된');
select t_fail('bad hex rejected', $$select save_funding_color('00000000-0000-0000-0000-000000002001', null, 'GRAY', 'gray')$$, '#RRGGBB');
select t_ok('creator adds GRAY', $$select name from save_funding_color('00000000-0000-0000-0000-000000002001', null, 'GRAY', '#8A8A8A')$$);
select t_eq('options synced after add', $$select array_to_string(color_options, ',') from fundings where id='00000000-0000-0000-0000-000000002001'$$, 'BLACK,NAVY,BURGUNDY,GRAY');
select t_ok('creator renames GRAY → CHARCOAL', format('select name from save_funding_color(%L, (select id from funding_colors where funding_id=%L and name=%L), %L, %L)', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000002001', 'GRAY', 'CHARCOAL', '#3A3A3A'));
select t_ok('creator reorders', format('select reorder_funding_colors(%L, array[(select id from funding_colors where funding_id=%L and name=%L), %L::uuid, %L::uuid, (select id from funding_colors where funding_id=%L and name=%L)])::text', '00000000-0000-0000-0000-000000002001', '00000000-0000-0000-0000-000000002001', 'BURGUNDY', :'black_id', :'navy_id', '00000000-0000-0000-0000-000000002001', 'CHARCOAL'));
select t_eq('options follow new order', $$select array_to_string(color_options, ',') from fundings where id='00000000-0000-0000-0000-000000002001'$$, 'BURGUNDY,BLACK,NAVY,CHARCOAL');
select t_fail('creator cannot insert colors directly', $$insert into funding_colors (funding_id, name) values ('00000000-0000-0000-0000-000000002001', 'PINK')$$, 'permission denied');
reset role;

-- 다른 사용자/관리자 권한
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_fail('buyer cannot add color', $$select save_funding_color('00000000-0000-0000-0000-000000002001', null, 'PINK', null)$$, '권한');
select t_fail('buyer cannot see color summary', $$select count(*) from get_funding_color_summary('00000000-0000-0000-0000-000000002001')$$, '권한');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
select t_ok('admin (fundings.manage) can add color', $$select name from save_funding_color('00000000-0000-0000-0000-000000002001', null, 'IVORY', '#F4EFE3')$$);
select t_ok('admin deletes IVORY (soft)', format('select delete_funding_color((select id from funding_colors where funding_id=%L and name=%L and status=%L))::text', '00000000-0000-0000-0000-000000002001', 'IVORY', 'active'));
reset role;
select t_eq('soft-deleted color kept as row', $$select status from funding_colors where funding_id='00000000-0000-0000-0000-000000002001' and name='IVORY'$$, 'deleted');
select t_eq('options exclude deleted', $$select array_to_string(color_options, ',') from fundings where id='00000000-0000-0000-0000-000000002001'$$, 'BURGUNDY,BLACK,NAVY,CHARCOAL');

-- 컬러 이미지: AI 결과(preview)는 승인 전 고객에게 안 보임, 승인 시 이전 승인본은 replaced
insert into public.funding_color_images (id, color_id, funding_id, view, status, source, image_url, provider)
values ('00000000-0000-0000-0000-00000000c1a1', :'navy_id', '00000000-0000-0000-0000-000000002001', 'front', 'preview', 'ai', 'https://img.test/navy-front-1.png', 'fake'),
       ('00000000-0000-0000-0000-00000000c1a2', :'navy_id', '00000000-0000-0000-0000-000000002001', 'front', 'preview', 'ai', 'https://img.test/navy-front-2.png', 'fake'),
       ('00000000-0000-0000-0000-00000000c1a3', :'navy_id', '00000000-0000-0000-0000-000000002001', 'back', 'preview', 'ai', 'https://img.test/navy-back.png', 'fake');
select set_config('request.jwt.claim.sub','',false); set role anon;
select t_eq('anon sees active colors of public funding', $$select count(*)::text from funding_colors where funding_id='00000000-0000-0000-0000-000000002001'$$, '4');
select t_eq('anon does not see preview images', $$select count(*)::text from funding_color_images where funding_id='00000000-0000-0000-0000-000000002001'$$, '0');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_eq('creator sees previews', $$select count(*)::text from funding_color_images where funding_id='00000000-0000-0000-0000-000000002001' and status='preview'$$, '3');
select t_eq('approve navy front #1', $$select status from review_funding_color_image('00000000-0000-0000-0000-00000000c1a1', 'approve')$$, 'approved');
select t_eq('approve navy front #2 replaces #1', $$select status from review_funding_color_image('00000000-0000-0000-0000-00000000c1a2', 'approve')$$, 'approved');
select t_eq('previous approved -> replaced', $$select status from funding_color_images where id='00000000-0000-0000-0000-00000000c1a1'$$, 'replaced');
select t_eq('reject navy back', $$select status from review_funding_color_image('00000000-0000-0000-0000-00000000c1a3', 'reject')$$, 'rejected');
select t_ok('upload replaces black front', format('select status from register_funding_color_image_upload(%L, %L, %L)', :'black_id', 'front', 'https://img.test/black-upload.png'));
select t_fail('upload requires https', format('select register_funding_color_image_upload(%L, %L, %L)', :'black_id', 'back', 'javascript:alert(1)'), '주소');
reset role;
select set_config('request.jwt.claim.sub','',false); set role anon;
select t_eq('anon sees only approved images', $$select string_agg(image_url, ',' order by image_url) from funding_color_images where funding_id='00000000-0000-0000-0000-000000002001'$$, 'https://img.test/black-upload.png,https://img.test/navy-front-2.png');
reset role;

-- 주문(모의결제): 컬러 필수 + color_id/color_name/product_id 저장
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_ok('order NAVY x3', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000002001','NAVY','M',3,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$);
select t_ok('order BURGUNDY x2', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000002001','BURGUNDY','L',2,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$);
select t_ok('order BLACK x5', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000002001','BLACK','M',5,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$);
select t_fail('deleted color cannot be ordered', $$select create_mock_funding_order('00000000-0000-0000-0000-000000002001','IVORY','M',1,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$, '컬러');
reset role;
select t_eq('order stores color_id/name/product', $$select count(*) filter (where color_id=c.id and color_name='NAVY' and product_id=fp.funding_id)::text from funding_participations fp join funding_colors c on c.funding_id=fp.funding_id and c.name='NAVY' where fp.funding_id='00000000-0000-0000-0000-000000002001' and fp.selected_color='NAVY'$$, '1');

-- 이름 변경 후에도 기존 주문은 같은 color_id 로 집계
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_ok('rename NAVY → DEEP NAVY', format('select name from save_funding_color(%L, %L, %L, null)', '00000000-0000-0000-0000-000000002001', :'navy_id', 'DEEP NAVY'));
select t_eq('color summary', $$select string_agg(color_name || '=' || paid_quantity, ', ' order by sort_order) from get_funding_color_summary('00000000-0000-0000-0000-000000002001') where color_status='active'$$, 'BURGUNDY=2, BLACK=5, DEEP NAVY=3, CHARCOAL=0');
select t_fail('cannot delete last color', $$select delete_funding_color((select id from funding_colors where funding_id='00000000-0000-0000-0000-0000000f0001' and status='active'))$$, '최소 1개');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_eq('ops admin sees summary total', $$select sum(paid_quantity)::text from get_funding_color_summary('00000000-0000-0000-0000-000000002001')$$, '10');
reset role;

-- 기존 편집 경로(color_options 직접 수정)도 컬러 행에 반영
update public.fundings set color_options = array['BURGUNDY','BLACK','DEEP NAVY','WHITE'] where id='00000000-0000-0000-0000-000000002001';
select t_eq('options edit reconciles colors', $$select string_agg(name, ',' order by sort_order) from funding_colors where funding_id='00000000-0000-0000-0000-000000002001' and status='active'$$, 'BURGUNDY,BLACK,DEEP NAVY,WHITE');
select t_eq('removed via options is soft-deleted', $$select status from funding_colors where funding_id='00000000-0000-0000-0000-000000002001' and name='CHARCOAL'$$, 'deleted');

-- AI 사용량: 컬러 이미지 기능
select t_eq('color_image quota precheck', $$select ai_usage_precheck('00000000-0000-0000-0000-00000000c001','color_image',null)->>'allowed'$$, 'true');
select t_ok('log color usage with funding', $$select log_ai_usage('00000000-0000-0000-0000-00000000c001','color_image','success','fake','fake',null,'color_front',10,null,'{}'::jsonb,'00000000-0000-0000-0000-000000002001')::text$$);
select t_eq('usage row has funding', $$select funding_id::text from ai_usage_logs where feature='color_image' order by created_at desc limit 1$$, '00000000-0000-0000-0000-000000002001');
select t_ok('legacy log_ai_usage call still works', $$select log_ai_usage('00000000-0000-0000-0000-00000000c001','detail_image','success','fake','fake','00000000-0000-0000-0000-0000000d0001','hero',10,null,'{}'::jsonb)::text$$);
