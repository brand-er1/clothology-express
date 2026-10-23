\set ON_ERROR_STOP 1
-- 판매자 센터 · 리뷰 확장 · 정산 모의결제 제외 · 매거진 확장 검증
reset role;
truncate public._t;
create table if not exists public._ids (k text primary key, v uuid);
truncate public._ids;
grant select on public._ids to authenticated, anon;

\set A '00000000-0000-0000-0000-00000000c001'
\set B '00000000-0000-0000-0000-00000000c002'
\set FA '00000000-0000-0000-0000-0000000f000a'
\set FB '00000000-0000-0000-0000-0000000f000b'

-- ---------------------------------------------------------------------------
-- 정산: 모의결제 제외
-- ---------------------------------------------------------------------------
select public._settlement_recalculate('00000000-0000-0000-0000-00000005e001');
select t_eq('settlement gross excludes mock', $$select gross_amount || '/' || refund_amount || '/' || net_sales || '/' || mock_amount || '/' || final_amount from settlements where id='00000000-0000-0000-0000-00000005e001'$$, '150000/50000/100000/50000/90000');
select t_eq('settlement calculation flags mock excluded', $$select (calculation->>'mock_excluded') || '/' || (calculation->>'includes_mock_payments') from settlements where id='00000000-0000-0000-0000-00000005e001'$$, 'true/false');

