\set ON_ERROR_STOP 1
reset role;
create table if not exists public._t (n serial, label text, ok boolean, detail text);
grant all on public._t to authenticated, anon; grant all on sequence public._t_n_seq to authenticated, anon;
create or replace function public.t_ok(p_label text, p_sql text) returns void language plpgsql as $$
declare v text; begin
  execute p_sql into v;
  insert into public._t(label, ok, detail) values (p_label, true, left(coalesce(v,'∅'),160));
exception when others then insert into public._t(label, ok, detail) values (p_label, false, 'UNEXPECTED ERROR: '||sqlerrm);
end $$;
create or replace function public.t_fail(p_label text, p_sql text, p_pattern text default '') returns void language plpgsql as $$
begin
  execute p_sql;
  insert into public._t(label, ok, detail) values (p_label, false, 'expected failure but succeeded');
exception when others then
  insert into public._t(label, ok, detail) values (p_label, sqlerrm ilike '%'||p_pattern||'%', sqlerrm);
end $$;
create or replace function public.t_eq(p_label text, p_sql text, p_expected text) returns void language plpgsql as $$
declare v text; begin
  execute p_sql into v;
  insert into public._t(label, ok, detail) values (p_label, v is not distinct from p_expected, 'got='||coalesce(v,'∅')||' expected='||coalesce(p_expected,'∅'));
exception when others then insert into public._t(label, ok, detail) values (p_label, false, 'ERROR: '||sqlerrm);
end $$;
grant execute on function public.t_ok(text,text), public.t_fail(text,text,text), public.t_eq(text,text,text) to authenticated, anon;

-- Super admin (legacy user_roles) creates ops & cs admins
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
select t_eq('legacy admin migrated to super_admin', $$select get_my_admin_context()->>'role'$$, 'super_admin');
select t_eq('legacy is_admin still true', $$select is_admin('00000000-0000-0000-0000-00000000a001')::text$$, 'true');
select t_ok('super grants ops', $$select admin_grant_role('ops@brander.test','operations_admin','운영담당')::text$$);
select t_ok('super grants cs', $$select admin_grant_role('CS@brander.test','cs_admin','CS담당')::text$$);
select t_fail('grant unknown email', $$select admin_grant_role('nobody@x.com','cs_admin')$$, '회원이 없습니다');
select t_fail('super cannot demote self', $$select admin_update_member_role('00000000-0000-0000-0000-00000000a001','cs_admin','active','테스트')$$, '본인');
select t_eq('admin list count', $$select count(*)::text from admin_list_admins()$$, '3');
select t_ok('super dashboard', $$select admin_get_dashboard(now()-interval '30 days', now())::text$$);
select t_eq('super sees finance', $$select admin_get_dashboard(now()-interval '30 days', now())->>'finance_visible'$$, 'true');
select t_eq('dashboard gmv (mock 100k + refunded 50k)', $$select admin_get_dashboard(now()-interval '30 days', now())->'money'->>'gmv'$$, '150000');
select t_ok('super analytics', $$select admin_get_analytics(now()-interval '30 days', now())::text$$);
select t_ok('super settings', $$select count(*)::text from admin_get_settings()$$);
select t_ok('super sets commission 12', $$select admin_update_setting('platform_commission_rate','12'::jsonb,'수수료 정책 변경')::text$$);
select t_fail('commission out of range', $$select admin_update_setting('platform_commission_rate','80'::jsonb,'x 변경')$$, '50');
select t_fail('cannot enable live PG refunds', $$select admin_update_setting('pg_live_refund_enabled','true'::jsonb,'켜기 시도')$$, 'PG');
select t_ok('super audit log', $$select count(*)::text from admin_list_audit_logs()$$);
select t_ok('super payments', $$select count(*)::text from admin_list_payments()$$);
select t_eq('payment mock pg status', $$select pg_status from admin_list_payments() where order_number='BRANDER-LEGACY1'$$, 'not_applicable');
reset role;

