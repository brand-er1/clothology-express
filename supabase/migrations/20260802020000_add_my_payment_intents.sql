create or replace function public.get_my_funding_payment_intents()
returns table (
  id uuid,
  funding_id uuid,
  participant_id uuid,
  product_name text,
  image_url text,
  funding_status text,
  creator_id uuid,
  selected_color text,
  selected_size text,
  quantity integer,
  unit_price integer,
  total_amount integer,
  status text,
  sample_image_url text,
  sample_note text,
  sample_shared_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  return query
  select
    intent.id,
    intent.funding_id,
    intent.participant_id,
    funding.product_name,
    funding.image_url,
    funding.status,
    funding.creator_id,
    intent.selected_color,
    intent.selected_size,
    intent.quantity,
    coalesce(funding.price, 0),
    coalesce(funding.price, 0) * intent.quantity,
    intent.status,
    funding.sample_image_url,
    funding.sample_note,
    funding.sample_shared_at,
    intent.created_at
  from public.funding_payment_intents intent
  join public.fundings funding on funding.id = intent.funding_id
  where intent.participant_id = auth.uid()
    and intent.status = 'waiting'
  order by intent.created_at desc;
end;
$$;

revoke all on function public.get_my_funding_payment_intents() from public;
grant execute on function public.get_my_funding_payment_intents() to authenticated;

