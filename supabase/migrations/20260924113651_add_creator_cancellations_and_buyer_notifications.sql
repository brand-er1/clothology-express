-- Keep cancellation history instead of physically deleting paid/order records.
-- The customer notification is written in the same database transaction as
-- the cancellation or funding deletion.

alter table public.funding_participations
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_source text,
  add column if not exists buyer_notified_at timestamptz;

alter table public.funding_participations
  drop constraint if exists funding_participations_cancellation_source_check,
  add constraint funding_participations_cancellation_source_check
    check (
      cancellation_source is null
      or cancellation_source in ('participant', 'creator', 'admin')
    ),
  drop constraint if exists funding_participations_cancellation_reason_length,
  add constraint funding_participations_cancellation_reason_length
    check (cancellation_reason is null or char_length(cancellation_reason) <= 500);

comment on column public.funding_participations.cancelled_by is
  '참여 취소를 실행한 회원. 참여자·펀딩 제작자·관리자 중 하나다.';
comment on column public.funding_participations.cancellation_reason is
  '구매자 알림에도 표시되는 참여 취소 사유.';
comment on column public.funding_participations.buyer_notified_at is
  '사이트 내 구매자 알림이 생성된 시각.';

alter table public.community_notifications
  drop constraint if exists community_notifications_type_check,
  add constraint community_notifications_type_check check (type in (
    'like', 'comment', 'reply', 'purchase_intent', 'poll_vote', 'follow',
    'purchase_intent_goal', 'funding_started', 'funding_status_changed',
    'participation_cancelled', 'funding_cancelled'
  ));

create or replace function public.finalize_creator_funding_cancellation(
  p_participation_id uuid,
  p_actor_id uuid,
  p_payment_payload jsonb,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participation public.funding_participations%rowtype;
  v_creator_id uuid;
  v_product_name text;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_was_counted boolean;
  v_source text;
begin
  if p_actor_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if char_length(v_reason) < 2 or char_length(v_reason) > 500 then
    raise exception '취소 사유를 2자 이상 500자 이하로 입력해주세요.';
  end if;

  select participation.*
    into v_participation
  from public.funding_participations participation
  where participation.id = p_participation_id
  for update;

  if not found then
    raise exception '참여 내역을 찾을 수 없습니다.';
  end if;

  select funding.creator_id, funding.product_name
    into v_creator_id, v_product_name
  from public.fundings funding
  where funding.id = v_participation.funding_id
  for update;

  if v_creator_id is null then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;
  if p_actor_id <> v_creator_id and not public.is_admin(p_actor_id) then
    raise exception '본인이 만든 펀딩의 참여자만 취소할 수 있습니다.';
  end if;
  if v_participation.status = 'fulfilled' then
    raise exception '이미 제작 처리가 완료된 참여 건은 취소할 수 없습니다.';
  end if;
  if v_participation.status = 'cancelled'
    and v_participation.payment_status = 'cancelled'
    and v_participation.buyer_notified_at is not null then
    return;
  end if;

  v_was_counted := v_participation.status <> 'cancelled'
    and v_participation.payment_status in ('unpaid', 'paid');
  v_source := case when p_actor_id = v_creator_id then 'creator' else 'admin' end;

  update public.funding_participations
  set status = 'cancelled',
      payment_status = 'cancelled',
      payment_cancelled_at = coalesce(payment_cancelled_at, now()),
      payment_payload = coalesce(p_payment_payload, payment_payload),
      cancelled_by = p_actor_id,
      cancellation_reason = v_reason,
      cancellation_source = v_source,
      buyer_notified_at = now(),
      updated_at = now()
  where id = p_participation_id;

  if v_was_counted then
    update public.fundings
    set current_orders = greatest(0, current_orders - v_participation.quantity),
        updated_at = now()
    where id = v_participation.funding_id;
  end if;

  if v_participation.participant_id <> p_actor_id then
    insert into public.community_notifications (
      recipient_id,
      actor_id,
      type,
      funding_id,
      message
    ) values (
      v_participation.participant_id,
      p_actor_id,
      'participation_cancelled',
      v_participation.funding_id,
      format('''%s'' 펀딩 참여가 제작자에 의해 취소되었습니다. 사유: %s', v_product_name, v_reason)
    );
  end if;
end;
$$;

revoke all on function public.finalize_creator_funding_cancellation(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.finalize_creator_funding_cancellation(uuid, uuid, jsonb, text)
  to service_role;

create or replace function public.delete_creator_funding_with_notifications(
  p_funding_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_funding public.fundings%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if p_actor_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if char_length(v_reason) < 2 or char_length(v_reason) > 500 then
    raise exception '삭제 사유를 2자 이상 500자 이하로 입력해주세요.';
  end if;

  select * into v_funding
  from public.fundings funding
  where funding.id = p_funding_id
  for update;

  if not found then
    raise exception '이미 삭제되었거나 존재하지 않는 펀딩입니다.';
  end if;
  if v_funding.creator_id <> p_actor_id and not public.is_admin(p_actor_id) then
    raise exception '본인이 만든 펀딩만 삭제할 수 있습니다.';
  end if;
  if v_funding.current_orders > 0 or exists (
    select 1
    from public.funding_participations participation
    where participation.funding_id = p_funding_id
      and (
        participation.status <> 'cancelled'
        or participation.payment_status in ('ready', 'paid')
      )
  ) then
    raise exception '진행 중인 참여 내역이 있습니다. 참여자를 먼저 취소하고 구매자에게 안내해주세요.';
  end if;

  insert into public.community_notifications (
    recipient_id,
    actor_id,
    type,
    funding_id,
    message
  )
  select
    recipient.user_id,
    p_actor_id,
    'funding_cancelled',
    p_funding_id,
    format('''%s'' 펀딩이 제작자에 의해 삭제되었습니다. 안내: %s', v_funding.product_name, v_reason)
  from (
    select participation.participant_id as user_id
    from public.funding_participations participation
    where participation.funding_id = p_funding_id
    union
    select intent.participant_id as user_id
    from public.funding_payment_intents intent
    where intent.funding_id = p_funding_id
  ) recipient
  where recipient.user_id <> p_actor_id;

  delete from public.fundings where id = p_funding_id;
end;
$$;

revoke all on function public.delete_creator_funding_with_notifications(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_creator_funding_with_notifications(uuid, uuid, text)
  to service_role;
