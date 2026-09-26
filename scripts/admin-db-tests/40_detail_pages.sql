\set ON_ERROR_STOP 1
-- AI 상세페이지: 게시/버전/참고자료/AI 사용량 한도/권한 (20_tests.sql 의 t_ok/t_fail/t_eq 헬퍼 사용)
reset role;
truncate public._t;
-- funding row 보존 확인용 해시
select md5(row(f.*)::text) as funding_hash from public.fundings f where id = '00000000-0000-0000-0000-0000000f0001' \gset
select count(*) as participation_count from public.funding_participations where funding_id = '00000000-0000-0000-0000-0000000f0001' \gset

-- 백필: 기존 연결 상세페이지는 현재 내용 그대로 게시본 v1
select t_eq('legacy linked page backfilled as published v1', $$select published_version || '/' || (published_document #>> '{page,title}') || '/' || jsonb_array_length(published_document->'sections') from product_detail_pages where id='00000000-0000-0000-0000-0000000d0001'$$, '1/레거시 후드티/2');
select t_eq('backfill version kind migrated', $$select kind from detail_page_versions where detail_page_id='00000000-0000-0000-0000-0000000d0001' and version=1$$, 'migrated');

-- 고객(anon): 공개 펀딩의 게시본만 RPC 로 보인다. 초안 테이블은 직접 조회 불가.
select set_config('request.jwt.claim.sub','',false); set role anon;
select t_eq('anon sees published doc via rpc', $$select get_published_detail_page('00000000-0000-0000-0000-0000000f0001') #>> '{document,page,title}'$$, '레거시 후드티');
select t_eq('anon cannot read draft table', $$select count(*)::text from product_detail_pages$$, '0');
select t_eq('anon cannot read draft sections', $$select count(*)::text from detail_page_sections$$, '0');
reset role;

-- 제작자: 초안 수정은 게시본에 영향 없음
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_ok('creator saves draft', $$select save_product_detail_page('00000000-0000-0000-0000-0000000d0001', '{"title":"새 제목","template":"vintage"}'::jsonb, (select jsonb_agg(jsonb_build_object('id',id,'section_type',section_type,'sort_order',sort_order,'content',content,'images',images)) from detail_page_sections where detail_page_id='00000000-0000-0000-0000-0000000d0001'))::text$$);
select t_eq('published unchanged after draft save', $$select get_published_detail_page('00000000-0000-0000-0000-0000000f0001') #>> '{document,page,title}'$$, '레거시 후드티');
select t_eq('publish state shows unpublished changes', $$select get_detail_page_publish_state('00000000-0000-0000-0000-0000000d0001')->>'has_unpublished_changes'$$, 'true');
select t_ok('creator creates manual version', $$select create_detail_page_version('00000000-0000-0000-0000-0000000d0001','manual_save','임시저장')::text$$);
select t_fail('creator cannot write published_document directly', $$update product_detail_pages set published_document='{}' where id='00000000-0000-0000-0000-0000000d0001'$$, '상세페이지 적용');
select t_eq('creator publishes', $$select publish_detail_page('00000000-0000-0000-0000-0000000d0001')->>'published_version'$$, '3');
reset role; set role anon; select set_config('request.jwt.claim.sub','',false);
select t_eq('anon sees new published title', $$select get_published_detail_page('00000000-0000-0000-0000-0000000f0001') #>> '{document,page,title}'$$, '새 제목');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_eq('versions listed', $$select string_agg(version||':'||kind, ',' order by version) from list_detail_page_versions('00000000-0000-0000-0000-0000000d0001')$$, '1:migrated,2:manual_save,3:published');
select t_ok('restore v1 (backs up current first)', $$select restore_detail_page_version('00000000-0000-0000-0000-0000000d0001', (select id from list_detail_page_versions('00000000-0000-0000-0000-0000000d0001') where version=1))::text$$);
select t_eq('draft restored to v1 title', $$select title from product_detail_pages where id='00000000-0000-0000-0000-0000000d0001'$$, '레거시 후드티');
select t_eq('restore backup version created', $$select kind from list_detail_page_versions('00000000-0000-0000-0000-0000000d0001') where version=4$$, 'restore_backup');
select t_eq('published still v3 after restore', $$select get_published_detail_page('00000000-0000-0000-0000-0000000f0001') ->> 'published_version'$$, '3');
-- 참고자료
select t_ok('creator adds reference', $$insert into detail_page_references (detail_page_id, funding_id, user_id, kind, url, storage_path) values ('00000000-0000-0000-0000-0000000d0001','00000000-0000-0000-0000-0000000f0001',auth.uid(),'fabric','https://x/fabric.webp', auth.uid()||'/detail-pages/ref.webp') returning kind$$);
select t_fail('reference path must be own folder', $$insert into detail_page_references (detail_page_id, user_id, kind, url, storage_path) values ('00000000-0000-0000-0000-0000000d0001',auth.uid(),'fabric','https://x/a.webp','someone-else/a.webp')$$, 'row-level security');
select t_fail('pdf not yet allowed', $$insert into detail_page_references (detail_page_id, user_id, kind, url, mime_type) values ('00000000-0000-0000-0000-0000000d0001',auth.uid(),'reference','https://x/a.pdf','application/pdf')$$, 'mime');
select t_ok('creator quota view', $$select get_my_ai_quota()::text$$);
reset role;

-- 다른 회원: 남의 상세페이지 접근/생성/수정 불가
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b002',false); set role authenticated;
select t_eq('other user cannot select page', $$select count(*)::text from product_detail_pages where id='00000000-0000-0000-0000-0000000d0001'$$, '0');
select t_fail('other user cannot save', $$select save_product_detail_page('00000000-0000-0000-0000-0000000d0001','{"title":"해킹"}','[]')$$, '권한');
select t_fail('other user cannot publish', $$select publish_detail_page('00000000-0000-0000-0000-0000000d0001')$$, '권한');
select t_fail('other user cannot list versions', $$select * from list_detail_page_versions('00000000-0000-0000-0000-0000000d0001')$$, '권한');
select t_fail('other user cannot restore', $$select restore_detail_page_version('00000000-0000-0000-0000-0000000d0001', gen_random_uuid())$$, '권한');
select t_fail('other user cannot create page on others funding', $$insert into product_detail_pages (user_id, funding_id) values (auth.uid(),'00000000-0000-0000-0000-0000000f0001')$$, 'row-level security');
select t_fail('other user cannot add reference to others page', $$insert into detail_page_references (detail_page_id, user_id, kind, url) values ('00000000-0000-0000-0000-0000000d0001',auth.uid(),'fabric','https://x/b.webp')$$, 'row-level security');
select t_eq('other user sees no references', $$select count(*)::text from detail_page_references$$, '0');
select t_fail('member cannot call usage precheck', $$select ai_usage_precheck(auth.uid(),'detail_image')$$, 'permission denied');
select t_fail('member cannot view ai usage', $$select admin_get_ai_usage(now()-interval '1 day', now())$$, '권한');
reset role;

-- 관리자: 조회 가능(수정 불가), AI 사용량은 Super Admin 만
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_eq('ops can read draft page', $$select count(*)::text from product_detail_pages where id='00000000-0000-0000-0000-0000000d0001'$$, '1');
select t_ok('ops can list versions', $$select count(*)::text from list_detail_page_versions('00000000-0000-0000-0000-0000000d0001')$$);
select t_fail('ops cannot publish creators page', $$select publish_detail_page('00000000-0000-0000-0000-0000000d0001')$$, '권한');
select t_fail('ops cannot view ai usage', $$select admin_get_ai_usage(now()-interval '1 day', now())$$, 'ai_usage.view');
reset role;

-- AI 사용량 한도 (service_role = Edge Function)
update public.platform_settings set value = '2'::jsonb where key = 'ai_detail_image_daily_limit';
set role service_role;
select t_eq('precheck allowed #1', $$select ai_usage_precheck('00000000-0000-0000-0000-00000000c001','detail_image','00000000-0000-0000-0000-0000000d0001')->>'allowed'$$, 'true');
select t_ok('log success', $$select log_ai_usage('00000000-0000-0000-0000-00000000c001','detail_image','success','gemini','gemini-3.1-flash-image','00000000-0000-0000-0000-0000000d0001','hero',1200)::text$$);
select t_ok('log failed', $$select log_ai_usage('00000000-0000-0000-0000-00000000c001','detail_image','failed','gemini',null,'00000000-0000-0000-0000-0000000d0001','fabric',800,'no image')::text$$);
select t_eq('precheck rejected after limit', $$select ai_usage_precheck('00000000-0000-0000-0000-00000000c001','detail_image','00000000-0000-0000-0000-0000000d0001')->>'allowed'$$, 'false');
reset role;
select t_eq('usage log funding linked + cost', $$select funding_id::text || '/' || estimated_cost_usd from ai_usage_logs where status='success' limit 1$$, '00000000-0000-0000-0000-0000000f0001/0.0400');
select t_eq('rejected logged', $$select count(*)::text from ai_usage_logs where status='rejected_quota'$$, '1');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
select t_eq('super views ai usage', $$select (admin_get_ai_usage(now()-interval '1 day', now()+interval '1 minute')->'totals'->>'image_success')$$, '1');
select t_eq('super context has ai_usage.view', $$select (get_my_admin_context()->'permissions') ? 'ai_usage.view' $$, 'true');
reset role;
update public.platform_settings set value = '40'::jsonb where key = 'ai_detail_image_daily_limit';

-- 기존 펀딩/참여 데이터 불변
select t_eq('funding row untouched by publish/restore', format($$select md5(row(f.*)::text) from fundings f where id='00000000-0000-0000-0000-0000000f0001'$$), :'funding_hash');
select t_eq('participations untouched', $$select count(*)::text from funding_participations where funding_id='00000000-0000-0000-0000-0000000f0001'$$, :'participation_count');
select t_ok('flat_lay image type accepted', $$insert into generated_assets (user_id, detail_page_id, image_type, reference_image) values ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000d0001','flat_lay','https://x/img.png') returning image_type$$);