-- 모의결제 RPC 는 브라우저(authenticated)가 실행할 수 없다 (운영 MOCK 결제 차단)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_fail('browser cannot create mock paid order', $$select create_mock_funding_order('00000000-0000-0000-0000-0000000f000a','black','M',1,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울','','',true)$$, 'permission denied');

-- ---------------------------------------------------------------------------
-- 리뷰 작성 (세부 평가) · 모의결제 구분
-- ---------------------------------------------------------------------------
select t_ok('buyer1 creates review with sub-ratings', $$select create_funding_review('00000000-0000-0000-0000-0000000e0001', 5, '핏이 좋고 원단이 탄탄합니다. 만족해요.', '{}', 'true_to_size', 5, 4)::text$$);
select t_fail('duplicate review blocked', $$select create_funding_review('00000000-0000-0000-0000-0000000e0001', 4, '두 번째 리뷰를 써봅니다 테스트', '{}')$$, '이미');
select t_fail('unpaid order cannot be reviewed', $$select create_funding_review('00000000-0000-0000-0000-0000000e0004', 4, '결제 안 한 주문 리뷰 테스트', '{}')$$, '결제 완료');
reset role;
insert into _ids select 'r1', id from funding_reviews where participation_id='00000000-0000-0000-0000-0000000e0001';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_fail('invalid fit value rejected', $$select create_funding_review('00000000-0000-0000-0000-0000000e0004', 4, '잘못된 핏 값 테스트입니다', '{}', 'huge')$$, '');
select t_fail('foreign image path rejected', $$select update_my_funding_review((select v from _ids where k='r1'), 5, '다른 사람 사진 경로 테스트', array['00000000-0000-0000-0000-00000000b002/x.jpg'])$$, '경로');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b003',false); set role authenticated;
select t_fail('refunded order cannot be reviewed', $$select create_funding_review('00000000-0000-0000-0000-0000000e0003', 1, '환불한 주문 리뷰를 써봅니다', '{}')$$, '취소');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b002',false); set role authenticated;
select t_ok('mock-order buyer creates review (legacy 4-arg call)', $$select create_funding_review('00000000-0000-0000-0000-0000000e0002', 2, '사이즈가 생각보다 작았어요. 아쉽습니다.', '{}')::text$$);
reset role;
insert into _ids select 'r2', id from funding_reviews where participation_id='00000000-0000-0000-0000-0000000e0002';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b002',false); set role authenticated;
select t_fail('buyer2 cannot edit buyer1 review', $$select update_my_funding_review((select r.id from get_funding_reviews('00000000-0000-0000-0000-0000000f000a') g, jsonb_array_elements(g->'rows') e, lateral (select (e->>'id')::uuid as id) r where e->>'rating'='5'), 1, '남의 리뷰를 바꿔봅니다 테스트', '{}')$$, '본인');
select t_fail('buyer cannot write review table directly', $$update funding_reviews set rating = 1$$, 'permission denied');
reset role;

set role anon;
select t_eq('public summary count/verified/fit', $$select (s->>'count') || '/' || (s->>'verified_count') || '/' || (s->'fit'->>'true_to_size') || '/' || (s->>'quality_average') from (select get_funding_reviews('00000000-0000-0000-0000-0000000f000a')->'summary' s) x$$, '2/1/1/5.0');
select t_eq('mock review marked unverified', $$select string_agg((e->>'rating') || ':' || (e->>'verified_purchase') || ':' || (e->>'purchase_type'), ',' order by e->>'rating') from jsonb_array_elements(get_funding_reviews('00000000-0000-0000-0000-0000000f000a')->'rows') e$$, '2:false:mock,5:true:paid');
select t_eq('photo-only filter returns none', $$select (get_funding_reviews('00000000-0000-0000-0000-0000000f000a', 'latest', 20, 0, true)->>'total')$$, '0');
reset role;

-- 작성자 수정
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_ok('owner edits own review', $$select update_my_funding_review((select (e->>'id')::uuid from jsonb_array_elements(get_funding_reviews('00000000-0000-0000-0000-0000000f000a')->'rows') e where (e->>'is_mine')::boolean), 4, '한 달 입어보니 보풀이 조금 생겨요. 그래도 만족.', '{}', 'large', 3, 5)::text$$);
select t_eq('edit applied with edited_at', $$select (e->>'rating') || '/' || (e->>'fit_rating') || '/' || ((e->>'edited_at') is not null)::text from jsonb_array_elements(get_funding_reviews('00000000-0000-0000-0000-0000000f000a')->'rows') e where (e->>'is_mine')::boolean$$, '4/large/true');
reset role;

-- ---------------------------------------------------------------------------
-- 판매자 답변 · 신고 · 조작 차단
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub',:'A',false); set role authenticated;
select t_eq('seller A lists own reviews', $$select (r->>'total') || '/' || (r->'stats'->>'unanswered') || '/' || (r->'stats'->>'mock_count') from (select seller_list_reviews() r) x$$, '2/2/1');
select t_eq('seller rating filter', $$select seller_list_reviews(null, 2)->>'total'$$, '1');
select t_ok('seller A replies', $$select seller_reply_funding_review((select v from _ids where k='r2'), '불편을 드려 죄송합니다. 교환 도와드릴게요.')::text$$);
select t_eq('first reply has no updated_at', $$select (e->'seller_reply'->>'updated_at' is null)::text from jsonb_array_elements(seller_list_reviews()->'rows') e where e->>'purchase_type'='mock'$$, 'true');
select t_ok('seller A edits reply', $$select seller_reply_funding_review((select v from _ids where k='r2'), '불편을 드려 죄송합니다. 교환·환불 모두 가능합니다.')::text$$);
select t_eq('unanswered decreases', $$select seller_list_reviews()->'stats'->>'unanswered'$$, '1');
select t_eq('answered filter', $$select seller_list_reviews(null, null, 'answered')->>'total'$$, '1');
select t_fail('seller cannot change rating directly', $$update funding_reviews set rating = 5$$, 'permission denied');
select t_fail('seller cannot delete review', $$select delete_my_funding_review((select v from _ids where k='r2'))$$, '본인');
select t_fail('empty reply rejected', $$select seller_reply_funding_review((select v from _ids where k='r1'), ' ')$$, '2~1000');
select t_ok('seller A reports review', $$select seller_report_funding_review((select v from _ids where k='r2'), 'abusive', '욕설 포함')::text$$);
reset role;
insert into _ids select 'rep', id from funding_review_reports;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_fail('duplicate pending report', $$select seller_report_funding_review((select v from _ids where k='r2'), 'spam')$$, '이미');
select t_fail('other reason needs detail', $$select seller_report_funding_review((select v from _ids where k='r1'), 'other', '')$$, '기타');
select t_eq('report does not hide review', $$select (get_funding_reviews('00000000-0000-0000-0000-0000000f000a')->'summary'->>'count')$$, '2');
select t_fail('seller A cannot list B funding reviews', $$select seller_list_reviews('00000000-0000-0000-0000-0000000f000b')$$, '본인');
reset role;

set role anon;
select t_eq('public shows seller reply', $$select e->'seller_reply'->>'content' from jsonb_array_elements(get_funding_reviews('00000000-0000-0000-0000-0000000f000a')->'rows') e where e->>'purchase_type'='mock'$$, '불편을 드려 죄송합니다. 교환·환불 모두 가능합니다.');
reset role;

select set_config('request.jwt.claim.sub',:'B',false); set role authenticated;
select t_fail('seller B cannot reply to A review', $$select seller_reply_funding_review((select v from _ids where k='r1'), '남의 리뷰 답변')$$, '본인');
select t_fail('seller B cannot report A review', $$select seller_report_funding_review((select v from _ids where k='r1'), 'spam')$$, '본인');
select t_eq('seller B sees no A reviews', $$select seller_list_reviews()->>'total'$$, '0');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_fail('buyer cannot reply as seller', $$select seller_reply_funding_review((select v from _ids where k='r1'), '구매자 답변 시도')$$, '본인');
select t_fail('buyer cannot list reports', $$select admin_list_review_reports()$$, '');
reset role;

-- 관리자 신고 처리
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a003',false); set role authenticated;
select t_eq('cs admin sees pending report', $$select (r->'counts'->>'pending') || '/' || (r->>'can_resolve') from (select admin_list_review_reports() r) x$$, '1/true');
select t_fail('resolution needs note', $$select admin_resolve_review_report((select v from _ids where k='rep'), 'hide', '')$$, '사유');
select t_ok('cs admin hides reported review', $$select admin_resolve_review_report((select v from _ids where k='rep'), 'hide', '욕설 확인')::text$$);
select t_fail('already resolved', $$select admin_resolve_review_report((select v from _ids where k='rep'), 'keep', '재처리')$$, '이미');
reset role;
select t_eq('hide audited', $$select count(*)::text from admin_audit_logs where action = 'review_report.hide'$$, '1');
set role anon;
select t_eq('hidden review leaves public list', $$select get_funding_reviews('00000000-0000-0000-0000-0000000f000a')->'summary'->>'count'$$, '1');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b002',false); set role authenticated;
select t_fail('owner cannot edit hidden review', $$select update_my_funding_review((select v from _ids where k='r2'), 5, '숨김 리뷰를 고쳐서 다시 올리기', '{}')$$, '숨김');
reset role;

-- ---------------------------------------------------------------------------
-- 판매자 대시보드 · 주문 · 엑셀 · 문의 · 정산
-- ---------------------------------------------------------------------------
set role anon;
select t_fail('anon cannot open seller dashboard', $$select seller_get_dashboard()$$, '');
reset role;

select set_config('request.jwt.claim.sub',:'A',false); set role authenticated;
select t_eq('dashboard money split (sales/paid/refund/mock)', $$select (k->>'total_sales') || '/' || (k->>'paid_amount') || '/' || (k->>'refunded_amount') || '/' || (k->>'mock_amount') from (select seller_get_dashboard()->'kpis' k) x$$, '150000/100000/50000/50000');
select t_eq('dashboard counts', $$select (k->>'active_fundings') || '/' || (k->>'total_orders') || '/' || (k->>'cancelled_orders') || '/' || (k->>'refunded_orders') || '/' || (k->>'pending_inquiries') from (select seller_get_dashboard()->'kpis' k) x$$, '1/2/1/1/1');
select t_eq('dashboard settlement scheduled', $$select seller_get_dashboard()->'kpis'->>'settlement_scheduled'$$, '90000');
select t_eq('daily series sums real only', $$select sum((e->>'real_amount')::bigint)::text || '/' || sum((e->>'mock_amount')::bigint)::text || '/' || count(*)::text from jsonb_array_elements(seller_get_dashboard('day')->'series') e$$, '150000/50000/30');
select t_eq('weekly series has 12 buckets', $$select jsonb_array_length(seller_get_dashboard('week')->'series')::text$$, '12');
select t_eq('monthly series has 12 buckets', $$select jsonb_array_length(seller_get_dashboard('month')->'series')::text$$, '12');
select t_eq('product row real vs mock', $$select (p->>'real_amount') || '/' || (p->>'mock_amount') || '/' || (p->>'review_count') from jsonb_array_elements(seller_get_dashboard()->'products') p$$, '100000/50000/1');
select t_eq('brand row', $$select (b->>'brand_name') || '/' || (b->>'real_amount') from jsonb_array_elements(seller_get_dashboard()->'brands') b$$, 'ALPHA/100000');
select t_fail('invalid range rejected', $$select seller_get_dashboard('day', '2026-10-10', '2026-10-01')$$, '시작일');

select t_eq('products list', $$select (p->>'product_name') || '/' || (p->>'real_paid_orders') || '/' || (p->>'mock_orders') || '/' || (p->>'pending_payment_orders') || '/' || (p->>'can_request_early_close') from jsonb_array_elements(seller_list_products()) p$$, '알파 후드/1/1/1/true');

select t_eq('orders list total (excludes failed)', $$select seller_list_orders()->>'total'$$, '4');
select t_eq('orders mock filter', $$select seller_list_orders(null, null, 'all', 'mock')->>'total'$$, '1');
select t_eq('orders cancelled filter', $$select seller_list_orders(null, null, 'cancelled')->>'total'$$, '1');
select t_eq('orders list masks PII', $$select bool_and(not (e ? 'address') and not (e ? 'buyer_phone') and not (e ? 'buyer_email') and (e->>'buyer_name') like '%*%')::text from jsonb_array_elements(seller_list_orders()->'rows') e$$, 'true');
select t_eq('orders search by order number', $$select seller_list_orders(null, 'BRANDER-A3')->'rows'->0->>'order_number'$$, 'BRANDER-A3');
select t_fail('seller A cannot list B orders', $$select seller_list_orders('00000000-0000-0000-0000-0000000f000b')$$, '본인');
select t_eq('export gives address for active orders only', $$select string_agg((e->>'order_number') || ':' || coalesce(e->>'address', '-'), ',' order by e->>'order_number') from jsonb_array_elements(seller_export_orders()->'rows') e$$, 'BRANDER-A1:서울 강남구 1,BRANDER-A2:부산 해운대구 2,BRANDER-A3:-,BRANDER-A4:서울 강남구 1');
select t_fail('seller A cannot export B orders', $$select seller_export_orders('00000000-0000-0000-0000-0000000f000b')$$, '본인');

select t_eq('seller sees private inquiry content', $$select (r->'counts'->>'pending') || '/' || (r->'rows'->0->>'content') from (select seller_list_inquiries() r) x$$, '1/M 사이즈 어깨 너비가 궁금합니다.');
select t_eq('seller settlements (no internal memo)', $$select (s->>'final_amount') || '/' || (s ? 'memo')::text from jsonb_array_elements(seller_list_settlements()->'settlements') s$$, '90000/false');
select t_eq('seller sees only own export log (RLS)', $$select count(*)::text || '/' || bool_and(actor_id = auth.uid())::text from buyer_export_logs$$, '1/true');
select t_fail('seller cannot forge export log', $$insert into buyer_export_logs (actor_id, actor_role, scope, row_count) values (auth.uid(), 'creator', 'x', 0)$$, 'permission denied');
reset role;
select t_eq('export logged with seller scope', $$select count(*)::text from buyer_export_logs where actor_id='00000000-0000-0000-0000-00000000c001' and scope='seller_center'$$, '1');

select set_config('request.jwt.claim.sub',:'B',false); set role authenticated;
select t_eq('seller B dashboard only own', $$select (k->>'paid_amount') || '/' || (k->>'mock_amount') || '/' || (k->>'pending_inquiries') from (select seller_get_dashboard()->'kpis' k) x$$, '90000/0/0');
select t_eq('seller B orders only own', $$select seller_list_orders()->>'total'$$, '1');
select t_eq('seller B sees no A inquiries', $$select seller_list_inquiries()->>'total'$$, '0');
select t_eq('seller B unsettled list', $$select (u->>'funding_name') || '/' || (u->>'real_amount') from jsonb_array_elements(seller_list_settlements()->'unsettled') u$$, '브라보 셔츠/90000');
select t_fail('seller B cannot advance A production', $$select creator_update_production_stage('00000000-0000-0000-0000-0000000f000a','fabric_contact')$$, '본인');
reset role;

-- ---------------------------------------------------------------------------
-- 매거진 확장
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
select t_ok('save interview with body and SEO', $$select admin_save_magazine_article(null, '{"slug":"creator-interview-alpha","category":"creator_interview","title":"알파 제작자 인터뷰","publisher":"BRAND-ER","published_at":"2026-10-22","summary":"알파 브랜드 이야기","body":"첫 문단\n\n둘째 문단","seo_title":"알파 인터뷰 | BRAND-ER","seo_description":"알파 브랜드 제작자 인터뷰","is_published":true}'::jsonb)->>'slug'$$);
select t_fail('unknown category rejected', $$select admin_save_magazine_article(null, '{"slug":"bad-cat","category":"gossip","title":"x","publisher":"y","published_at":"2026-10-22"}'::jsonb)$$, '카테고리');
select t_fail('press requires source url', $$select admin_save_magazine_article(null, '{"slug":"press-no-url","category":"press","title":"x","publisher":"y","published_at":"2026-10-22"}'::jsonb)$$, '원문');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_fail('member cannot save article', $$select admin_save_magazine_article(null, '{"slug":"hack","category":"brand_news","title":"x","publisher":"y","published_at":"2026-10-22"}'::jsonb)$$, '');
reset role;
set role anon;
select t_eq('public reads seo fields', $$select seo_title || '/' || category from magazine_articles where slug='creator-interview-alpha'$$, '알파 인터뷰 | BRAND-ER/creator_interview');
reset role;

-- ---------------------------------------------------------------------------
-- 관리자 제작 의뢰
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_fail('member cannot list production requests', $$select admin_list_production_requests()$$, '권한');
select t_fail('member cannot change production request', $$select admin_set_production_request_status('00000000-0000-0000-0000-00000000d001','approved')$$, '권한');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a003',false); set role authenticated;
select t_eq('cs admin lists (draft excluded) with counts', $$select (r->'counts'->>'all') || '/' || (r->'counts'->>'pending') || '/' || (r->>'total') || '/' || (r->>'can_manage') from (select admin_list_production_requests() r) x$$, '3/2/2/false');
select t_eq('source filter', $$select admin_list_production_requests('all','ready_made_group_wear')->'rows'->0->>'request_title'$$, '3학년 반티');
select t_eq('search by title', $$select admin_list_production_requests('all','all','브랜드')->'rows'->0->>'id'$$, '00000000-0000-0000-0000-00000000d002');
select t_fail('cs admin cannot change status', $$select admin_set_production_request_status('00000000-0000-0000-0000-00000000d001','approved')$$, '권한');
reset role;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
select t_eq('super admin sees guest contact', $$select (e->>'guest_phone') || '/' || (e->>'customer_name') || '/' || (e->>'is_guest') from jsonb_array_elements(admin_list_production_requests('all','ready_made_group_wear')->'rows') e$$, '010-7777-8888/홍길동/true');
select t_fail('reject needs reason', $$select admin_set_production_request_status('00000000-0000-0000-0000-00000000d001','rejected','')$$, '사유');
select t_fail('cannot touch draft', $$select admin_set_production_request_status('00000000-0000-0000-0000-00000000d004','approved')$$, '찾을 수 없');
select t_ok('super admin approves', $$select admin_set_production_request_status('00000000-0000-0000-0000-00000000d001','approved','원단 확인 후 견적 안내')::text$$);
select t_eq('approved count updated', $$select admin_list_production_requests()->'counts'->>'approved'$$, '2');
reset role;
select t_eq('approval stored with reviewer', $$select status::text || '/' || (reviewed_by = '00000000-0000-0000-0000-00000000a001')::text || '/' || admin_comment from orders where id='00000000-0000-0000-0000-00000000d001'$$, 'approved/true/원단 확인 후 견적 안내');
select t_eq('approval audited once', $$select count(*)::text from admin_audit_logs where target_id='00000000-0000-0000-0000-00000000d001'$$, '1');
