\set ON_ERROR_STOP 1
reset role;
truncate public._t;
-- creator registers a new funding (draft) — inserted as DB owner to skip the external trademark AI step
insert into public.fundings (id, creator_id, product_name, cloth_type, material, size, image_url, moq, price, funding_days, status, color_options, size_options, description, trademark_screening_required, estimate_direct_unit_min, estimate_direct_unit_max)
values ('00000000-0000-0000-0000-0000000f0002','00000000-0000-0000-0000-00000000c001','신규 맨투맨','sweatshirt','cotton','M','https://x/new.png',20,30000,14,'draft',array['gray'],array['M'],'설명',false, 9000, 11000);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_eq('creator submits for review', $$select (submit_funding_for_review('00000000-0000-0000-0000-0000000f0002')).status$$, 'pending');
reset role; select set_config('request.jwt.claim.sub','',false); set role anon;
select t_eq('pending funding not public', $$select count(*)::text from fundings where id='00000000-0000-0000-0000-0000000f0002'$$, '0');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_eq('ops sees pending in list', $$select phase from admin_list_fundings(null,'pending') where id='00000000-0000-0000-0000-0000000f0002'$$, 'pending');
select t_fail('reject needs reason', $$select admin_review_funding('00000000-0000-0000-0000-0000000f0002','rejected','')$$, '반려 사유');
select t_eq('ops approves', $$select admin_review_funding('00000000-0000-0000-0000-0000000f0002','approved',null,20,30000)->>'status'$$, 'approved');
select t_fail('cannot approve twice', $$select admin_review_funding('00000000-0000-0000-0000-0000000f0002','approved')$$, '승인 대기');
reset role; select set_config('request.jwt.claim.sub','',false); set role anon;
select t_eq('approved funding is public', $$select count(*)::text from fundings where id='00000000-0000-0000-0000-0000000f0002'$$, '1');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_ok('ops hides funding', $$select admin_set_funding_visibility('00000000-0000-0000-0000-0000000f0002', true, '상세페이지 보완')::text$$);
reset role; select set_config('request.jwt.claim.sub','',false); set role anon;
select t_eq('hidden funding not public', $$select count(*)::text from fundings where id='00000000-0000-0000-0000-0000000f0002'$$, '0');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_eq('creator still sees hidden own funding', $$select count(*)::text from fundings where id='00000000-0000-0000-0000-0000000f0002'$$, '1');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_ok('ops unhides', $$select admin_set_funding_visibility('00000000-0000-0000-0000-0000000f0002', false, '보완 완료')::text$$);
select t_eq('phase funding', $$select phase from admin_list_fundings() where id='00000000-0000-0000-0000-0000000f0002'$$, 'funding');
select t_fail('production before goal blocked', $$select admin_update_production_stage('00000000-0000-0000-0000-0000000f0002','funding_success')$$, '목표 수량');
reset role;
-- buyer mock payment reaching goal
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_ok('buyer mock order 15', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-0000000f0002','gray','M',15,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 테헤란로 1','101호',null,true)$$);
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000b003','buyer3@test.com');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b003',false); set role authenticated;
select t_ok('buyer3 mock order 5', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-0000000f0002','gray','M',5,'최구매','010-5555-6666','b3@test.com','최구매','010-5555-6666','04000','서울 마포구 1',null,null,true)$$);
reset role;
-- a real (kakaopay) paid order to test PG separation
insert into public.funding_participations (id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price, status, payment_provider, payment_status, payment_tid, partner_order_id, payment_approved_at, payment_method_type)
values ('00000000-0000-0000-0000-0000000e0009','00000000-0000-0000-0000-0000000f0002','00000000-0000-0000-0000-00000000b001','gray','M',1,30000,'pledged','kakaopay','paid','T123KAKAO','BRANDER-REAL1', now(),'CARD');
update public.fundings set current_orders = current_orders + 1 where id='00000000-0000-0000-0000-0000000f0002';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_eq('ops sees 3 orders for funding', $$select count(*)::text from admin_list_orders(null,'all','00000000-0000-0000-0000-0000000f0002')$$, '3');
select t_eq('search by phone digits', $$select count(*)::text from admin_list_orders('5555-6666')$$, '1');
select t_eq('order state paid', $$select order_state from admin_list_orders('최구매')$$, 'paid');
select t_ok('order detail with pii', $$select admin_get_order_detail((select id from admin_list_orders('최구매')))->>'shipping_address'$$);
select t_eq('ops declares funding success', $$select admin_update_production_stage('00000000-0000-0000-0000-0000000f0002','funding_success','목표 달성', '{}', true)->>'notified'$$, '2');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_eq('creator moves to fabric_contact', $$select creator_update_production_stage('00000000-0000-0000-0000-0000000f0002','fabric_contact','원단 업체 컨택 완료', array['https://x/fabric.jpg'])->>'production_status'$$, 'fabric_contact');
select t_fail('creator cannot set shipping', $$select creator_update_production_stage('00000000-0000-0000-0000-0000000f0002','shipping')$$, '검수/포장');
select t_fail('creator cannot go backwards', $$select creator_update_production_stage('00000000-0000-0000-0000-0000000f0002','fabric_contact')$$, '다음 단계');
select t_eq('creator sees production logs', $$select count(*)::text from list_funding_production_logs('00000000-0000-0000-0000-0000000f0002')$$, '2');
select t_fail('creator cannot use admin production rpc', $$select admin_update_production_stage('00000000-0000-0000-0000-0000000f0002','delivered')$$, '권한');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b003',false); set role authenticated;
select t_eq('buyer sees fabric_sourcing stage', $$select production_stage from get_my_funding_participations() where funding_id='00000000-0000-0000-0000-0000000f0002'$$, 'fabric_sourcing');
select t_fail('other buyer cannot read logs', $$select * from list_funding_production_logs('00000000-0000-0000-0000-0000000f0002')$$, '권한');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_ok('ops mass production', $$select admin_update_production_stage('00000000-0000-0000-0000-0000000f0002','mass_production','본생산 시작')::text$$);
select t_ok('ops shipping ready', $$select admin_update_production_stage('00000000-0000-0000-0000-0000000f0002','shipping_ready')::text$$);
select t_eq('production board', $$select production_status from admin_list_production_board() where funding_id='00000000-0000-0000-0000-0000000f0002'$$, 'shipping_ready');
select t_fail('ship without invoice blocked', $$select admin_update_shipment((select id from admin_list_orders('최구매')),'ship')$$, '송장번호');
select t_ok('invoice', $$select admin_update_shipment((select id from admin_list_orders('최구매')),'invoice','CJ대한통운','123456789012')::text$$);
select t_eq('shipment state invoiced', $$select shipping_state from admin_list_shipments('00000000-0000-0000-0000-0000000f0002') where order_number like 'BRANDER-%' and tracking_number='123456789012'$$, 'invoiced');
select t_ok('ship', $$select admin_update_shipment((select id from admin_list_orders('최구매')),'ship')::text$$);
select t_eq('order state shipping', $$select order_state from admin_list_orders('최구매')$$, 'shipping');
select t_ok('bulk invoice others then ship', $$select admin_update_shipment((select id from admin_list_orders('BRANDER-REAL1')),'invoice','롯데택배','999')::text$$);
select t_ok('invoice buyer1', $$select admin_update_shipment((select id from admin_list_orders(null,'all','00000000-0000-0000-0000-0000000f0002') where orderer_name='김구매' and payment_provider='mock'),'invoice','CJ대한통운','555')::text$$);
select t_eq('bulk ship', $$select (admin_bulk_update_shipments(array(select id from admin_list_orders(null,'all','00000000-0000-0000-0000-0000000f0002') where shipping_status='preparing'),'ship'))->>'updated'$$, '2');
select t_eq('bulk deliver', $$select (admin_bulk_update_shipments(array(select id from admin_list_orders(null,'all','00000000-0000-0000-0000-0000000f0002')),'deliver'))->>'updated'$$, '3');
select t_ok('production delivered', $$select admin_update_production_stage('00000000-0000-0000-0000-0000000f0002','delivered','전체 배송 완료')::text$$);
select t_eq('shipping progress 100', $$select progress::text from admin_shipping_progress() where funding_id='00000000-0000-0000-0000-0000000f0002'$$, '100.0');
select t_eq('phase completed', $$select phase from admin_list_fundings() where id='00000000-0000-0000-0000-0000000f0002'$$, 'completed');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b003',false); set role authenticated;
select t_eq('buyer sees delivered/fulfilled', $$select production_stage||'/'||shipping_status||'/'||status from get_my_funding_participations() where funding_id='00000000-0000-0000-0000-0000000f0002'$$, 'delivered/delivered/fulfilled');
select t_ok('buyer received notifications', $$select string_agg(message, ' || ') from list_my_community_notifications(20)$$);
reset role;
-- settlement (super)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
select t_ok('settlement candidates', $$select string_agg(product_name, ',') from admin_list_settlement_candidates()$$);
select t_ok('generate settlement', $$select admin_generate_settlement('00000000-0000-0000-0000-0000000f0002')::text$$);
-- gross 21*30000=630000, refund 0, fee 12% = 75600, production default 11000*21=231000, final=323400
select t_eq('settlement math', $$select gross_amount||'/'||platform_fee||'/'||production_cost||'/'||final_amount||'/'||commission_rate from admin_list_settlements() where funding_id='00000000-0000-0000-0000-0000000f0002'$$, '630000/75600/231000/323400/12.00');
select t_eq('settlement mock/real split', $$select mock_amount||'/'||real_amount from admin_list_settlements() where funding_id='00000000-0000-0000-0000-0000000f0002'$$, '600000/30000');
select t_ok('adjust settlement', $$select admin_update_settlement((select id from admin_list_settlements() where funding_id='00000000-0000-0000-0000-0000000f0002'), 200000, 10000, current_date + 3, '택배비 차감', '실제 제작비 반영')->>'final_amount'$$);
select t_eq('final after adjust', $$select final_amount::text from admin_list_settlements() where funding_id='00000000-0000-0000-0000-0000000f0002'$$, '344400');
select t_fail('complete requires scheduled', $$select admin_set_settlement_status((select id from admin_list_settlements() where funding_id='00000000-0000-0000-0000-0000000f0002'),'completed')$$, 'scheduled');
select t_ok('schedule', $$select admin_set_settlement_status((select id from admin_list_settlements() where funding_id='00000000-0000-0000-0000-0000000f0002'),'scheduled')::text$$);
select t_ok('complete', $$select admin_set_settlement_status((select id from admin_list_settlements() where funding_id='00000000-0000-0000-0000-0000000f0002'),'completed')::text$$);
select t_fail('completed settlement locked', $$select admin_update_settlement((select id from admin_list_settlements() where funding_id='00000000-0000-0000-0000-0000000f0002'), 1, 1, null, null, '변경 시도')$$, '완료');
select t_eq('dashboard settlement completed', $$select admin_get_dashboard(now()-interval '30 days', now()+interval '1 minute')->'money'->>'settlement_completed'$$, '344400');
-- refunds: legacy mock order (reviewing by CS earlier) -> approve -> processing -> completed
select t_ok('approve refund', $$select admin_transition_refund((select id from admin_list_refunds() where order_number='BRANDER-LEGACY1'),'approved','승인')::text$$);
select t_fail('skip processing blocked', $$select admin_transition_refund((select id from admin_list_refunds() where order_number='BRANDER-LEGACY1'),'completed')$$, '허용되지');
select t_ok('processing', $$select admin_transition_refund((select id from admin_list_refunds() where order_number='BRANDER-LEGACY1'),'processing')::text$$);
select t_ok('complete mock refund', $$select admin_transition_refund((select id from admin_list_refunds() where order_number='BRANDER-LEGACY1'),'completed','모의결제 환불')::text$$);
reset role;
select t_eq('legacy order cancelled & counts decremented (owner view)', $$select (select status||'/'||payment_status||'/'||cancellation_source from funding_participations where id='00000000-0000-0000-0000-0000000e0001') || '/' || (select current_orders from fundings where id='00000000-0000-0000-0000-0000000f0001')$$, 'cancelled/cancelled/admin/0');
select t_eq('pg status for mock refund', $$select pg_refund_status from refund_requests where participation_id='00000000-0000-0000-0000-0000000e0001'$$, 'not_applicable_mock');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
-- real payment refund requires manual PG confirmation
select t_ok('return refund request on delivered real order', $$select admin_create_refund_request('00000000-0000-0000-0000-0000000e0009','불량 반품 접수')::text$$);
select t_fail('duplicate open refund blocked', $$select admin_create_refund_request('00000000-0000-0000-0000-0000000e0009','중복')$$, '이미 처리 중');
select t_ok('approve real', $$select admin_transition_refund((select id from admin_list_refunds() where order_number='BRANDER-REAL1'),'approved')::text$$);
select t_ok('processing real', $$select admin_transition_refund((select id from admin_list_refunds() where order_number='BRANDER-REAL1'),'processing')::text$$);
select t_fail('real refund needs PG confirmation', $$select admin_transition_refund((select id from admin_list_refunds() where order_number='BRANDER-REAL1'),'completed')$$, 'PG');
select t_ok('real refund with manual confirmation', $$select admin_transition_refund((select id from admin_list_refunds() where order_number='BRANDER-REAL1'),'completed','PG 콘솔 환불 완료',true)::text$$);
select t_eq('real refund pg status', $$select pg_refund_status from admin_list_refunds() where order_number='BRANDER-REAL1'$$, 'manual_confirmed');
select t_eq('payments list shows cancelled pg', $$select pg_status||'/'||is_cancelled::text from admin_list_payments('BRANDER-REAL1')$$, 'cancelled/true');
-- suspension keeps participants
select t_eq('suspend legacy funding notifies', $$select admin_suspend_funding('00000000-0000-0000-0000-0000000f0001','제작처 문제로 중단', true)->>'notified_participants'$$, '0');
select t_eq('phase suspended', $$select phase from admin_list_fundings() where id='00000000-0000-0000-0000-0000000f0001'$$, 'suspended');
select t_eq('participations kept after suspension', $$select count(*)::text from admin_list_orders(null,'all','00000000-0000-0000-0000-0000000f0001')$$, '2');
select t_ok('resume', $$select admin_resume_funding('00000000-0000-0000-0000-0000000f0001','문제 해결')::text$$);
-- notifications
select t_eq('audience funding participants', $$select admin_preview_notification_audience('funding_participants','00000000-0000-0000-0000-0000000f0002')::text$$, '2');
select t_eq('audience brand followers', $$select admin_preview_notification_audience('brand_followers','00000000-0000-0000-0000-0000000bd001')::text$$, '1');
select t_eq('send notice external not integrated', $$select (admin_send_notification('배송 안내','곧 도착합니다','shipping_started','all_members',null,null,array['site','email','kakao_alimtalk'])->'external_delivery')::text$$, '{"email": "not_integrated", "kakao_alimtalk": "not_integrated"}');
select t_ok('campaign list', $$select count(*)::text from admin_list_notification_campaigns()$$);
-- member status + creator approval + audit
select t_eq('suspend buyer sets auth_ban', $$select admin_set_member_status('00000000-0000-0000-0000-00000000b003','suspended','결제 사기 의심')->>'auth_ban'$$, 'true');
select t_ok('approve creator', $$select admin_approve_creator('00000000-0000-0000-0000-00000000b001','입점 심사 통과')::text$$);
select t_ok('member detail history', $$select jsonb_array_length(admin_get_member_detail('00000000-0000-0000-0000-00000000b003')->'status_history')::text$$);
select t_ok('audit actions', $$select string_agg(distinct action, ', ') from admin_list_audit_logs(null,null,null,null,null,500)$$);
select t_ok('analytics final', $$select (admin_get_analytics(now()-interval '30 days', now()+interval '1 minute')->'totals')::text$$);
select t_ok('analytics rankings', $$select (admin_get_analytics(now()-interval '30 days', now()+interval '1 minute')->'rankings'->'brands')::text$$);
select t_ok('revoke cs', $$select admin_update_member_role('00000000-0000-0000-0000-00000000a003','cs_admin','revoked','퇴사')::text$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a003',false); set role authenticated;
select t_fail('revoked cs denied', $$select * from admin_list_members()$$, '권한');
reset role;
select t_eq('admin_members row kept on revoke', $$select status from admin_members where user_id='00000000-0000-0000-0000-00000000a003'$$, 'revoked');
