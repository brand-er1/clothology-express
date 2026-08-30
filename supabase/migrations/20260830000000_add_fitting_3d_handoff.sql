-- 3D 가상피팅 → 제작의뢰/펀딩 handoff (BRAND-ER 3D virtual fitting upgrade). Purely additive,
-- nullable columns — no existing row/behavior changes, no RLS policy changes needed since both
-- tables' policies already gate on other columns (creator_id/user_id/status), not an explicit
-- column allow-list.

alter table public.orders
  add column if not exists fitting_state jsonb,
  add column if not exists fitting_preview_url text;

comment on column public.orders.fitting_state is
  '3D 가상피팅에서 "현재 착용 의류 전체 견적받기" → 제작의뢰로 넘어온 경우의 성별/사이즈/슬롯별 착용 의류 요약 (id/slot/label/imageUrl). request_source가 virtual_fitting_3d일 때만 채워짐. 견적 자체는 estimate_snapshot을 그대로 사용.';
comment on column public.orders.fitting_preview_url is
  '제출 시점의 3D 마네킹 스크린샷 또는 AI 피팅 실사 렌더 URL.';

alter table public.fundings
  add column if not exists fitting_state jsonb,
  add column if not exists fitting_preview_url text;

comment on column public.fundings.fitting_state is
  '3D 가상피팅 "이 디자인으로 펀딩 시작" 플로우에서 넘어온 경우의 성별/사이즈/슬롯별 착용 의류 요약.';
comment on column public.fundings.fitting_preview_url is
  '펀딩 상세페이지에 노출할 3D 마네킹 스크린샷 또는 AI 피팅 실사 렌더 URL.';
