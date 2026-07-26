alter table public.trademark_screenings
  add column if not exists analysis_status text not null default 'completed',
  add column if not exists analysis_summary text not null default '',
  add column if not exists selected_cloth_type text,
  add column if not exists selected_material text,
  add column if not exists candidate_regions jsonb not null default '[]'::jsonb,
  add column if not exists similarity_scores jsonb not null default '{}'::jsonb,
  add column if not exists composite_risk_score numeric(5, 2) not null default 0,
  add column if not exists decision_factors text[] not null default '{}'::text[],
  add column if not exists source_priority_applied boolean not null default false,
  add column if not exists parent_screening_id uuid
    references public.trademark_screenings(id) on delete set null,
  add column if not exists supersedes_screening_id uuid
    references public.trademark_screenings(id) on delete set null,
  add column if not exists screening_version integer not null default 1,
  add column if not exists automated_decision text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists review_note text;

update public.trademark_screenings
set automated_decision = decision
where automated_decision is null;

alter table public.trademark_screenings
  alter column automated_decision set not null,
  alter column automated_decision set default 'clear';

alter table public.trademark_screenings
  drop constraint if exists trademark_screenings_analysis_status_check,
  add constraint trademark_screenings_analysis_status_check
    check (analysis_status in ('completed', 'unavailable')),
  drop constraint if exists trademark_screenings_automated_decision_check,
  add constraint trademark_screenings_automated_decision_check
    check (automated_decision in ('clear', 'review', 'blocked')),
  drop constraint if exists trademark_screenings_composite_risk_score_check,
  add constraint trademark_screenings_composite_risk_score_check
    check (composite_risk_score between 0 and 100),
  drop constraint if exists trademark_screenings_screening_version_check,
  add constraint trademark_screenings_screening_version_check
    check (screening_version >= 1);

create index if not exists trademark_screenings_parent_idx
  on public.trademark_screenings(parent_screening_id);

create index if not exists trademark_screenings_supersedes_idx
  on public.trademark_screenings(supersedes_screening_id);

drop index if exists public.trademark_screenings_cache_idx;
create unique index trademark_screenings_cache_idx
  on public.trademark_screenings(
    user_id,
    image_sha256,
    source,
    analysis_version,
    coalesce(image_url, ''),
    coalesce(
      parent_screening_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    ),
    coalesce(
      supersedes_screening_id,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  );

create table if not exists public.trademark_screening_events (
  id uuid primary key default gen_random_uuid(),
  screening_id uuid not null
    references public.trademark_screenings(id) on delete cascade,
  from_decision text
    check (from_decision is null or from_decision in ('clear', 'review', 'blocked')),
  to_decision text not null
    check (to_decision in ('clear', 'review', 'blocked')),
  actor_type text not null
    check (actor_type in ('system', 'admin', 'user')),
  actor_user_id uuid references auth.users(id),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trademark_screening_events_screening_idx
  on public.trademark_screening_events(screening_id, created_at);

alter table public.trademark_screening_events enable row level security;

drop policy if exists "Users can view own trademark screening events"
  on public.trademark_screening_events;
create policy "Users can view own trademark screening events"
  on public.trademark_screening_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.trademark_screenings screening
      where screening.id = trademark_screening_events.screening_id
        and (
          screening.user_id = auth.uid()
          or public.is_admin(auth.uid())
        )
    )
  );

revoke insert, update, delete on public.trademark_screening_events
  from anon, authenticated;
grant select on public.trademark_screening_events to authenticated;

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
        and screening.decision in ('clear', 'review')
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
          and screening.decision in ('clear', 'review')
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
        and screening.decision in ('clear', 'review')
        and screening.image_url = new.image_url
    )
  then
    raise exception '최종 이미지와 일치하는 상표 검수 통과 또는 검토 기록이 필요합니다.';
  end if;

  return new;
end;
$$;

create or replace function public.review_funding_with_trademark(
  p_funding_id uuid,
  p_status text,
  p_admin_comment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funding public.fundings%rowtype;
  v_screening public.trademark_screenings%rowtype;
  v_from_decision text;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자만 펀딩을 검토할 수 있습니다.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception '올바르지 않은 검토 상태입니다.';
  end if;

  select * into v_funding
  from public.fundings
  where id = p_funding_id
  for update;

  if not found then
    raise exception '펀딩을 찾을 수 없습니다.';
  end if;

  if v_funding.trademark_screening_required then
    select * into v_screening
    from public.trademark_screenings
    where id = v_funding.trademark_screening_id
    for update;

    if not found then
      raise exception '상표 검수 기록을 찾을 수 없습니다.';
    end if;

    if p_status = 'approved' and v_screening.decision = 'blocked' then
      raise exception '상표 고위험으로 차단된 펀딩은 승인할 수 없습니다.';
    end if;

    if v_screening.decision = 'review' then
      v_from_decision := v_screening.decision;

      update public.trademark_screenings
      set decision = case
            when p_status = 'approved' then 'clear'
            else 'blocked'
          end,
          reviewed_at = now(),
          reviewed_by = auth.uid(),
          review_note = nullif(btrim(coalesce(p_admin_comment, '')), ''),
          reason = case
            when p_status = 'approved'
              then reason || ' 관리자 권리관계 확인을 거쳐 승인되었습니다.'
            else reason || ' 관리자 검토 결과 등록이 차단되었습니다.'
          end,
          updated_at = now()
      where id = v_screening.id;

      insert into public.trademark_screening_events (
        screening_id,
        from_decision,
        to_decision,
        actor_type,
        actor_user_id,
        reason
      )
      values (
        v_screening.id,
        v_from_decision,
        case when p_status = 'approved' then 'clear' else 'blocked' end,
        'admin',
        auth.uid(),
        coalesce(
          nullif(btrim(coalesce(p_admin_comment, '')), ''),
          case
            when p_status = 'approved' then '관리자 검토 승인'
            else '관리자 검토 차단'
          end
        )
      );
    end if;
  end if;

  update public.fundings
  set status = p_status,
      admin_comment = nullif(btrim(coalesce(p_admin_comment, '')), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = p_funding_id;
end;
$$;

revoke all on function public.review_funding_with_trademark(uuid, text, text)
  from public;
grant execute on function public.review_funding_with_trademark(uuid, text, text)
  to authenticated;
