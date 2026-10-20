\set ON_ERROR_STOP on
create function pg_temp.assert_true(p_ok boolean, p_name text) returns text language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL: %', p_name; end if;
  return 'PASS ' || p_name;
end;
$$;

-- Test fixtures only. No source database rows or credentials are copied.
insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-4000-8000-000000000001', 'buyer@ksnet-test.invalid', '{"full_name":"Test Buyer","account_type":"buyer"}', '{}'),
  ('00000000-0000-4000-8000-000000000002', 'seller@ksnet-test.invalid', '{"full_name":"Test Seller","account_type":"seller"}', '{}');
insert into public.creator_profiles(user_id, display_name) values ('00000000-0000-4000-8000-000000000002', 'Test Seller') on conflict do nothing;
insert into public.brands(id, owner_user_id, creator_profile_user_id, brand_name)
values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Test Brand');
insert into public.fundings(id, creator_id, brand_id, product_name, cloth_type, material, size, image_url, moq, price, status, reviewed_at, color_options, size_options, trademark_screening_required)
values ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'Test Shirt', '반팔 티셔츠', '면', 'M', '/test.webp', 999, 2000, 'approved', now(), array['black'], array['M'], false);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);

select pg_temp.assert_true(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('finalize_funding_payment', 'finalize_funding_cancellation',
    'fail_funding_payment', 'finalize_creator_funding_cancellation', 'create_mock_funding_order',
    'participate_in_funding', 'claim_ksnet_operation', 'record_ksnet_approval', 'finish_ksnet_operation',
    'cancel_unapproved_ksnet_payment', 'get_ksnet_operation')
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
), 'browser roles cannot mutate payments or create mock orders');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.ksnet_payment_operations','SELECT'), 'PG references are private');

do $$ begin
  set local role anon;
  begin
    perform public.finalize_funding_payment(gen_random_uuid(), gen_random_uuid(), 'CARD', now(), '{}');
    raise exception 'Unauthenticated payment mutation was allowed';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;
select 'PASS anonymous direct payment finalization rejected';

set role authenticated;
select * from public.create_ksnet_funding_order('00000000-0000-4000-8000-000000000004', 'black', 'M', 2,
  'Buyer', '01000000000', 'buyer@ksnet-test.invalid', 'Buyer', '01000000000', '00000', 'Test address', '', '', true) \gset order_
reset role;
select pg_temp.assert_true(:'order_total_amount'::int = 4000, 'order amount comes from database price');

select public.claim_ksnet_operation(:'order_participation_id', 'confirm', 'auth-1')->>'operation_id' as op \gset
select pg_temp.assert_true((public.claim_ksnet_operation(:'order_participation_id', 'confirm', 'auth-2')->>'claimed')::boolean = false, 'second approval claim blocked');
select public.cancel_unapproved_ksnet_payment(:'order_participation_id');
select pg_temp.assert_true(payment_status='ready', 'browser cancel cannot interrupt approval') from public.funding_participations where id=:'order_participation_id';
select set_config('test.participation', :'order_participation_id', false);
do $$ begin
  begin
    perform public.finalize_funding_cancellation(current_setting('test.participation')::uuid, '00000000-0000-4000-8000-000000000001', '{}');
    raise exception 'Legacy cancellation bypassed active operation';
  exception when raise_exception then
    if sqlerrm <> '결제 또는 환불 처리 중에는 주문을 변경할 수 없습니다.' then raise; end if;
  end;
end $$;
select 'PASS legacy mutation blocked during external approval';

-- Latest main can close a funding and cancel its pending orders. It must not
-- cancel an order whose external approval is already in flight.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
set role authenticated;
do $$ begin
  begin
    perform public.creator_early_close_funding('00000000-0000-4000-8000-000000000004');
    raise exception 'Early close interrupted external approval';
  exception when raise_exception then
    if sqlerrm <> '결제 또는 환불 처리 중에는 주문을 변경할 수 없습니다.' then raise; end if;
  end;
