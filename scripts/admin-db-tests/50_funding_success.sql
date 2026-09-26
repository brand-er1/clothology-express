\set ON_ERROR_STOP 1
-- 펀딩 성공 판정 / 제작자 알림 / SMS 큐 / 중복 방지 / 관리자 재발송 (20_tests.sql 의 t_ok/t_fail/t_eq 헬퍼 사용)
-- 디스패처(dispatch-notifications Edge Function)의 동작은 service_role 로 claim/complete RPC 를 호출해 재현한다.
reset role;
truncate public._t;
select set_config('request.jwt.claim.sub','',false);

-- 기존 레거시 펀딩(목표 미달)은 영향 없음
select t_eq('legacy under-target funding untouched', $$select funding_status || '/' || coalesce(success_at::text,'null') || '/' || success_notification_sent from fundings where id='00000000-0000-0000-0000-0000000f0001'$$, 'funding/null/false');

-- 준비: SMS 채널 켜기(시스템 설정), 두 번째 제작자(휴대폰 없음)
update public.platform_settings set value = jsonb_set(value, '{sms}', 'true') where key = 'notification_channels';
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000c002','creator2@test.com','{"full_name":"최제작","account_type":"seller"}'),
 ('00000000-0000-0000-0000-00000000b009','buyer9@test.com','{"full_name":"정구매","account_type":"buyer"}')
on conflict do nothing;
insert into public.creator_profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000c002','최제작') on conflict do nothing;
insert into public.brands (id, owner_user_id, creator_profile_user_id, brand_name, status)
values ('00000000-0000-0000-0000-0000000bd002','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000c002','NOPHONE','active') on conflict do nothing;

insert into public.fundings (id, creator_id, brand_id, product_name, cloth_type, material, size, image_url, moq, price, funding_days, status, reviewed_at, color_options, size_options, estimate_direct_unit_max, estimate_development_total, trademark_screening_required)
select ('00000000-0000-0000-0000-00000000' || v.suffix)::uuid, v.creator::uuid, v.brand::uuid, v.name, 'tshirt','cotton','M','https://x/t.png',20,20000,30,'approved', now(), array['white'], array['M'], 9000, 10000, false
from (values
  ('1001','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','성공 티셔츠'),
  ('1004','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','동시결제 티셔츠'),
  ('1005','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-0000000bd002','번호없음 티셔츠'),
  ('1006','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','장애 티셔츠'),
  ('1007','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','채널꺼짐 티셔츠'),
  ('1008','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','수신거부 티셔츠'),
  ('1009','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','참여자알림 티셔츠')
) as v(suffix, creator, brand, name);

-- ---------------------------------------------------------------------------
-- 제작자 연락처 설정 (검증/정규화/비공개)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_eq('settings default when none (no profile phone)', $$select get_my_creator_notification_settings()->>'phone_source'$$, 'none');
select t_fail('invalid phone rejected', $$select update_my_creator_notification_settings('02-123-4567', true, true)$$, '휴대폰 번호 형식');
select t_fail('too short phone rejected', $$select update_my_creator_notification_settings('010-123', true, true)$$, '휴대폰 번호 형식');
select t_eq('+82 phone normalized', $$select update_my_creator_notification_settings('+82 10-2222-3333', true, true)->>'phone_number'$$, '01022223333');
select t_eq('dashed phone normalized', $$select update_my_creator_notification_settings('010-2222-3333', true, true)->>'phone_number'$$, '01022223333');
select t_fail('creator cannot write settings table directly', $$update creator_notification_settings set phone_number='01099998888'$$, 'permission denied');
select t_eq('success columns unchanged by client', $$select coalesce(success_at::text,'null') from fundings where id='00000000-0000-0000-0000-000000001001'$$, 'null');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false);
select t_fail('admin cannot write success columns via Data API', $$update fundings set success_at=now(), funding_status='success' where id='00000000-0000-0000-0000-000000001001'$$, '서버에서만');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false);
select t_fail('creator cannot read notification logs', $$select count(*) from notification_logs$$, 'permission denied');
select t_fail('client cannot claim jobs', $$select * from claim_notification_jobs(null,null,10)$$, 'permission denied');
select t_fail('client cannot complete jobs', $$select complete_notification_job(gen_random_uuid(), true)$$, 'permission denied');
select t_fail('client cannot force evaluate', $$select evaluate_funding_success('00000000-0000-0000-0000-000000001001')$$, 'permission denied');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_eq('other user cannot read creator phone', $$select count(*)::text from creator_notification_settings$$, '0');
select t_fail('buyer cannot list admin notification logs', $$select count(*) from admin_list_funding_success_notifications()$$, '');
reset role;
select set_config('request.jwt.claim.sub','',false); set role anon;
select t_fail('anon cannot read creator settings', $$select count(*) from creator_notification_settings$$, 'permission denied');
reset role;