-- Normal member: everything admin is denied
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_eq('member context not admin', $$select get_my_admin_context()->>'is_admin'$$, 'false');
select t_fail('member dashboard denied', $$select admin_get_dashboard(now()-interval '1 day', now())$$, '권한');
select t_fail('member list members denied', $$select * from admin_list_members()$$, '권한');
select t_fail('member orders denied', $$select * from admin_list_orders()$$, '권한');
select t_fail('member audit denied', $$select * from admin_list_audit_logs()$$, '권한');
select t_fail('member direct audit table read denied', $$select count(*) from admin_audit_logs$$, 'permission denied');
select t_fail('member direct admin_members read', $$select count(*) from admin_members$$, 'permission denied');
select t_fail('member grant self admin', $$select admin_grant_role('buyer1@test.com','super_admin')$$, '권한');
select t_fail('member cannot self-change account_status', $$update profiles set account_status='archived' where id=auth.uid()$$, '관리자만');
select t_fail('member cannot call internal helper', $$select _admin_log('x','y','z')$$, 'permission denied');
select t_fail('member cannot read settlements of others', $$select 1/(count(*)-count(*)) from settlements$$, '');
select t_ok('member own profile update still works', $$update profiles set username='구매왕' where id=auth.uid() returning username$$);
select t_ok('member notifications still work', $$select count(*)::text from list_my_community_notifications(10)$$);
select t_ok('member own participations still work', $$select count(*)::text from get_my_funding_participations()$$);
reset role;
-- anon
select set_config('request.jwt.claim.sub','',false); set role anon;
select t_fail('anon dashboard denied', $$select admin_get_dashboard(now()-interval '1 day', now())$$, 'permission denied');
reset role;

-- CS admin
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a003',false); set role authenticated;
select t_eq('cs role', $$select get_my_admin_context()->>'role'$$, 'cs_admin');
select t_eq('cs is_admin legacy false', $$select is_admin(auth.uid())::text$$, 'false');
select t_eq('cs dashboard hides finance', $$select admin_get_dashboard(now()-interval '30 days', now())->>'finance_visible'$$, 'false');
select t_eq('cs dashboard money null', $$select (admin_get_dashboard(now()-interval '30 days', now())->'money')::text$$, 'null');
select t_eq('cs lists members', $$select count(*)::text from admin_list_members()$$, '6');
select t_ok('cs member detail pii', $$select admin_get_member_detail('00000000-0000-0000-0000-00000000b001')->>'phone_number'$$);
select t_eq('cs orders', $$select count(*)::text from admin_list_orders()$$, '2');
select t_ok('cs shipments view', $$select count(*)::text from admin_list_shipments()$$);
select t_ok('cs reports view', $$select count(*)::text from admin_list_reports()$$);
select t_ok('cs tickets create', $$select admin_create_cs_ticket('buyer1@test.com','shipping','배송 문의','언제 오나요?','BRANDER-LEGACY1')::text$$);
reset role; select id as ticket_id from cs_tickets limit 1 \gset
set role authenticated;
select t_ok('cs tickets update', format($$select admin_update_cs_ticket(%L,'in_progress','확인중',null,true)::text$$, :'ticket_id'));
select t_ok('cs creates refund request', $$select admin_create_refund_request('00000000-0000-0000-0000-0000000e0001','고객 단순 변심')::text$$);
reset role; select id as refund_id from refund_requests limit 1 \gset
set role authenticated;
select t_ok('cs moves refund to reviewing', format($$select admin_transition_refund(%L,'reviewing','검토 요청')::text$$, :'refund_id'));
select t_fail('cs cannot approve refund', format($$select admin_transition_refund(%L,'approved','승인')$$, :'refund_id'), 'refunds.manage');
select t_ok('cs sees refund events', format($$select count(*)::text from admin_get_refund_events(%L)$$, :'refund_id'));
select t_fail('cs cannot view payments', $$select * from admin_list_payments()$$, 'payments.view');
select t_fail('cs cannot view settlements', $$select * from admin_list_settlements()$$, 'settlements.view');
select t_fail('cs cannot manage admins', $$select * from admin_list_admins()$$, 'admins.manage');
select t_fail('cs cannot view settings', $$select * from admin_get_settings()$$, 'settings.view');
select t_fail('cs cannot view audit', $$select * from admin_list_audit_logs()$$, 'audit.view');
select t_fail('cs cannot suspend member', $$select admin_set_member_status('00000000-0000-0000-0000-00000000b002','suspended','테스트 정지')$$, 'members.manage');
select t_fail('cs cannot review funding', $$select admin_review_funding('00000000-0000-0000-0000-0000000f0001','approved')$$, 'fundings.manage');
select t_fail('cs cannot use legacy admin rpc', $$select * from get_admin_funding_overview()$$, '관리자');
select t_fail('cs cannot delete comment', $$select admin_soft_delete_comment('00000000-0000-0000-0000-0000000cc001','욕설 삭제')$$, 'content.manage');
reset role; select id as report_id from community_reports limit 1 \gset
set role authenticated;
select t_ok('cs can dismiss report', format($$select admin_resolve_report(%L,'dismissed','확인 결과 문제 없음','none')::text$$, :'report_id'));
select t_fail('cs cannot take delete action on report', format($$select admin_resolve_report(%L,'reviewed','삭제','delete_comment')$$, :'report_id'), 'content.manage');
select t_fail('cs cannot send notifications', $$select admin_send_notification('공지','내용','announcement','all_members')$$, 'notifications.send');
select t_fail('cs cannot view analytics', $$select admin_get_analytics(now()-interval '1 day', now())$$, 'analytics.view');
reset role;

