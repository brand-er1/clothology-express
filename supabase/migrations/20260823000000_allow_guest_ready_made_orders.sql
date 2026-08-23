-- The "빠른 단체복 제작" (quick group wear) flow is meant to work for visitors who are
-- not logged in — save-order was requiring an authenticated user_id for every request
-- source, so guests always hit "로그인이 필요합니다" and could never submit. This lets
-- that one request source save without a user_id, capturing name/phone instead so
-- admins can still reach the customer.
alter table public.orders alter column user_id drop not null;

alter table public.orders
  add column if not exists guest_name text,
  add column if not exists guest_phone text;

comment on column public.orders.guest_name is
  '비로그인 방문자가 접수한 제작 의뢰(예: 빠른 단체복 제작)의 담당자 이름';
comment on column public.orders.guest_phone is
  '비로그인 방문자가 접수한 제작 의뢰(예: 빠른 단체복 제작)의 연락처';
