-- Minimal Supabase-compatible stubs for local migration testing.
create extension if not exists pgcrypto;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  banned_until timestamptz,
  created_at timestamptz default now(),
  last_sign_in_at timestamptz
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

-- Lovable-era baseline objects that predate supabase/migrations (shape from src/integrations/supabase/types.ts).
create type public.user_role as enum ('admin', 'user');
create type public.order_status as enum ('pending', 'approved', 'rejected');
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, username text, phone_number text, address text, brand_name text,
  gender text not null default 'unspecified', height numeric, weight numeric,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;
create or replace function public.is_admin(user_id uuid) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r where r.user_id = $1 and r.role = 'admin')
$$;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  cloth_type text not null, material text not null, size text, detail_description text,
  measurements jsonb, generated_image_url text, image_path text,
  status public.order_status not null default 'pending', admin_comment text,
  reviewed_at timestamptz, reviewed_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create table public.system_prompts (id uuid primary key default gen_random_uuid(), prompt text not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.generated_images (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), prompt text, image_url text, created_at timestamptz default now()
);
alter table public.generated_images enable row level security;
-- handle_new_user style trigger
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username) values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