-- ---------------------------------------------------------------------------
-- 테스트 1: 19장 → 20장 달성 → 성공 + 사이트 알림 1건 + SMS 1건
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_ok('buyer orders 19 (mock)', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000001001','white','M',19,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$);
reset role;
select t_eq('19/20 still funding', $$select funding_status || '/' || coalesce(success_at::text,'null') from fundings where id='00000000-0000-0000-0000-000000001001'$$, 'funding/null');
select t_eq('19/20 no notification', $$select count(*)::text from community_notifications where funding_id='00000000-0000-0000-0000-000000001001' and type='funding_success'$$, '0');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b009',false); set role authenticated;
select t_ok('buyer orders the 20th (mock)', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000001001','white','M',1,'정구매','010-7777-8888','b9@test.com','정구매','010-7777-8888','06000','서울 강남구 2',null,null,true)$$);
reset role;
select t_eq('T1 funding success recorded', $$select funding_status || '/' || final_quantity || '/' || success_participant_count || '/' || (success_at is not null) || '/' || creator_id from fundings where id='00000000-0000-0000-0000-000000001001'$$, 'success/20/2/true/00000000-0000-0000-0000-00000000c001');
select t_eq('T1 one site notification to creator', $$select count(*)::text from community_notifications where funding_id='00000000-0000-0000-0000-000000001001' and type='funding_success' and recipient_id='00000000-0000-0000-0000-00000000c001'$$, '1');
select t_eq('T1 notification title/link', $$select title || '|' || link_path from community_notifications where funding_id='00000000-0000-0000-0000-000000001001' and type='funding_success'$$, '🎉 펀딩에 성공했습니다!|/fundings/00000000-0000-0000-0000-000000001001/manage');
select t_eq('T1 notification message', $$select message from community_notifications where funding_id='00000000-0000-0000-0000-000000001001' and type='funding_success'$$, E'"성공 티셔츠" 펀딩이 목표 수량 20장을 달성했습니다.\n현재 참여 수량: 20장\n펀딩 달성률: 100%\n이제 제작 준비를 진행해주세요.');
select t_eq('T1 site flags', $$select success_notification_sent || '/' || (success_notification_sent_at is not null) || '/' || success_sms_sent from fundings where id='00000000-0000-0000-0000-000000001001'$$, 'true/true/false');
select t_eq('T1 one sms job pending (masked phone)', $$select count(*) || '/' || max(status) || '/' || max(recipient_masked) from notification_logs where funding_id='00000000-0000-0000-0000-000000001001' and channel='sms'$$, '1/pending/010-****-3333');
select t_eq('T1 no participant notifications by default', $$select count(*)::text from community_notifications where funding_id='00000000-0000-0000-0000-000000001001' and type='funding_success_participant'$$, '0');

-- 디스패처: 발송 작업 가져가기 → 발송 성공 처리
set role service_role;
select t_eq('T1 dispatcher claims exactly one job', $$select count(*) || '/' || max(phone) || '/' || max(payload->>'quantity') || '/' || max(payload->>'participants') || '/' || max(payload->>'funding_name') from claim_notification_jobs('00000000-0000-0000-0000-000000001001', null, 20)$$, '1/01022223333/20/2/성공 티셔츠');
select t_eq('T1 second concurrent claim gets nothing', $$select count(*)::text from claim_notification_jobs('00000000-0000-0000-0000-000000001001', null, 20)$$, '0');
select t_eq('T1 complete sent', $$select complete_notification_job((select id from notification_logs where funding_id='00000000-0000-0000-0000-000000001001' and channel='sms'), true, 'mock', 'mock-1', null)::text$$, 'true');
select t_eq('T1 complete is idempotent', $$select complete_notification_job((select id from notification_logs where funding_id='00000000-0000-0000-0000-000000001001' and channel='sms'), true, 'mock', 'mock-2', null)::text$$, 'false');
reset role;
select t_eq('T1 sms flags set', $$select success_sms_sent || '/' || (success_sms_sent_at is not null) from fundings where id='00000000-0000-0000-0000-000000001001'$$, 'true/true');
select t_eq('T1 sms log sent once', $$select status || '/' || attempt_count || '/' || provider_message_id from notification_logs where funding_id='00000000-0000-0000-0000-000000001001' and channel='sms'$$, 'sent/1/mock-1');

-- ---------------------------------------------------------------------------
-- 테스트 2: 새로고침/재요청(재판정 + 디스패처 재호출) → 추가 발송 없음
-- ---------------------------------------------------------------------------
set role service_role;
select t_eq('T2 re-evaluate does nothing', $$select evaluate_funding_success('00000000-0000-0000-0000-000000001001')::text$$, 'false');
select t_eq('T2 dispatcher again claims nothing', $$select count(*)::text from claim_notification_jobs(null, null, 50) where payload->>'funding_name'='성공 티셔츠'$$, '0');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_eq('T2 creator notification list shows 1 (refresh)', $$select count(*)::text from list_my_community_notifications(50) where type='funding_success' and funding_id='00000000-0000-0000-0000-000000001001'$$, '1');
select t_eq('T2 list returns link_path', $$select link_path from list_my_community_notifications(50) where type='funding_success' and funding_id='00000000-0000-0000-0000-000000001001'$$, '/fundings/00000000-0000-0000-0000-000000001001/manage');
reset role;

-- ---------------------------------------------------------------------------
-- 테스트 3: 20 → 21 추가 주문 → 추가 알림/문자 없음, 최종 수량만 갱신
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b009',false); set role authenticated;
select t_ok('T3 21st order', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000001001','white','M',1,'정구매','010-7777-8888','b9@test.com','정구매','010-7777-8888','06000','서울 강남구 2',null,null,true)$$);
reset role;
select t_eq('T3 still one site notification', $$select count(*)::text from community_notifications where funding_id='00000000-0000-0000-0000-000000001001' and type='funding_success'$$, '1');
select t_eq('T3 still one sms log (sent)', $$select count(*) || '/' || max(status) from notification_logs where funding_id='00000000-0000-0000-0000-000000001001' and channel='sms'$$, '1/sent');
select t_eq('T3 final quantity tracks 21, success_at unchanged', $$select final_quantity || '/' || funding_status from fundings where id='00000000-0000-0000-0000-000000001001'$$, '21/success');

-- 성공 후 취소: 성공 상태 유지, 유효 수량만 갱신 (current_orders 로직은 기존 그대로)
set role service_role;
select t_ok('cancel one after success', $$select finalize_funding_cancellation((select id from funding_participations where funding_id='00000000-0000-0000-0000-000000001001' and participant_id='00000000-0000-0000-0000-00000000b009' and status<>'cancelled' order by created_at desc limit 1), '00000000-0000-0000-0000-00000000b009', '{}'::jsonb)::text$$);
reset role;
select t_eq('cancel keeps success, final 20', $$select funding_status || '/' || final_quantity || '/' || (select count(*) from community_notifications where funding_id='00000000-0000-0000-0000-000000001001' and type='funding_success') from fundings where id='00000000-0000-0000-0000-000000001001'$$, 'success/20/1');

-- ---------------------------------------------------------------------------
-- 테스트 5: 휴대폰 번호 없는 제작자 → 사이트 알림 O, SMS skipped + 사유
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_ok('T5 order 20 on no-phone creator funding', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000001005','white','M',20,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$);
reset role;
select t_eq('T5 site notification created', $$select count(*)::text from community_notifications where funding_id='00000000-0000-0000-0000-000000001005' and type='funding_success' and recipient_id='00000000-0000-0000-0000-00000000c002'$$, '1');
select t_eq('T5 sms skipped with reason', $$select status || '/' || skip_reason from notification_logs where funding_id='00000000-0000-0000-0000-000000001005' and channel='sms'$$, 'skipped/제작자 휴대폰 번호 미등록');
select t_eq('T5 flags', $$select success_notification_sent || '/' || success_sms_sent from fundings where id='00000000-0000-0000-0000-000000001005'$$, 'true/false');
set role service_role;
select t_eq('T5 dispatcher has nothing to send', $$select count(*)::text from claim_notification_jobs('00000000-0000-0000-0000-000000001005', null, 20)$$, '0');
reset role;

-- ---------------------------------------------------------------------------
-- 테스트 6: SMS API 장애 → 성공 상태 유지 + 실패 로그 + 관리자 재발송
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_ok('T6 order 20', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000001006','white','M',20,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$);
reset role;
set role service_role;
select t_eq('T6 claim', $$select count(*)::text from claim_notification_jobs('00000000-0000-0000-0000-000000001006', null, 20)$$, '1');
select t_eq('T6 provider failure recorded', $$select complete_notification_job((select id from notification_logs where funding_id='00000000-0000-0000-0000-000000001006' and channel='sms'), false, 'solapi', null, 'HTTP 500 Internal Server Error')::text$$, 'true');
reset role;
select t_eq('T6 funding success unaffected', $$select funding_status || '/' || (success_at is not null) || '/' || success_notification_sent || '/' || success_sms_sent from fundings where id='00000000-0000-0000-0000-000000001006'$$, 'success/true/true/false');
select t_eq('T6 failure logged', $$select status || '/' || error_message from notification_logs where funding_id='00000000-0000-0000-0000-000000001006' and channel='sms'$$, 'failed/HTTP 500 Internal Server Error');
select t_eq('T6 failed sms not auto-retried', $$select count(*)::text from claim_notification_jobs('00000000-0000-0000-0000-000000001006', null, 20)$$, '0');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
select t_eq('T6 admin sees failed row', $$select sms_status || '/' || sms_error || '/' || site_sent from admin_list_funding_success_notifications(null, 'sms_failed', 50, 0) where funding_id='00000000-0000-0000-0000-000000001006'$$, 'failed/HTTP 500 Internal Server Error/true');
select t_eq('T6 admin resend -> pending', $$select admin_resend_notification((select sms_log_id from admin_list_funding_success_notifications(null,'all',50,0) where funding_id='00000000-0000-0000-0000-000000001006'), 'SMS 장애 복구 후 재발송')->>'status'$$, 'pending');
select t_fail('T6 double resend while pending blocked', $$select admin_resend_notification((select sms_log_id from admin_list_funding_success_notifications(null,'all',50,0) where funding_id='00000000-0000-0000-0000-000000001006'), 'again')$$, '대기');
reset role;
set role service_role;
select t_eq('T6 resend claimed once', $$select count(*) || '/' || max(attempt_count) from claim_notification_jobs('00000000-0000-0000-0000-000000001006', null, 20)$$, '1/2');
select t_eq('T6 resend succeeds', $$select complete_notification_job((select id from notification_logs where funding_id='00000000-0000-0000-0000-000000001006' and channel='sms'), true, 'solapi', 'G4V-1', null)::text$$, 'true');
reset role;
select t_eq('T6 sms now sent', $$select f.success_sms_sent || '/' || l.status || '/' || l.resend_count from fundings f join notification_logs l on l.funding_id=f.id and l.channel='sms' where f.id='00000000-0000-0000-0000-000000001006'$$, 'true/sent/1');
select t_eq('T6 resend audited', $$select count(*)::text from admin_audit_logs where action='notification.resend' and reason='SMS 장애 복구 후 재발송'$$, '1');
select id as site_log_id from notification_logs where funding_id='00000000-0000-0000-0000-000000001006' and channel='site' \gset
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
select t_fail('T6 resend of sent sms refused', $$select admin_resend_notification((select sms_log_id from admin_list_funding_success_notifications(null,'all',50,0) where funding_id='00000000-0000-0000-0000-000000001006'), 'dup')$$, '이미 발송된');
select t_fail('site notification cannot be resent', format('select admin_resend_notification(%L::uuid, %L)', :'site_log_id', 'x'), 'SMS/알림톡');
select t_eq('admin summary counts (incl. 30_flow f0002 success, creator had no phone then)', $$select (admin_get_notification_summary()->>'sms_sent') || '/' || (admin_get_notification_summary()->>'sms_skipped')$$, '2/2');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_fail('buyer cannot resend', $$select admin_resend_notification(gen_random_uuid(), 'x')$$, '');
reset role;

-- 결과 모를 'sending' 고착 건 → 자동 재발송이 아니라 실패 처리(중복 문자 방지)
update public.notification_logs set status='sending', locked_at=now()-interval '11 minutes'
where funding_id='00000000-0000-0000-0000-000000001005' and channel='sms';
set role service_role;
select t_eq('stale sending not re-sent', $$select count(*)::text from claim_notification_jobs(null, null, 50)$$, '0');
reset role;
select t_eq('stale sending -> failed', $$select status from notification_logs where funding_id='00000000-0000-0000-0000-000000001005' and channel='sms'$$, 'failed');

-- ---------------------------------------------------------------------------
-- 채널 꺼짐 / 수신 거부 / 참여자 확장
-- ---------------------------------------------------------------------------
update public.platform_settings set value = jsonb_set(value, '{sms}', 'false') where key = 'notification_channels';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_ok('order 20 while sms channel off', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000001007','white','M',20,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$);
reset role;
set role service_role;
select t_eq('channel off: nothing sent', $$select count(*)::text from claim_notification_jobs('00000000-0000-0000-0000-000000001007', null, 20)$$, '0');
reset role;
select t_eq('channel off: logged failed with reason', $$select status || '/' || (error_message like '%SMS 채널이 꺼져%') from notification_logs where funding_id='00000000-0000-0000-0000-000000001007' and channel='sms'$$, 'failed/true');
update public.platform_settings set value = jsonb_set(value, '{sms}', 'true') where key = 'notification_channels';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_eq('creator turns sms off', $$select update_my_creator_notification_settings('010-2222-3333', false, true)->>'sms_notifications_enabled'$$, 'false');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false);
select t_ok('order 20 while creator sms opt-out', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000001008','white','M',20,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$);
reset role;
select t_eq('opt-out: site sent, sms skipped', $$select (select count(*) from community_notifications where funding_id='00000000-0000-0000-0000-000000001008' and type='funding_success') || '/' || status || '/' || skip_reason from notification_logs where funding_id='00000000-0000-0000-0000-000000001008' and channel='sms'$$, '1/skipped/제작자가 SMS 수신을 끔');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000c001',false); set role authenticated;
select t_ok('creator turns sms back on', $$select update_my_creator_notification_settings('010-2222-3333', true, true)::text$$);
reset role;

update public.platform_settings set value = 'true'::jsonb where key = 'funding_success_notify_participants';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b001',false); set role authenticated;
select t_ok('participant ext: order 10', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000001009','white','M',10,'김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1',null,null,true)$$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000b009',false);
select t_ok('participant ext: order 10 more', $$select partner_order_id from create_mock_funding_order('00000000-0000-0000-0000-000000001009','white','M',10,'정구매','010-7777-8888','b9@test.com','정구매','010-7777-8888','06000','서울 강남구 2',null,null,true)$$);
reset role;
update public.platform_settings set value = 'false'::jsonb where key = 'funding_success_notify_participants';
select t_eq('participant ext: one site notification per participant', $$select count(*)::text from community_notifications where funding_id='00000000-0000-0000-0000-000000001009' and type='funding_success_participant'$$, '2');
select t_eq('participant ext: participant sms jobs queued', $$select count(*)::text from notification_logs where funding_id='00000000-0000-0000-0000-000000001009' and channel='sms' and recipient_role='participant' and status='pending'$$, '2');
select t_eq('participant ext: creator still exactly one', $$select count(*)::text from community_notifications where funding_id='00000000-0000-0000-0000-000000001009' and type='funding_success'$$, '1');

-- ---------------------------------------------------------------------------
-- funding → success → production
-- ---------------------------------------------------------------------------
update public.fundings set production_status = 'fabric_contact' where id = '00000000-0000-0000-0000-000000001001';
select t_eq('production stage moves funding_status to production', $$select funding_status from fundings where id='00000000-0000-0000-0000-000000001001'$$, 'production');

-- ---------------------------------------------------------------------------
-- 소급(backfill): 배포 전 이미 달성한 펀딩은 성공으로 기록하되 알림/문자는 보내지 않는다
-- ---------------------------------------------------------------------------
set session_replication_role = replica;
insert into public.fundings (id, creator_id, brand_id, product_name, cloth_type, material, size, image_url, moq, price, funding_days, status, reviewed_at, color_options, size_options, estimate_direct_unit_max, estimate_development_total, trademark_screening_required)
values ('00000000-0000-0000-0000-000000001010','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','과거달성 티셔츠','tshirt','cotton','M','https://x/t.png',20,20000,30,'approved', now()-interval '9 days', array['white'], array['M'], 9000, 10000, false);
insert into public.funding_participations (funding_id, participant_id, selected_color, selected_size, quantity, unit_price, status, payment_provider, payment_status, payment_approved_at)
values ('00000000-0000-0000-0000-000000001010','00000000-0000-0000-0000-00000000b001','white','M',12,20000,'pledged','mock','paid', now()-interval '8 days'),
       ('00000000-0000-0000-0000-000000001010','00000000-0000-0000-0000-00000000b009','white','M',9,20000,'pledged','kakaopay','paid', now()-interval '6 days'),
       ('00000000-0000-0000-0000-000000001010','00000000-0000-0000-0000-00000000b009','white','M',5,20000,'cancelled','mock','cancelled', now()-interval '7 days');
set session_replication_role = origin;
select t_eq('backfill marks one funding', $$select _backfill_funding_success()::text$$, '1');
select t_eq('backfill success_at = crossing payment time', $$select funding_status || '/' || final_quantity || '/' || success_backfilled || '/' || (abs(extract(epoch from success_at - (now()-interval '6 days'))) < 5) from fundings where id='00000000-0000-0000-0000-000000001010'$$, 'success/21/true/true');
select t_eq('backfill sends nothing', $$select (select count(*) from community_notifications where funding_id='00000000-0000-0000-0000-000000001010') + (select count(*) from notification_logs where funding_id='00000000-0000-0000-0000-000000001010')$$, '0');
select t_eq('backfill is idempotent', $$select _backfill_funding_success()::text$$, '0');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000a001',false); set role authenticated;
select t_eq('admin backfilled filter', $$select count(*)::text from admin_list_funding_success_notifications(null,'backfilled',50,0) where funding_id='00000000-0000-0000-0000-000000001010'$$, '1');
reset role;

-- 레거시 데이터 불변 재확인
select t_eq('legacy funding still untouched', $$select funding_status || '/' || coalesce(success_at::text,'null') from fundings where id='00000000-0000-0000-0000-0000000f0001'$$, 'funding/null');
