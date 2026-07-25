create table if not exists public.trademark_screenings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_sha256 text not null,
  image_url text,
  source text not null check (source in ('upload', 'final_design')),
  decision text not null check (decision in ('clear', 'review', 'blocked')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  detected_marks jsonb not null default '[]'::jsonb,
  recognized_text text[] not null default '{}'::text[],
  kipris_checked boolean not null default false,
  kipris_matches jsonb not null default '[]'::jsonb,
  reason text not null,
  analysis_version text not null default 'brand-er-trademark-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trademark_screenings_user_created_idx
  on public.trademark_screenings(user_id, created_at desc);

create index if not exists trademark_screenings_decision_idx
  on public.trademark_screenings(decision, created_at desc);

create unique index if not exists trademark_screenings_cache_idx
  on public.trademark_screenings(
    user_id,
    image_sha256,
    source,
    coalesce(image_url, '')
  );

alter table public.trademark_screenings enable row level security;

drop policy if exists "Users can view own trademark screenings"
  on public.trademark_screenings;
create policy "Users can view own trademark screenings"
  on public.trademark_screenings for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

revoke insert, update, delete on public.trademark_screenings
  from anon, authenticated;
grant select on public.trademark_screenings to authenticated;

alter table public.fundings
  add column if not exists trademark_screening_id uuid
    references public.trademark_screenings(id);

alter table public.fundings
  add column if not exists trademark_screening_required boolean;

update public.fundings
set trademark_screening_required = false
where trademark_screening_required is null;

alter table public.fundings
  alter column trademark_screening_required set default true,
  alter column trademark_screening_required set not null;

create index if not exists fundings_trademark_screening_id_idx
  on public.fundings(trademark_screening_id);

drop policy if exists "Creators can create pending fundings" on public.fundings;
create policy "Creators can create pending fundings"
  on public.fundings for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and status = 'pending'
    and moq >= 20
    and trademark_screening_required = true
    and exists (
      select 1
      from public.trademark_screenings screening
      where screening.id = trademark_screening_id
        and screening.user_id = auth.uid()
        and screening.source = 'final_design'
        and screening.decision = 'clear'
        and screening.image_url = image_url
    )
  );

drop policy if exists "Creators can edit unapproved fundings"
  on public.fundings;
create policy "Creators can edit unapproved fundings"
  on public.fundings for update
  to authenticated
  using (
    creator_id = auth.uid()
    and status in ('pending', 'rejected')
  )
  with check (
    creator_id = auth.uid()
    and status in ('pending', 'rejected')
    and moq >= 20
    and (
      (
        trademark_screening_required = false
        and trademark_screening_id is null
      )
      or exists (
        select 1
        from public.trademark_screenings screening
        where screening.id = trademark_screening_id
          and screening.user_id = auth.uid()
          and screening.source = 'final_design'
          and screening.decision = 'clear'
          and screening.image_url = image_url
      )
    )
  );

create or replace function public.enforce_funding_trademark_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.trademark_screening_required
      and not new.trademark_screening_required
    then
      raise exception '상표 검수 필수 설정은 해제할 수 없습니다.';
    end if;

    if new.image_url is distinct from old.image_url then
      new.trademark_screening_required := true;
    end if;
  end if;

  if new.trademark_screening_required
    and not exists (
      select 1
      from public.trademark_screenings screening
      where screening.id = new.trademark_screening_id
        and screening.user_id = new.creator_id
        and screening.source = 'final_design'
        and screening.decision = 'clear'
        and screening.image_url = new.image_url
    )
  then
    raise exception '최종 이미지와 일치하는 상표 검수 통과 기록이 필요합니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_funding_trademark_link_trigger
  on public.fundings;
create trigger enforce_funding_trademark_link_trigger
before insert or update of
  image_url,
  trademark_screening_id,
  trademark_screening_required
on public.fundings
for each row
execute function public.enforce_funding_trademark_link();

create or replace function public.enforce_funding_trademark_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
    and (tg_op = 'INSERT' or old.status is distinct from 'approved')
    and new.trademark_screening_required
    and not exists (
      select 1
      from public.trademark_screenings screening
      where screening.id = new.trademark_screening_id
        and screening.user_id = new.creator_id
        and screening.source = 'final_design'
        and screening.decision = 'clear'
        and screening.image_url = new.image_url
    )
  then
    raise exception '상표 검수가 완료되지 않았거나 차단된 펀딩은 승인할 수 없습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_funding_trademark_approval_trigger
  on public.fundings;
create trigger enforce_funding_trademark_approval_trigger
before insert or update of status, trademark_screening_id
on public.fundings
for each row
execute function public.enforce_funding_trademark_approval();
