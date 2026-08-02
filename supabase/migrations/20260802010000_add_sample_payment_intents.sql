alter table public.fundings
  add column if not exists sample_image_url text,
  add column if not exists sample_image_path text,
  add column if not exists sample_note text,
  add column if not exists sample_shared_at timestamptz;

create table if not exists public.funding_payment_intents (
  id uuid primary key default gen_random_uuid(),
  funding_id uuid not null references public.fundings(id) on delete cascade,
  participant_id uuid not null references auth.users(id) on delete cascade,
  selected_color text not null,
  selected_size text not null,
  quantity integer not null check (quantity between 1 and 99),
  status text not null default 'waiting' check (status in ('waiting', 'converted', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funding_id, participant_id)
);

create index if not exists funding_payment_intents_funding_id_idx
  on public.funding_payment_intents(funding_id, created_at desc);

alter table public.funding_payment_intents enable row level security;

drop policy if exists "Users can view their payment intents" on public.funding_payment_intents;
create policy "Users can view their payment intents"
  on public.funding_payment_intents for select to authenticated
  using (participant_id = auth.uid());

drop policy if exists "Creators can view funding payment intents" on public.funding_payment_intents;
create policy "Creators can view funding payment intents"
  on public.funding_payment_intents for select to authenticated
  using (exists (
    select 1 from public.fundings f
    where f.id = funding_payment_intents.funding_id
      and (f.creator_id = auth.uid() or public.is_admin(auth.uid()))
  ));

create or replace function public.register_funding_payment_intent(
  p_funding_id uuid,
  p_color text,
  p_size text,
  p_quantity integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_funding public.fundings%rowtype;
  v_intent_id uuid;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    raise exception '수량은 1장부터 99장까지 선택할 수 있습니다.';
  end if;

  select * into v_funding from public.fundings where id = p_funding_id;
  if not found or v_funding.status <> 'approved' then
    raise exception '현재 결제 예정 등록이 불가능한 펀딩입니다.';
  end if;
  if not (p_color = any(v_funding.color_options)) then raise exception '선택할 수 없는 컬러입니다.'; end if;
  if not (p_size = any(v_funding.size_options)) then raise exception '선택할 수 없는 사이즈입니다.'; end if;

  insert into public.funding_payment_intents (
    funding_id, participant_id, selected_color, selected_size, quantity, status
  ) values (
    p_funding_id, v_user_id, p_color, p_size, p_quantity, 'waiting'
  )
  on conflict (funding_id, participant_id) do update
    set selected_color = excluded.selected_color,
        selected_size = excluded.selected_size,
        quantity = excluded.quantity,
        status = 'waiting',
        updated_at = now()
  returning id into v_intent_id;

  return v_intent_id;
end;
$$;

revoke all on function public.register_funding_payment_intent(uuid, text, text, integer) from public;
grant execute on function public.register_funding_payment_intent(uuid, text, text, integer) to authenticated;

create or replace function public.get_funding_payment_intents(p_funding_id uuid)
returns table (
  id uuid,
  participant_id uuid,
  participant_name text,
  phone_number text,
  selected_color text,
  selected_size text,
  quantity integer,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.fundings f
    where f.id = p_funding_id
      and (f.creator_id = auth.uid() or public.is_admin(auth.uid()))
  ) then raise exception '결제 예정자 목록을 볼 권한이 없습니다.'; end if;

  return query
  select i.id, i.participant_id,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), '결제 예정 고객'),
    p.phone_number, i.selected_color, i.selected_size, i.quantity, i.status, i.created_at
  from public.funding_payment_intents i
  left join public.profiles p on p.id = i.participant_id
  where i.funding_id = p_funding_id and i.status = 'waiting'
  order by i.created_at desc;
end;
$$;

revoke all on function public.get_funding_payment_intents(uuid) from public;
grant execute on function public.get_funding_payment_intents(uuid) to authenticated;

create or replace function public.share_funding_sample(
  p_funding_id uuid,
  p_image_url text,
  p_image_path text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fundings
  set sample_image_url = nullif(btrim(p_image_url), ''),
      sample_image_path = nullif(btrim(p_image_path), ''),
      sample_note = nullif(btrim(p_note), ''),
      sample_shared_at = now(),
      updated_at = now()
  where id = p_funding_id
    and (creator_id = auth.uid() or public.is_admin(auth.uid()));
  if not found then raise exception '샘플을 공유할 권한이 없습니다.'; end if;
end;
$$;

revoke all on function public.share_funding_sample(uuid, text, text, text) from public;
grant execute on function public.share_funding_sample(uuid, text, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('funding-samples', 'funding-samples', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

drop policy if exists "Funding creators can upload samples" on storage.objects;
create policy "Funding creators can upload samples"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'funding-samples'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Funding creators can update samples" on storage.objects;
create policy "Funding creators can update samples"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'funding-samples'
    and owner = auth.uid()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.convert_payment_intent_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    update public.funding_payment_intents
    set status = 'converted', updated_at = now()
    where funding_id = new.funding_id
      and participant_id = new.participant_id
      and status = 'waiting';
  end if;
  return new;
end;
$$;

drop trigger if exists convert_payment_intent_after_payment_trigger on public.funding_participations;
create trigger convert_payment_intent_after_payment_trigger
after update of payment_status on public.funding_participations
for each row execute function public.convert_payment_intent_after_payment();
