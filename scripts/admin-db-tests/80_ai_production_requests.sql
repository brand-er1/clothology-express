\set ON_ERROR_STOP 1
-- AI 이미지 생성 → 제작의뢰 접수 · 관리자 연동 시나리오 (80_ai_production_requests.sh 가 실행)
reset role;
create table if not exists public._t (n serial, label text, ok boolean, detail text);
truncate public._t;
grant all on public._t to authenticated, anon, service_role; grant all on sequence public._t_n_seq to authenticated, anon, service_role;
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
grant execute on function public.t_ok(text,text), public.t_fail(text,text,text), public.t_eq(text,text,text) to authenticated, anon, service_role;

-- 접수 payload 기본값
create or replace function public._pr_payload(p_key text, p_overrides jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'submissionKey', p_key, 'contactName', '홍길동', 'phone', '010-1234-5678',
    'quantityUndecided', false, 'quantity', '50', 'budget', '100~300만원', 'request', '왼쪽 가슴 자수 로고',
    'aiPrompt', 'oversized burgundy hoodie, front embroidery', 'designBrief', '버건디 오버핏 후드',
    'clothType', '후드티', 'material', '면 기모', 'imagePath', 'production-requests/2026/' || p_key || '.png',
    'imageUrl', 'https://cdn.test/storage/v1/object/public/generated_images/production-requests/2026/' || p_key || '.png',
    'imageSourceUrl', 'https://fal.media/files/tmp.png', 'imageFingerprint', 'fp-' || p_key,
    'entryPoint', 'customize_step5', 'entryPath', '/customize',
    'privacyConsent', true, 'privacyConsentVersion', '2026-11-27') || p_overrides
$$;
grant execute on function public._pr_payload(text, jsonb) to service_role;
-- 테스트 전용: 접수 키 → 의뢰 id (관리자 세션에서도 쓰기 위해 definer)
create or replace function public._pr_order(p_key text) returns uuid language sql security definer set search_path = public as $$
  select order_id from public.production_request_details where submission_key = p_key::uuid
$$;
grant execute on function public._pr_order(text) to authenticated, service_role;

-- ── 1. 마이그레이션: 기존 의뢰는 '확인함', 진행 상태는 기존 상태에서 유도 ───────────────────────────────
select t_eq('legacy orders backfilled as checked (draft excluded)',
  $$select string_agg(o.status::text || ':' || p.progress_status || ':' || (p.checked_at is not null)::text, ',' order by o.created_at)
    from public.production_request_progress p join public.orders o on o.id = p.order_id$$,
  'pending:new:true,approved:consult_done:true,rejected:not_contracted:true');

