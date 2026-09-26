\set ON_ERROR_STOP 1
-- 관리자 주문 엑셀 내보내기 (orders.pii 권한 + 사유 + Audit Log)
reset role;
truncate public._t;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_fail('buyer cannot export orders', $$select admin_export_orders(null,'all',null,'테스트')$$, '');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a002',false); set role authenticated;
select t_fail('reason required', $$select admin_export_orders(null,'all','00000000-0000-0000-0000-000000002001','')$$, '사유');
select t_eq('ops exports funding orders with full PII', $$select (r->>'count') || '/' || (r->'rows'->0->>'address') || '/' || (r->'rows'->0->>'orderer_phone') from (select admin_export_orders(null,'all','00000000-0000-0000-0000-000000002001','배송 준비') r) s$$, '3/서울 강남구 1/010-1234-5678');
select t_eq('export includes color/size/quantity', $$select string_agg((e->>'color') || ':' || (e->>'size') || ':' || (e->>'quantity'), ',' order by e->>'color') from jsonb_array_elements((admin_export_orders('컬러 후드','all','00000000-0000-0000-0000-000000002001','검색 테스트'))->'rows') e$$, 'BLACK:M:5,BURGUNDY:L:2,NAVY:M:3');
reset role;
select t_eq('export audited', $$select count(*)::text from admin_audit_logs where action='orders.export' and reason in ('배송 준비','검색 테스트')$$, '2');
select t_eq('audit keeps row count', $$select after_data->>'rows' from admin_audit_logs where action='orders.export' and reason='배송 준비'$$, '3');
