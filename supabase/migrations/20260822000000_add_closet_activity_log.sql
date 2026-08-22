-- Brand-er Closet 활동 로그: 회원이 옷을 만들거나, 수정하거나, 캐릭터에게 입혀보거나,
-- 룩을 저장할 때마다 한 줄씩 남긴다. 지금까지 이 데이터는 브라우저 localStorage에만
-- 남아 있어 관리자가 전혀 확인할 수 없었다 — 이 테이블과 아래 두 함수가 그 공백을 채운다.
create table if not exists public.closet_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'garment_created',
      'garment_edited',
      'garment_regenerated',
      'character_dressed',
      'look_saved'
    )
  ),
  character_gender text,
  slot text,
  garment_id text,
  label text,
  prompt text,
  image_url text,
  image_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists closet_activity_user_created_at_idx
  on public.closet_activity (user_id, created_at desc);

create index if not exists closet_activity_created_at_idx
  on public.closet_activity (created_at desc);

alter table public.closet_activity enable row level security;

-- 모든 접근은 아래 두 SECURITY DEFINER 함수를 통해서만 이뤄진다 (다른 관리자 테이블과 동일 패턴).
revoke all on table public.closet_activity from anon, authenticated;

create or replace function public.track_closet_activity(
  p_event_type text,
  p_character_gender text default null,
  p_slot text default null,
  p_garment_id text default null,
  p_label text default null,
  p_prompt text default null,
  p_image_url text default null,
  p_image_path text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  -- 게스트는 다른 브랜더 옷장 데이터와 마찬가지로 기록하지 않는다 (로그인 사용자만).
  if v_user_id is null then
    return;
  end if;
  if p_event_type not in (
    'garment_created', 'garment_edited', 'garment_regenerated',
    'character_dressed', 'look_saved'
  ) then
    return;
  end if;

  insert into public.closet_activity (
    user_id, event_type, character_gender, slot, garment_id,
    label, prompt, image_url, image_path, metadata
  ) values (
    v_user_id,
    p_event_type,
    nullif(left(coalesce(p_character_gender, ''), 20), ''),
    nullif(left(coalesce(p_slot, ''), 20), ''),
    nullif(left(coalesce(p_garment_id, ''), 200), ''),
    nullif(left(coalesce(p_label, ''), 300), ''),
    nullif(left(coalesce(p_prompt, ''), 2000), ''),
    nullif(left(coalesce(p_image_url, ''), 2000), ''),
    nullif(left(coalesce(p_image_path, ''), 500), ''),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.track_closet_activity(
  text, text, text, text, text, text, text, text, jsonb
) from public;
grant execute on function public.track_closet_activity(
  text, text, text, text, text, text, text, text, jsonb
) to authenticated;

create or replace function public.get_admin_closet_activity(p_limit integer default 500)
returns table (
  id uuid,
  user_id uuid,
  event_type text,
  character_gender text,
  slot text,
  garment_id text,
  label text,
  prompt text,
  image_url text,
  image_path text,
  metadata jsonb,
  created_at timestamptz,
  brand_name text,
  customer_name text,
  username text,
  phone_number text,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return query
  select
    activity.id,
    activity.user_id,
    activity.event_type,
    activity.character_gender,
    activity.slot,
    activity.garment_id,
    activity.label,
    activity.prompt,
    activity.image_url,
    activity.image_path,
    activity.metadata,
    activity.created_at,
    profile.brand_name,
    profile.full_name as customer_name,
    profile.username,
    profile.phone_number,
    auth_user.email::text
  from public.closet_activity activity
  left join public.profiles profile on profile.id = activity.user_id
  left join auth.users auth_user on auth_user.id = activity.user_id
  order by activity.created_at desc
  limit least(greatest(coalesce(p_limit, 500), 1), 2000);
end;
$$;

revoke all on function public.get_admin_closet_activity(integer) from public;
grant execute on function public.get_admin_closet_activity(integer) to authenticated;