end $$;
reset role;
select pg_temp.assert_true(status='approved' and not early_closed, 'early close rolls back while a payment is in flight')
from public.fundings where id='00000000-0000-4000-8000-000000000004';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);

select public.record_ksnet_approval(:'op', 'TEST-TID-1', jsonb_build_object('tid','TEST-TID-1','order_no',:'order_participation_id','amount',4000));
select public.finish_ksnet_operation(:'op', 'paid');
select public.finish_ksnet_operation(:'op', 'paid');
select pg_temp.assert_true(payment_status='paid' and payment_tid='TEST-TID-1', 'approval commits TID and paid state atomically') from public.funding_participations where id=:'order_participation_id';
select pg_temp.assert_true(current_orders=2, 'duplicate finalization counts quantity once') from public.fundings where id='00000000-0000-4000-8000-000000000004';
select public.cancel_unapproved_ksnet_payment(:'order_participation_id');
select pg_temp.assert_true(payment_status='paid', 'late browser cancellation leaves paid order intact') from public.funding_participations where id=:'order_participation_id';

do $$ begin
  begin
    perform public.claim_ksnet_operation(current_setting('test.participation')::uuid, 'refund', null, '00000000-0000-4000-8000-000000000002', 'participant');
    raise exception 'Other buyer allowed to refund';
  exception when raise_exception then
    if sqlerrm <> '취소 권한이 없습니다.' then raise; end if;
  end;
end $$;
select 'PASS refund ownership rechecked inside claim transaction';

select public.claim_ksnet_operation(:'order_participation_id', 'refund', null, '00000000-0000-4000-8000-000000000002', 'creator', '판매자 취소 테스트')->>'operation_id' as refund_op \gset
select public.finish_ksnet_operation(:'refund_op', 'cancelled', '{"refund_confirmed":true}');
select pg_temp.assert_true(payment_status='cancelled' and cancellation_source='creator' and buyer_notified_at is not null, 'creator refund preserves cancellation notification') from public.funding_participations where id=:'order_participation_id';
select pg_temp.assert_true(current_orders=0, 'refund reverses quantity once') from public.fundings where id='00000000-0000-4000-8000-000000000004';

-- Independent ready orders to exercise failure/recovery and real concurrency.
insert into public.funding_participations(id,funding_id,participant_id,selected_color,selected_size,quantity,unit_price,status,payment_provider,payment_status)
select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 '00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','black','M',1,2000,'pledged','ksnet','ready'
from unnest(array[90,91,92,93,99]) n;

select public.claim_ksnet_operation('00000000-0000-4000-8000-000000000090','confirm','auth-90')->>'operation_id' as mismatch_op \gset
select public.record_ksnet_approval(:'mismatch_op','TEST-TID-90','{"order_no":"wrong","amount":2000}');
select set_config('test.operation', :'mismatch_op', false);
do $$ begin
  begin
    perform public.finish_ksnet_operation(current_setting('test.operation')::uuid,'paid');
    raise exception 'Mismatched receipt accepted';
  exception when raise_exception then
    if sqlerrm <> 'KSNET 승인 정보가 주문과 일치하지 않습니다.' then raise; end if;
  end;
end $$;
select pg_temp.assert_true(tid='TEST-TID-90' and state='processing', 'failed finalization preserves separately saved receipt') from public.ksnet_payment_operations where id=:'mismatch_op';
select public.finish_ksnet_operation(:'mismatch_op','cancelled','{"refund_confirmed":true,"auto_cancelled":true}');
select pg_temp.assert_true(payment_status='cancelled' and payment_tid='TEST-TID-90','automatic compensation records cancellation and TID') from public.funding_participations where id='00000000-0000-4000-8000-000000000090';

