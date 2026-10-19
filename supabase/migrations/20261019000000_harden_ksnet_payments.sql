-- Payment mutation RPCs must never be callable by browsers. Supabase grants
-- anon/authenticated explicitly by default; revoking PUBLIC alone is insufficient.
revoke all on function public.finalize_funding_payment(uuid, uuid, text, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.finalize_funding_cancellation(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_funding_payment(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.participate_in_funding(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.create_mock_funding_order(uuid, text, text, integer, text, text, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;

-- A durable claim survives Edge Function restarts and network timeouts. There is
-- deliberately no automatic expiry: an unknown approval must not be charged again.
create table public.ksnet_payment_operations (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.funding_participations(id) on delete cascade,
  kind text not null check (kind in ('confirm', 'refund')),
  state text not null default 'processing' check (state in ('processing', 'succeeded', 'failed', 'review_required')),
  comm_con_id text unique,
  tid text,
  actor_id uuid not null,
  source text not null check (source in ('participant', 'creator')),
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ksnet_one_active_operation on public.ksnet_payment_operations(participation_id)
  where state in ('processing', 'review_required');
create unique index ksnet_one_confirmed_tid on public.ksnet_payment_operations(tid)
  where kind = 'confirm' and tid is not null;
alter table public.ksnet_payment_operations enable row level security;
revoke all on public.ksnet_payment_operations from public, anon, authenticated;
grant select, insert, update on public.ksnet_payment_operations to service_role;

create function public.claim_ksnet_operation(
  p_participation_id uuid, p_kind text, p_comm_con_id text default null,
  p_actor_id uuid default null, p_source text default 'participant', p_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_p public.funding_participations%rowtype;
  v_id uuid;
begin
  select * into v_p from public.funding_participations where id = p_participation_id for update;
  if not found or v_p.payment_provider <> 'ksnet' then
    raise exception 'KSNET 결제 내역을 찾을 수 없습니다.';
  end if;
  if p_kind not in ('confirm', 'refund') or p_kind is null then raise exception 'Invalid operation'; end if;
  if p_kind = 'refund' then
    if p_actor_id is null or p_source is null or p_source not in ('participant', 'creator') then
      raise exception '취소 권한이 없습니다.';
    end if;
    if p_source = 'participant' and p_actor_id <> v_p.participant_id then raise exception '취소 권한이 없습니다.'; end if;
    if p_source = 'creator' then
      if not exists (select 1 from public.fundings f where f.id = v_p.funding_id
        and (f.creator_id = p_actor_id or public.is_admin(p_actor_id))) then raise exception '취소 권한이 없습니다.'; end if;
      if char_length(btrim(coalesce(p_reason, ''))) not between 2 and 500 then raise exception '취소 사유를 확인해주세요.'; end if;
    end if;
  end if;
  if exists (select 1 from public.ksnet_payment_operations where participation_id = v_p.id and state in ('processing', 'review_required')) then
    if p_kind = 'confirm' then return jsonb_build_object('claimed', false, 'funding_id', v_p.funding_id); end if;
    raise exception '결제 또는 환불 결과를 확인 중입니다. 다시 결제하지 말고 관리자에게 문의해주세요.';
  end if;
  if p_kind = 'confirm' then
    if v_p.payment_status <> 'ready' or v_p.status = 'cancelled' then return jsonb_build_object('claimed', false); end if;
    if p_comm_con_id is null or p_comm_con_id !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'Invalid payment reference'; end if;
  else
    if v_p.status = 'fulfilled' then raise exception '이미 제작 처리가 완료된 참여 건은 취소할 수 없습니다.'; end if;
    if v_p.payment_status = 'cancelled' then return jsonb_build_object('claimed', false, 'funding_id', v_p.funding_id); end if;
    if v_p.payment_status = 'paid' and nullif(v_p.payment_tid, '') is null then raise exception 'KSNET 거래번호를 찾을 수 없습니다.'; end if;
  end if;
  insert into public.ksnet_payment_operations(participation_id, kind, comm_con_id, actor_id, source, reason, tid)
  values (v_p.id, p_kind, case when p_kind = 'confirm' then p_comm_con_id end,
    case when p_kind = 'confirm' then v_p.participant_id else p_actor_id end,
    case when p_kind = 'confirm' then 'participant' else p_source end, p_reason,
    case when p_kind = 'refund' and v_p.payment_status = 'paid' then v_p.payment_tid end)
  returning id into v_id;
  return jsonb_build_object('claimed', true, 'operation_id', v_id, 'participation_id', v_p.id,
    'funding_id', v_p.funding_id, 'amount', v_p.total_amount,
    'tid', case when p_kind = 'refund' and v_p.payment_status = 'paid' then v_p.payment_tid end);
end;
$$;

-- Browser cancellation is only allowed before an approval has been claimed.
-- Checking and cancelling under the same row lock prevents stale reads.
create function public.cancel_unapproved_ksnet_payment(p_participation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_p public.funding_participations%rowtype;
begin
  select * into v_p from public.funding_participations where id = p_participation_id for update;
  if not found or v_p.payment_provider <> 'ksnet' or v_p.payment_status <> 'ready' then return; end if;
  if exists (select 1 from public.ksnet_payment_operations where participation_id = v_p.id and state in ('processing', 'review_required')) then return; end if;
  perform public.finalize_funding_cancellation(v_p.id, v_p.participant_id, '{"cancelled_without_payment":true}'::jsonb);
end;
$$;

-- Persist the PG receipt separately BEFORE finalization, so a failed finalization
-- cannot roll back the only durable copy of the transaction ID.
create function public.record_ksnet_approval(p_operation_id uuid, p_tid text, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if nullif(p_tid, '') is null then raise exception 'Missing KSNET transaction ID'; end if;
  if exists (select 1 from public.funding_participations fp
    where fp.payment_provider = 'ksnet' and fp.payment_tid = p_tid
      and fp.id <> (select participation_id from public.ksnet_payment_operations where id = p_operation_id)) then
    raise exception '다른 주문에 기록된 KSNET 거래번호입니다.';
  end if;
  update public.ksnet_payment_operations set tid = p_tid, payload = p_payload, updated_at = now()
  where id = p_operation_id and kind = 'confirm' and state in ('processing', 'review_required') and (tid is null or tid = p_tid);
  if not found then raise exception '결제 처리 권한이 없습니다.'; end if;
end;
$$;

create function public.finish_ksnet_operation(p_operation_id uuid, p_outcome text, p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_o public.ksnet_payment_operations%rowtype;
  v_p public.funding_participations%rowtype;
begin
  -- All RPCs acquire the participation lock before the operation lock.
  select fp.* into v_p from public.funding_participations fp
    where fp.id = (select participation_id from public.ksnet_payment_operations where id = p_operation_id) for update;
  select * into v_o from public.ksnet_payment_operations where id = p_operation_id for update;
  if not found then raise exception '결제 처리 내역이 없습니다.'; end if;
  if v_o.state in ('succeeded', 'failed') then return; end if;
  if p_outcome is null or p_outcome not in ('paid', 'cancelled', 'failed', 'review_required') then raise exception 'Invalid outcome'; end if;
  perform set_config('app.ksnet_operation_id', v_o.id::text, true);
  if p_outcome = 'paid' then
    if v_o.kind <> 'confirm' or nullif(v_o.tid, '') is null
      or (v_o.payload->>'order_no') is distinct from v_p.id::text
      or (v_o.payload->>'amount')::numeric is distinct from v_p.total_amount::numeric then
      raise exception 'KSNET 승인 정보가 주문과 일치하지 않습니다.';
    end if;
    update public.funding_participations set payment_tid = v_o.tid where id = v_p.id;
    perform public.finalize_funding_payment(v_p.id, v_p.participant_id, 'CARD', now(), v_o.payload);
  elsif p_outcome = 'cancelled' then
    if v_o.tid is not null and (p_payload->>'refund_confirmed') is distinct from 'true' then
      raise exception 'PG 취소 확인이 필요합니다.';
    end if;
    if v_o.kind = 'confirm' and v_o.tid is not null then
      update public.funding_participations set payment_tid = v_o.tid where id = v_p.id;
    end if;
    if v_o.source = 'creator' then
      perform public.finalize_creator_funding_cancellation(v_p.id, v_o.actor_id, v_o.payload || p_payload, v_o.reason);
    else
      perform public.finalize_funding_cancellation(v_p.id, v_p.participant_id, v_o.payload || p_payload);
    end if;
  elsif p_outcome = 'failed' then
    if v_o.kind = 'confirm' then
      if v_o.tid is not null then raise exception '승인된 결제를 실패 처리할 수 없습니다.'; end if;
      perform public.fail_funding_payment(v_p.id, v_p.participant_id, p_payload);
    end if;
  end if;
  update public.ksnet_payment_operations
  set state = case when p_outcome = 'review_required' then 'review_required' when p_outcome = 'failed' then 'failed' else 'succeeded' end,
      payload = payload || p_payload, updated_at = now()
  where id = v_o.id;
  perform set_config('app.ksnet_operation_id', '', true);
end;
$$;

-- Older RPCs/admin requests must not alter the order while an external request is
-- in flight. Only finish_ksnet_operation can release the durable claim.
create function public.guard_ksnet_operation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_operation_id uuid;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.ksnet_payment_operations
      where participation_id = old.id and state in ('processing', 'review_required')) then
      raise exception '결제 또는 환불 처리 중에는 주문을 삭제할 수 없습니다.';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.payment_provider = 'ksnet' and exists (
      select 1 from public.ksnet_payment_operations o
      join public.funding_participations fp on fp.id = o.participation_id
      where fp.participant_id = new.participant_id and fp.funding_id = new.funding_id
        and o.state in ('processing', 'review_required')
    ) then
      raise exception '이 펀딩의 기존 결제 결과를 확인 중입니다. 다시 결제하지 말고 관리자에게 문의해주세요.';
    end if;
    return new;
  end if;
  if old.payment_provider <> 'ksnet' then return new; end if;
  if (new.status, new.payment_status, new.payment_tid, new.quantity, new.unit_price)
      is not distinct from (old.status, old.payment_status, old.payment_tid, old.quantity, old.unit_price) then return new; end if;
  select id into v_operation_id from public.ksnet_payment_operations
    where participation_id = old.id and state in ('processing', 'review_required');
  if found and coalesce(current_setting('app.ksnet_operation_id', true), '') <> v_operation_id::text then
    raise exception '결제 또는 환불 처리 중에는 주문을 변경할 수 없습니다.';
  end if;
  return new;
end;
$$;
create trigger guard_ksnet_operation before insert or update or delete on public.funding_participations
  for each row execute function public.guard_ksnet_operation();

create function public.get_ksnet_operation(p_operation_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('state', state, 'tid', tid, 'payload', payload)
  from public.ksnet_payment_operations where id = p_operation_id;
$$;

revoke all on function public.claim_ksnet_operation(uuid, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.cancel_unapproved_ksnet_payment(uuid) from public, anon, authenticated;
revoke all on function public.record_ksnet_approval(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.finish_ksnet_operation(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.guard_ksnet_operation() from public, anon, authenticated;
revoke all on function public.get_ksnet_operation(uuid) from public, anon, authenticated;
grant execute on function public.claim_ksnet_operation(uuid, text, text, uuid, text, text) to service_role;
grant execute on function public.cancel_unapproved_ksnet_payment(uuid) to service_role;
grant execute on function public.record_ksnet_approval(uuid, text, jsonb) to service_role;
grant execute on function public.finish_ksnet_operation(uuid, text, jsonb) to service_role;
grant execute on function public.get_ksnet_operation(uuid) to service_role;
notify pgrst, 'reload schema';