-- Operations admin
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_eq('ops role', $$select get_my_admin_context()->>'role'$$, 'operations_admin');
select t_eq('ops legacy is_admin true', $$select is_admin(auth.uid())::text$$, 'true');
select t_fail('ops cannot manage admins', $$select admin_grant_role('buyer1@test.com','cs_admin')$$, 'admins.manage');
select t_fail('ops cannot change settings', $$select admin_update_setting('platform_commission_rate','5'::jsonb,'낮추기')$$, 'settings.manage');
select t_fail('ops cannot view payments', $$select * from admin_list_payments()$$, 'payments.view');
select t_fail('ops cannot see audit', $$select * from admin_list_audit_logs()$$, 'audit.view');
select t_ok('ops lists fundings', $$select count(*)::text from admin_list_fundings()$$);
select t_ok('ops creators', $$select count(*)::text from admin_list_creators()$$);
select t_ok('ops brands', $$select count(*)::text from admin_list_brands()$$);
select t_fail('ops brand reject needs reason', $$select admin_moderate_brand('00000000-0000-0000-0000-0000000bd001','reject','')$$, '반려 사유');
select t_ok('ops analytics', $$select (admin_get_analytics(now()-interval '30 days', now())->'totals')::text$$);
select t_eq('ops analytics hides gmv', $$select admin_get_analytics(now()-interval '30 days', now())->'totals'->>'gmv'$$, null);
select t_ok('ops suspends member', $$select admin_set_member_status('00000000-0000-0000-0000-00000000b002','restricted','반복 신고 누적')::text$$);
select t_fail('ops cannot suspend super admin', $$select admin_set_member_status('00000000-0000-0000-0000-00000000a001','suspended','시도')$$, 'Super Admin');
select t_fail('ops cannot suspend cs admin', $$select admin_set_member_status('00000000-0000-0000-0000-00000000a003','suspended','시도')$$, 'Super Admin');
select t_ok('ops deletes comment (soft)', $$select admin_soft_delete_comment('00000000-0000-0000-0000-0000000cc001','욕설')::text$$);
reset role;
select t_eq('comment soft deleted, original preserved', $$select deleted_content||'|'||is_deleted::text||'|'||deleted_reason from community_comments where id='00000000-0000-0000-0000-0000000cc001'$$, '욕설 댓글|true|욕설');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_ok('ops restores comment', $$select admin_restore_comment('00000000-0000-0000-0000-0000000cc001','오삭제 복구')::text$$);
reset role;

-- Restricted member cannot participate
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b002',false); set role authenticated;
select t_fail('restricted member cannot order', $$select * from create_mock_funding_order('00000000-0000-0000-0000-0000000f0001','black','M',1,'이','010','a@b.c','이','010','06000','주소',null,null,true)$$, '이용이 제한');
reset role;

-- Brand self-reactivation blocked
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_ok('ops suspends brand', $$select admin_moderate_brand('00000000-0000-0000-0000-0000000bd001','suspend','상표권 분쟁')::text$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_fail('creator cannot unsuspend own brand', $$update brands set status='active' where owner_user_id=auth.uid()$$, '관리자만');
select t_ok('creator can still edit brand intro', $$update brands set short_description='소개 수정' where owner_user_id=auth.uid() returning short_description$$);
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_ok('ops restores brand', $$select admin_moderate_brand('00000000-0000-0000-0000-0000000bd001','restore','분쟁 해소')::text$$);
reset role;

-- Paid history deletion guards
select t_fail('cannot delete paid participation', $$delete from funding_participations where id='00000000-0000-0000-0000-0000000e0001'$$, '삭제할 수 없습니다');
select t_fail('cannot delete funding with payments', $$delete from fundings where id='00000000-0000-0000-0000-0000000f0001'$$, '삭제할 수 없습니다');
select t_fail('audit log immutable', $$delete from admin_audit_logs$$, '수정하거나 삭제');
