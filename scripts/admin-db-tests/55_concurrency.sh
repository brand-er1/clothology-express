#!/usr/bin/env bash
# 테스트 4: 동시 결제(19장 → 22장, 실결제 2건 + 모의결제 1건 동시)에서도 성공 알림/문자는 정확히 1번.
# 각 세션을 같은 시각에 출발시키고 트랜잭션을 잠시 붙잡아 실제 경합을 만든다. 디스패처 동시 claim 도 검증한다.
set -euo pipefail
DB="${ADMIN_TEST_DB:-brander_admin_test}"
P=(psql -v ON_ERROR_STOP=1 -q -At -d "$DB")
F=00000000-0000-0000-0000-000000001004
B1=00000000-0000-0000-0000-00000000b001
B9=00000000-0000-0000-0000-00000000b009

"${P[@]}" >/dev/null <<SQL
truncate public._t;
insert into public.funding_participations (id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price, status, payment_provider, payment_status, payment_approved_at)
values ('00000000-0000-0000-0000-0000000c4000','$F','$B1','white','M',19,20000,'pledged','mock','paid', now());
update public.fundings set current_orders = 19 where id = '$F';
insert into public.funding_participations (id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price, status, payment_provider, payment_status, partner_order_id)
values ('00000000-0000-0000-0000-0000000c4001','$F','$B1','white','M',1,20000,'pledged','kakaopay','ready','KP-C1'),
       ('00000000-0000-0000-0000-0000000c4002','$F','$B9','white','M',1,20000,'pledged','kakaopay','ready','KP-C2');
SQL
before=$("${P[@]}" -c "select funding_status || '/' || (select count(*) from community_notifications where funding_id='$F') from fundings where id='$F'")
[[ "$before" == "funding/0" ]] || { echo "concurrency setup unexpected: $before"; exit 1; }

START=$("${P[@]}" -c "select (clock_timestamp() + interval '1.5 seconds')::text")
barrier="select pg_sleep(greatest(0, extract(epoch from '$START'::timestamptz - clock_timestamp())));"
pids=()
for n in 1 2; do
  user=$([[ $n == 1 ]] && echo $B1 || echo $B9)
  "${P[@]}" >/dev/null 2>/tmp/conc_$n.err <<SQL &
$barrier
begin;
set local role service_role;
select public.finalize_funding_payment('00000000-0000-0000-0000-0000000c400$n', '$user', 'MONEY', now(), '{}'::jsonb);
select pg_sleep(0.4);
commit;
SQL
  pids+=($!)
done
"${P[@]}" >/dev/null 2>/tmp/conc_3.err <<SQL &
$barrier
begin;
select set_config('request.jwt.claim.sub', '$B9', true);
set local role authenticated;
select partner_order_id from public.create_mock_funding_order('$F','white','M',1,'정구매','010-7777-8888','b9@test.com','정구매','010-7777-8888','06000','서울 강남구 2',null,null,true);
select pg_sleep(0.4);
commit;
SQL
pids+=($!)
for pid in "${pids[@]}"; do wait "$pid" || { echo "concurrent session failed"; cat /tmp/conc_*.err; exit 1; }; done

# 동시 디스패처 3개가 같은 작업을 가져가려 해도 1개만 가져간다.
START=$("${P[@]}" -c "select (clock_timestamp() + interval '1 second')::text")
barrier="select pg_sleep(greatest(0, extract(epoch from '$START'::timestamptz - clock_timestamp())));"
for n in 1 2 3; do
  "${P[@]}" > /tmp/claim_$n.out 2>&1 <<SQL &
$barrier
begin;
set local role service_role;
select count(*) from public.claim_notification_jobs('$F', null, 20);
select pg_sleep(0.3);
commit;
SQL
  pids+=($!)
done
wait
claimed=$(cat /tmp/claim_1.out /tmp/claim_2.out /tmp/claim_3.out | grep -E '^[0-9]+$' | paste -sd+ | bc)

"${P[@]}" >/dev/null <<SQL
select t_eq('T4 concurrent 19->22: quantity', \$\$select final_quantity || '/' || current_orders || '/' || funding_status from fundings where id='$F'\$\$, '22/22/success');
select t_eq('T4 concurrent: exactly one site notification', \$\$select count(*)::text from community_notifications where funding_id='$F' and type='funding_success'\$\$, '1');
select t_eq('T4 concurrent: exactly one sms job', \$\$select count(*)::text from notification_logs where funding_id='$F' and channel='sms'\$\$, '1');
select t_eq('T4 concurrent: exactly one site log', \$\$select count(*)::text from notification_logs where funding_id='$F' and channel='site'\$\$, '1');
select t_eq('T4 concurrent dispatchers: claimed once', 'select ''$claimed''', '1');
select t_eq('T4 claimed job is sending (single attempt)', \$\$select status || '/' || attempt_count from notification_logs where funding_id='$F' and channel='sms'\$\$, 'sending/1');
SQL