select public.claim_ksnet_operation('00000000-0000-4000-8000-000000000091','confirm','auth-91')->>'operation_id' as uncertain_op \gset
select public.finish_ksnet_operation(:'uncertain_op','review_required','{"stage":"confirm","error":"timeout"}');
select pg_temp.assert_true((public.claim_ksnet_operation('00000000-0000-4000-8000-000000000091','confirm','auth-91-retry')->>'claimed')::boolean = false, 'unknown approval cannot be retried');
select public.cancel_unapproved_ksnet_payment('00000000-0000-4000-8000-000000000091');
select pg_temp.assert_true(payment_status='ready','unknown approval not presented as cancelled') from public.funding_participations where id='00000000-0000-4000-8000-000000000091';

do $$ begin
  begin
    perform public.create_ksnet_funding_order('00000000-0000-4000-8000-000000000004', 'black', 'M', 1,
      'Buyer', '01000000000', 'buyer@ksnet-test.invalid', 'Buyer', '01000000000', '00000', 'Test', '', '', true);
    raise exception 'A new order bypassed an unknown payment';
  exception when raise_exception then
    if sqlerrm <> '이 펀딩의 기존 결제 결과를 확인 중입니다. 다시 결제하지 말고 관리자에게 문의해주세요.' then raise; end if;
  end;
end $$;
select 'PASS new checkout cannot bypass an unresolved payment for the same funding';

do $$ begin
  begin
    delete from public.funding_participations where id='00000000-0000-4000-8000-000000000091';
    raise exception 'Deleted an unresolved payment';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'PASS unresolved payment cannot lose its order through deletion';
do $$ begin
  begin
    delete from public.funding_participations where id=current_setting('test.participation')::uuid;
    raise exception 'Deleted historical paid order';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'PASS existing retention rule still protects refunded payment history';

select public.cancel_unapproved_ksnet_payment('00000000-0000-4000-8000-000000000092');
select pg_temp.assert_true((public.claim_ksnet_operation('00000000-0000-4000-8000-000000000092','confirm','late-92')->>'claimed')::boolean = false, 'cancel before approval prevents later charge');

select public.claim_ksnet_operation('00000000-0000-4000-8000-000000000093','refund',null,'00000000-0000-4000-8000-000000000001')->>'operation_id' as unpaid_cancel_op \gset
select public.finish_ksnet_operation(:'unpaid_cancel_op','cancelled');
delete from public.funding_participations where id='00000000-0000-4000-8000-000000000093';
select pg_temp.assert_true(not exists(select 1 from public.ksnet_payment_operations where id=:'unpaid_cancel_op'), 'unpaid cancelled orders retain existing cleanup behavior');

-- A funding without an active payment operation can still close normally.
insert into public.fundings(id, creator_id, brand_id, product_name, cloth_type, material, size, image_url, moq, price, status, reviewed_at, color_options, size_options, trademark_screening_required)
values ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'Closing Shirt', '반팔 티셔츠', '면', 'M', '/test.webp', 999, 2000, 'approved', now(), array['black'], array['M'], false);
insert into public.funding_participations(id,funding_id,participant_id,selected_color,selected_size,quantity,unit_price,status,payment_provider,payment_status)
values ('00000000-0000-4000-8000-000000000094', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'black', 'M', 1, 2000, 'pledged', 'ksnet', 'ready');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
set role authenticated;
select public.creator_early_close_funding('00000000-0000-4000-8000-000000000005');
reset role;
select pg_temp.assert_true(payment_status='cancelled' and
  (public.claim_ksnet_operation(id,'confirm','after-close')->>'claimed')::boolean = false,
  'normal early close cancels pending order and prevents a late charge')
from public.funding_participations where id='00000000-0000-4000-8000-000000000094';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
set role authenticated;
do $$ begin
  begin
    perform public.create_ksnet_funding_order('00000000-0000-4000-8000-000000000005', 'black', 'M', 1,
      'Buyer', '01000000000', 'buyer@ksnet-test.invalid', 'Buyer', '01000000000', '00000', 'Test', '', '', true);
    raise exception 'New payment allowed after early close';
  exception when raise_exception then
    if sqlerrm <> '현재 참여할 수 없는 펀딩입니다.' then raise; end if;
  end;
end $$;
reset role;
select 'PASS new checkout is rejected after early close';
