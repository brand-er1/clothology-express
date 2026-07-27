create table if not exists public.fabric_swatch_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null,
  requester_name text,
  fabric_feeling text not null
    check (
      fabric_feeling in (
        '부드러운 느낌',
        '탄탄한 느낌',
        '얇고 시원한 느낌',
        '두껍고 따뜻한 느낌',
        '신축성 있는 느낌',
        '잘 모르겠어요'
      )
    ),
  color_names text[] not null
    check (
      coalesce(array_length(color_names, 1), 0) between 1 and 12
    ),
  reference_image_path text,
  requested_minimum_count smallint not null default 5
    check (requested_minimum_count >= 5),
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'recommended', 'completed')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fabric_swatch_requests_user_created_idx
  on public.fabric_swatch_requests(user_id, created_at desc);

create index if not exists fabric_swatch_requests_status_created_idx
  on public.fabric_swatch_requests(status, created_at desc);

alter table public.fabric_swatch_requests enable row level security;

drop policy if exists "Users can create own fabric swatch requests"
  on public.fabric_swatch_requests;
create policy "Users can create own fabric swatch requests"
  on public.fabric_swatch_requests for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and requested_minimum_count >= 5
  );

drop policy if exists "Users can view own fabric swatch requests"
  on public.fabric_swatch_requests;
create policy "Users can view own fabric swatch requests"
  on public.fabric_swatch_requests for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists "Admins can manage fabric swatch requests"
  on public.fabric_swatch_requests;
create policy "Admins can manage fabric swatch requests"
  on public.fabric_swatch_requests for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'fabric-swatch-references',
  'fabric-swatch-references',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload own fabric swatch references"
  on storage.objects;
create policy "Users can upload own fabric swatch references"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fabric-swatch-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users and admins can view fabric swatch references"
  on storage.objects;
create policy "Users and admins can view fabric swatch references"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fabric-swatch-references'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Users can remove own fabric swatch references"
  on storage.objects;
create policy "Users can remove own fabric swatch references"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fabric-swatch-references'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
