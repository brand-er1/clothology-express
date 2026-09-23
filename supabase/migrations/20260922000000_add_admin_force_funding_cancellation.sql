-- 관리자가 다른 사용자의 펀딩 참여 건을 강제로 취소·환불 처리할 수 있도록
-- finalize_funding_cancellation의 소유자 제한에 is_admin 예외를 추가합니다.
-- (참여자 본인 취소 흐름은 그대로 유지되며, 관리자만 대신 처리할 수 있게 됩니다.)
create or replace function public.finalize_funding_cancellation(
  p_participation_id uuid,
  p_user_id uuid,
  p_payment_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participation public.funding_participations%rowtype;
  v_was_counted boolean;
begin
  select * into v_participation
  from public.funding_participations
  where id = p_participation_id
  for update;

  if not found then
    raise exception '취소할 펀딩 참여 내역을 찾을 수 없습니다.';
  end if;

  if v_participation.participant_id <> p_user_id and not public.is_admin(p_user_id) then
    raise exception '취소할 펀딩 참여 내역을 찾을 수 없습니다.';
  end if;

  if v_participation.status = 'fulfilled' then
    raise exception '이미 제작 처리가 완료된 참여 건은 취소할 수 없습니다.';
  end if;

  if v_participation.status = 'cancelled' and v_participation.payment_status = 'cancelled' then
    return;
  end if;

  v_was_counted := v_participation.status <> 'cancelled'
    and v_participation.payment_status in ('unpaid', 'paid');

  update public.funding_participations
  set status = 'cancelled',
      payment_status = 'cancelled',
      payment_cancelled_at = now(),
      payment_payload = coalesce(p_payment_payload, payment_payload),
      updated_at = now()
  where id = p_participation_id;

  if v_was_counted then
    update public.fundings
    set current_orders = greatest(0, current_orders - v_participation.quantity),
        updated_at = now()
    where id = v_participation.funding_id;
  end if;
end;
$$;

revoke all on function public.finalize_funding_cancellation(uuid, uuid, jsonb) from public;
grant execute on function public.finalize_funding_cancellation(uuid, uuid, jsonb) to service_role;
