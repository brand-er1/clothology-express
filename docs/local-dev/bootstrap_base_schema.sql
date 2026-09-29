-- ⚠️ 로컬 전용. supabase/migrations 에 커밋하지 말 것 — 운영 DB 에 push 되면 안 된다.
--
-- 운영 DB 의 초기 스키마(profiles, orders, is_admin 등)는 Lovable 대시보드에서 만들어져
-- 저장소에 마이그레이션이 없다. 첫 마이그레이션(20260718000000)부터 이것들을 참조하므로,
-- 로컬 `supabase start` 가 끝까지 돌도록 src/integrations/supabase/types.ts 기준으로 최소한만 복원한다.
-- 사용법은 docs/KSNET_PAYMENT.md "로컬 테스트" 참고.

create type public.order_status as enum ('pending', 'approved', 'rejected', 'deleted');
create type public.user_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  full_name text,
  brand_name text,
  gender text not null default 'unspecified',
  height numeric,
  weight numeric,
  phone_number text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles are readable by owner" on public.profiles for select using (auth.uid() = id);
create policy "Profiles are updatable by owner" on public.profiles for update using (auth.uid() = id);
create policy "Profiles are insertable by owner" on public.profiles for insert with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;
create policy "Users can read own roles" on public.user_roles for select using (auth.uid() = user_id);

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles r where r.user_id = $1 and r.role = 'admin');
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  cloth_type text not null,
  material text not null,
  detail_description text,
  size text,
  measurements jsonb,
  generated_image_url text,
  image_path text,
  status public.order_status not null default 'pending',
  admin_comment text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create policy "Users can read own orders" on public.orders for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

create table public.generated_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  generation_prompt text,
  cloth_type text,
  material text,
  detail text,
  original_image_url text,
  stored_image_url text,
  image_path text,
  is_selected boolean default false,
  created_at timestamptz not null default now()
);
alter table public.generated_images enable row level security;
create policy "Users can read own images" on public.generated_images for select using (auth.uid() = user_id);

create table public.system_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 가입 시 프로필 생성. 이후 마이그레이션의 zz_* 트리거가 이 행을 갱신한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (new.id, new.raw_user_meta_data ->> 'username', new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public) values ('generated_images', 'generated_images', true)
on conflict (id) do nothing;
