-- 정산 금액에서 모의결제를 완전히 제외한다.
--
-- 기존 _settlement_figures 는 payment_approved_at 이 있는 모든 결제(모의결제 포함)를 총 거래액으로 잡고
-- calculation.includes_mock_payments 플래그만 남겼다. 그 결과 모의결제 금액이 final_amount(지급액)에
-- 그대로 들어갈 수 있었다. 모의결제는 실제 입금이 없으므로 정산·매출 어디에도 합산하지 않는다.
--
-- - 총 거래액 / 환불액 / 순매출 / 지급액: 실결제(payment_provider <> 'mock')만
-- - mock_amount: 참고용으로 계속 따로 보여준다(지급 대상 아님)
-- - 이미 지급 완료(completed)된 정산은 바꾸지 않는다. 미지급(pending/scheduled/on_hold) 정산만 다시 계산한다.
-- 테이블 구조는 그대로이며 데이터를 삭제하지 않는다.

create or replace function public._settlement_figures(p_funding_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'gross_amount', coalesce(sum(fp.total_amount) filter (
      where fp.payment_approved_at is not null and fp.payment_provider <> 'mock'), 0),
    'refund_amount', coalesce(sum(fp.total_amount) filter (
      where fp.payment_approved_at is not null and fp.payment_provider <> 'mock' and fp.payment_status = 'cancelled'), 0),
    'mock_amount', coalesce(sum(fp.total_amount) filter (
      where fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.payment_provider = 'mock'), 0),
    'real_amount', coalesce(sum(fp.total_amount) filter (
      where fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.payment_provider <> 'mock'), 0),
    'paid_orders', count(*) filter (
      where fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.payment_provider <> 'mock'),
    'mock_orders', count(*) filter (
      where fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.payment_provider = 'mock'),
    'refunded_orders', count(*) filter (
      where fp.payment_approved_at is not null and fp.payment_provider <> 'mock' and fp.payment_status = 'cancelled'),
    'net_quantity', coalesce(sum(fp.quantity) filter (
      where fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.payment_provider <> 'mock'), 0),
    'mock_quantity', coalesce(sum(fp.quantity) filter (
      where fp.payment_status = 'paid' and fp.status <> 'cancelled' and fp.payment_provider = 'mock'), 0)
  )
  from public.funding_participations fp
  where fp.funding_id = p_funding_id;
$$;

revoke all on function public._settlement_figures(uuid) from public, anon, authenticated;

create or replace function public._settlement_recalculate(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s public.settlements%rowtype;
  v_fig jsonb;
  v_gross bigint;
  v_refund bigint;
  v_net bigint;
  v_fee bigint;
begin
  select * into v_s from public.settlements where id = p_settlement_id for update;
  v_fig := public._settlement_figures(v_s.funding_id);
  v_gross := (v_fig ->> 'gross_amount')::bigint;
  v_refund := (v_fig ->> 'refund_amount')::bigint;
  v_net := v_gross - v_refund;
  v_fee := round(v_net * v_s.commission_rate / 100);

  update public.settlements
  set gross_amount = v_gross,
      refund_amount = v_refund,
      net_sales = v_net,
      mock_amount = (v_fig ->> 'mock_amount')::bigint,
      real_amount = (v_fig ->> 'real_amount')::bigint,
      platform_fee = v_fee,
      final_amount = v_net - v_fee - v_s.production_cost - v_s.other_deductions,
      calculation = v_fig || jsonb_build_object(
        'formula', '최종 정산금 = (실결제 거래액 - 실결제 취소/환불) - 플랫폼 수수료 - 제작비 - 기타 차감 (모의결제 제외)',
        'net_sales', v_net,
        'commission_rate', v_s.commission_rate,
        'platform_fee', v_fee,
        'production_cost', v_s.production_cost,
        'other_deductions', v_s.other_deductions,
        'final_amount', v_net - v_fee - v_s.production_cost - v_s.other_deductions,
        'includes_mock_payments', false,
        'mock_excluded', true,
        'calculated_at', now()
      ),
      updated_at = now()
  where id = p_settlement_id;
end;
$$;

revoke all on function public._settlement_recalculate(uuid) from public, anon, authenticated;

-- 아직 지급하지 않은 정산만 새 기준으로 다시 계산한다(지급 완료 건은 기록 보존).
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.settlements where status in ('pending', 'scheduled', 'on_hold') loop
    perform public._settlement_recalculate(v_id);
  end loop;
end;
$$;
