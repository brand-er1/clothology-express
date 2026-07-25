create table if not exists public.quote_accessory_prices (
  accessory_key text primary key,
  accessory_label text not null,
  aliases text[] not null default '{}',
  unit_price integer not null check (unit_price >= 0),
  pricing_note text,
  source_label text not null default '브랜더 운영 단가',
  source_version text not null default '2026-07-25',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quote_accessory_prices enable row level security;

drop policy if exists "Authenticated users can read accessory quote prices"
  on public.quote_accessory_prices;
create policy "Authenticated users can read accessory quote prices"
  on public.quote_accessory_prices
  for select
  to authenticated
  using (active);

comment on table public.quote_accessory_prices is
  'AI 이미지 분석으로 판별한 의류 부자재의 개당 장당 추가 공임';

insert into public.quote_accessory_prices (
  accessory_key,
  accessory_label,
  aliases,
  unit_price,
  pricing_note
)
values
  (
    'stud',
    '징',
    array['징', '스터드', 'stud', 'spike'],
    500,
    '이미지에서 확인된 징 1개당 장당 500원이 추가됩니다.'
  ),
  (
    'zipper',
    '지퍼',
    array['지퍼', 'zipper', 'zip'],
    2000,
    '완성된 지퍼 한 세트를 1개로 계산하며 장당 2,000원이 추가됩니다.'
  ),
  (
    'button',
    '단추',
    array['단추', '버튼', 'button'],
    500,
    '일반 단추 1개당 장당 500원이 추가됩니다.'
  ),
  (
    'rivet',
    '리벳',
    array['리벳', 'rivet', '데님 리벳'],
    500,
    '청바지 등에서 확인된 리벳 1개당 장당 500원이 추가됩니다.'
  ),
  (
    'hood_cord',
    '후드티 끈',
    array['후드 끈', '후드티 끈', 'hood cord', 'hood drawcord'],
    1000,
    '후드 끈 한 세트를 1개로 계산하며 장당 1,000원이 추가됩니다.'
  ),
  (
    'snap_button',
    '똑딱이',
    array['똑딱이', '스냅', '스냅 단추', 'snap button'],
    500,
    '똑딱이 1개당 장당 500원이 추가됩니다.'
  ),
  (
    'buckle',
    '버클',
    array['버클', 'buckle'],
    2000,
    '버클 1개당 장당 2,000원이 추가됩니다.'
  ),
  (
    'drawstring',
    '스트링',
    array['스트링', '조임끈', '허리끈', 'drawstring', 'drawcord'],
    1000,
    '후드 외 허리·밑단 스트링 한 세트를 1개로 계산하며 장당 1,000원이 추가됩니다.'
  )
on conflict (accessory_key) do update
set
  accessory_label = excluded.accessory_label,
  aliases = excluded.aliases,
  unit_price = excluded.unit_price,
  pricing_note = excluded.pricing_note,
  source_label = excluded.source_label,
  source_version = excluded.source_version,
  active = true,
  updated_at = now();