-- ── 2. 일반 사용자 · 비로그인은 접수 함수 · 새 테이블에 직접 접근할 수 없다 ────────────────────────────
set role anon;
select t_fail('anon cannot call create_ai_production_request', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000001'), null, null, null)$$, 'permission denied');
select t_fail('anon cannot read details table', $$select count(*) from public.production_request_details$$, 'permission denied');
reset role;
select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-0000000000c1',false);
set role authenticated;
select t_fail('member cannot call create_ai_production_request', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000001'), auth.uid(), null, null)$$, 'permission denied');
select t_fail('member cannot read memos table', $$select count(*) from public.production_request_memos$$, 'permission denied');
select t_fail('member cannot list admin requests', $$select public.admin_list_production_requests()$$, '권한');
select t_fail('member cannot read summary', $$select public.admin_production_request_summary()$$, '권한');
reset role;

-- ── 3. 서버 검증 (service_role = Edge Function) ────────────────────────────────────────────
set role service_role;
select t_fail('phone required', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000002', '{"phone": ""}'), null, null, null)$$, 'PR_INVALID: 전화번호');
select t_fail('invalid phone rejected', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000002', '{"phone": "010-123-456"}'), null, null, null)$$, 'PR_INVALID: 전화번호');
select t_fail('non-010 phone rejected', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000002', '{"phone": "011-123-4567"}'), null, null, null)$$, 'PR_INVALID: 전화번호');
select t_fail('name required', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000002', '{"contactName": "  "}'), null, null, null)$$, 'PR_INVALID: 고객 이름');
select t_fail('consent required', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000002', '{"privacyConsent": false}'), null, null, null)$$, 'PR_CONSENT');
select t_fail('quantity number or 미정', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000002', '{"quantity": "많이"}'), null, null, null)$$, 'PR_INVALID: 제작 희망 수량');
select t_fail('quantity >= 1', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000002', '{"quantity": "0"}'), null, null, null)$$, 'PR_INVALID: 제작 희망 수량');
select t_fail('stored image required', $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-000000000002', '{"imagePath": "https://fal.media/tmp.png"}'), null, null, null)$$, 'PR_IMAGE');
select t_fail('submission key required', $$select public.create_ai_production_request(public._pr_payload('not-a-uuid'), null, null, null)$$, 'PR_INVALID: 접수 식별값');
reset role;
select t_eq('nothing stored after rejected submissions',
  $$select (select count(*) from public.orders where request_source = 'ai_image_request') || '/' || (select count(*) from public.production_request_details)$$, '0/0');

-- ── 4. 정상 접수: 회원(전화번호 형식 변환) + 비회원(수량 미정) ─────────────────────────────────────
set role service_role;
select t_eq('member submission stored',
  $$select (r->>'duplicate') from (select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-0000000000a1', '{"phone": "+82 10 1234 5678"}'), '80000000-0000-0000-0000-0000000000c1', 'iphash-1', 'UA') r) s$$, 'false');
select t_eq('guest submission stored (quantity 미정, budget empty)',
  $$select (r->>'duplicate') from (select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-0000000000b1', '{"contactName": "이비회원", "phone": "01098765432", "quantityUndecided": true, "quantity": null, "budget": "", "request": ""}'), null, 'iphash-2', 'UA') r) s$$, 'false');
select t_eq('same submission key returns the same order (double click / retry)',
  $$select (r->>'duplicate') || '/' || ((r->>'order_id') = (select order_id::text from public.production_request_details where submission_key = '91000000-0000-0000-0000-0000000000a1')) from (select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-0000000000a1'), '80000000-0000-0000-0000-0000000000c1', 'iphash-1', 'UA') r) s$$, 'true/true');
select t_fail('same phone + same image within 10 minutes is a duplicate',
  $$select public.create_ai_production_request(public._pr_payload('91000000-0000-0000-0000-0000000000a2', '{"imageFingerprint": "fp-91000000-0000-0000-0000-0000000000a1"}'), '80000000-0000-0000-0000-0000000000c1', 'iphash-1', 'UA')$$, 'PR_DUPLICATE');
reset role;

select t_eq('order row linked to image + phone in one request',
  $$select o.status || '|' || o.request_source || '|' || o.generated_image_url || '|' || o.image_path || '|' || d.contact_phone || '|' || o.requested_quantity
    from public.orders o join public.production_request_details d on d.order_id = o.id where d.submission_key = '91000000-0000-0000-0000-0000000000a1'$$,
  'pending|ai_image_request|https://cdn.test/storage/v1/object/public/generated_images/production-requests/2026/91000000-0000-0000-0000-0000000000a1.png|production-requests/2026/91000000-0000-0000-0000-0000000000a1.png|01012345678|50');
select t_eq('guest order keeps contact on orders.guest_* (existing guest pattern)',
  $$select coalesce(o.user_id::text, 'guest') || '|' || o.guest_name || '|' || o.guest_phone || '|' || coalesce(o.requested_quantity::text, 'null') || '|' || d.quantity_undecided || '|' || coalesce(d.budget, 'null')
    from public.orders o join public.production_request_details d on d.order_id = o.id where d.submission_key = '91000000-0000-0000-0000-0000000000b1'$$,
  'guest|이비회원|01098765432|null|true|null');
select t_eq('member order does not copy contact into guest_*',
  $$select coalesce(o.guest_name, 'null') || '|' || coalesce(o.guest_phone, 'null') from public.orders o join public.production_request_details d on d.order_id = o.id where d.submission_key = '91000000-0000-0000-0000-0000000000a1'$$, 'null|null');
select t_eq('consent time recorded', $$select count(*)::text from public.production_request_details where privacy_consented_at is not null and privacy_consent_version = '2026-11-27'$$, '2');
select t_eq('new requests are unread', $$select count(*)::text from public.production_request_progress where checked_at is null$$, '2');

-- ── 5. 관리자 목록 · 배지 ───────────────────────────────────────────────────────────────
select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-0000000000c5',false);
set role authenticated;
select t_eq('cs sees unread badge count', $$select public.admin_production_request_summary()->>'unread_count'$$, '2');
select t_eq('ai requests appear in existing production request list (source filter)',
  $$select (r->>'total') || '/' || (r->'rows'->0->>'request_source') || '/' || (r->'rows'->0->>'progress_status') || '/' || (r->'rows'->0->>'is_unread')
    from (select public.admin_list_production_requests('all', 'ai_image_request', null, 30, 0) r) s$$, '2/ai_image_request/new/true');
select t_eq('all sources listed together (legacy + ai)', $$select public.admin_list_production_requests('all', 'all', null, 30, 0)->>'total'$$, '5');
select t_eq('unread filter', $$select public.admin_list_production_requests('unread', 'all', null, 30, 0)->>'total'$$, '2');
select t_eq('list shows entered contact (pii permission)',
  $$select string_agg((e->>'customer_name') || ':' || (e->>'customer_phone'), ',' order by e->>'customer_name')
    from jsonb_array_elements(public.admin_list_production_requests('all', 'ai_image_request', null, 30, 0)->'rows') e$$, '이비회원:01098765432,홍길동:01012345678');
select t_eq('search by phone digits', $$select public.admin_list_production_requests('all', 'all', '5678', 30, 0)->>'total'$$, '1');
select t_eq('progress filter', $$select public.admin_list_production_requests('all', 'all', null, 30, 0, 'consult_done')->>'total'$$, '1');
select t_eq('cs can view but not manage', $$select (public.admin_list_production_requests()->>'can_manage') || '/' || (public.admin_list_production_requests()->>'can_view_pii')$$, 'false/true');

-- ── 6. 상세: 이미지 · 연락처 · 계정 · 프롬프트 · 유입 경로, 열면 '확인함' ──────────────────────────────
select t_eq('detail exposes everything the admin needs',
  $$select concat_ws('|', (r->>'image_url' like '%production-requests/2026/91000000-0000-0000-0000-0000000000a1.png')::text, r->'request'->>'contact_name', r->'request'->>'contact_phone',
      r->'request'->>'quantity', r->'request'->>'budget', r->'request'->>'customer_request', r->'request'->>'ai_prompt', r->'request'->>'entry_point',
      r->'account'->>'email', r->'account'->>'username', r->'account'->>'account_type', r->>'progress_status', r->>'request_source')
    from (select public.admin_get_production_request(public._pr_order('91000000-0000-0000-0000-0000000000a1')) r) s$$,
  'true|홍길동|01012345678|50|100~300만원|왼쪽 가슴 자수 로고|oversized burgundy hoodie, front embroidery|customize_step5|member@test.local|hoodie_fan|buyer|new|ai_image_request');
select t_eq('guest detail marks account as guest',
  $$select (r->'account'->>'is_guest') || '|' || (r->'request'->>'quantity_undecided') from (select public.admin_get_production_request(public._pr_order('91000000-0000-0000-0000-0000000000b1')) r) s$$, 'true|true');
select t_eq('opening details clears unread (both opened)', $$select public.admin_production_request_summary()->>'unread_count'$$, '0');

-- cs 는 상태 변경 · 메모 작성 불가
select t_fail('cs cannot change progress', $$select public.admin_update_production_request_progress(public._pr_order('91000000-0000-0000-0000-0000000000a1'), 'consult_waiting')$$, '권한');
select t_fail('cs cannot add memo', $$select public.admin_add_production_request_memo(public._pr_order('91000000-0000-0000-0000-0000000000a1'), '메모')$$, '권한');
reset role;

-- ── 7. 운영 관리자: 상태 8단계 · orders.status 동기화 · 메모 · 감사 로그 ─────────────────────────────
select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-0000000000a0',false);
set role authenticated;
select t_eq('consult_waiting keeps order pending',
  $$select r->>'status' from (select public.admin_update_production_request_progress(public._pr_order('91000000-0000-0000-0000-0000000000a1'), 'consult_waiting') r) s$$, 'pending');
select t_eq('quote_sent moves order to approved',
  $$select r->>'status' from (select public.admin_update_production_request_progress(public._pr_order('91000000-0000-0000-0000-0000000000a1'), 'quote_sent', '견적서를 문자로 보내드렸습니다.') r) s$$, 'approved');
select t_ok('all remaining states accepted',
  $$select string_agg(public.admin_update_production_request_progress(public._pr_order('91000000-0000-0000-0000-0000000000a1'), s)->>'status', ',') from unnest(array['new','consult_done','contract_done','in_production','production_done']) s$$);
select t_fail('unknown state rejected', $$select public.admin_update_production_request_progress(public._pr_order('91000000-0000-0000-0000-0000000000a1'), 'shipped')$$, '진행 상태');
select t_fail('not_contracted needs a reason when none exists', $$select public.admin_update_production_request_progress(public._pr_order('91000000-0000-0000-0000-0000000000b1'), 'not_contracted')$$, '사유');
select t_eq('not_contracted with reason → rejected',
  $$select r->>'status' from (select public.admin_update_production_request_progress(public._pr_order('91000000-0000-0000-0000-0000000000b1'), 'not_contracted', '예산이 맞지 않아 진행하지 않기로 했습니다.') r) s$$, 'rejected');
select t_ok('memo added', $$select public.admin_add_production_request_memo(public._pr_order('91000000-0000-0000-0000-0000000000a1'), '11/27 통화: 자수 위치 확인, 50장 견적 요청')->>'id'$$);
select t_fail('empty memo rejected', $$select public.admin_add_production_request_memo(public._pr_order('91000000-0000-0000-0000-0000000000a1'), '   ')$$, '메모 내용');
select t_eq('detail returns memo + latest progress',
  $$select (r->'memos'->0->>'body') || '|' || (r->'memos'->0->>'author_name') || '|' || (r->>'progress_status') || '|' || (r->>'admin_comment')
    from (select public.admin_get_production_request(public._pr_order('91000000-0000-0000-0000-0000000000a1')) r) s$$,
  '11/27 통화: 자수 위치 확인, 50장 견적 요청|운영|production_done|견적서를 문자로 보내드렸습니다.');
-- 기존 '검토 대기/승인/반려' RPC 도 진행 상태와 맞물린다
select t_ok('legacy status rpc still works', $$select public.admin_set_production_request_status('80000000-0000-0000-0000-00000000e001', 'approved', '상담 접수')->>'status'$$);
reset role;

select t_eq('legacy rpc synced progress', $$select progress_status from public.production_request_progress where order_id = '80000000-0000-0000-0000-00000000e001'$$, 'consult_done');
select t_eq('order status mirrors final progress',
  $$select o.status::text || '/' || p.progress_status from public.orders o join public.production_request_progress p on p.order_id = o.id join public.production_request_details d on d.order_id = o.id where d.submission_key = '91000000-0000-0000-0000-0000000000a1'$$, 'approved/production_done');
select t_eq('progress + memo audited', $$select count(*) filter (where action = 'production_request.progress') || '/' || count(*) filter (where action = 'production_request.memo') from public.admin_audit_logs$$, '8/1');
select t_eq('memo body not copied into audit log', $$select count(*)::text from public.admin_audit_logs where action = 'production_request.memo' and (coalesce(after_data::text, '') || coalesce(metadata::text, '')) like '%통화%'$$, '0');

-- ── 8. 다른 경로로 새로 들어온 의뢰도 미확인에 잡힌다 ──────────────────────────────────────────
insert into public.orders (user_id, cloth_type, material, status, request_source) values ('80000000-0000-0000-0000-0000000000c1', '바지', '면', 'pending', 'design_upload');
update public.orders set status = 'pending' where id = '80000000-0000-0000-0000-00000000e004';
select set_config('request.jwt.claim.sub','80000000-0000-0000-0000-0000000000ad',false);
set role authenticated;
select t_eq('new order from other flows + draft promoted count as unread', $$select public.admin_production_request_summary()->>'unread_count'$$, '2');
reset role;

-- ── 9. 회원 탈퇴 등으로 orders 가 지워지면 상세 · 메모도 함께 지워진다 ───────────────────────────────
delete from public.orders where id = public._pr_order('91000000-0000-0000-0000-0000000000b1');
select t_eq('cascade on order delete',
  $$select (select count(*) from public.production_request_details where submission_key = '91000000-0000-0000-0000-0000000000b1') || '/' || (select count(*) from public.production_request_details)$$, '0/1');
