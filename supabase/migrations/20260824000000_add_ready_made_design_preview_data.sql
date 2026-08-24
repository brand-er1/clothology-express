-- The admin "제작 의뢰 상세" view only ever showed the customer's raw uploaded artwork file —
-- never the actual garment + placement they configured in the "빠른 단체복 제작" editor (which
-- product/color, front vs back, where on the garment, how big). Production staff had no way to
-- see what was actually being requested without guessing from the free-text detail_description.
--
-- This adds:
--   - front_preview_url / back_preview_url: a client-captured PNG of the exact editor canvas at
--     submission time (WYSIWYG — a capture of the same DOM the customer saw and interacted with,
--     never recomputed server-side, so the position can't drift from what they actually placed).
--   - ready_made_design_data: the structured design snapshot behind that preview (product,
--     color, garment base images, per-size quantities, and each print job's placement as a
--     0-1 normalized coordinate measured from the same DOM) so the layout survives even without
--     the preview image and can be re-rendered later.
alter table public.orders
  add column if not exists front_preview_url text,
  add column if not exists back_preview_url text,
  add column if not exists ready_made_design_data jsonb;

comment on column public.orders.front_preview_url is
  '빠른 단체복 제작 의뢰 제출 시점에 캡처한 앞면 최종 시안 이미지 URL (order-previews/{id}/front.png). 앞면에 배치된 디자인이 없으면 null.';
comment on column public.orders.back_preview_url is
  '빠른 단체복 제작 의뢰 제출 시점에 캡처한 뒷면 최종 시안 이미지 URL (order-previews/{id}/back.png). 뒷면에 배치된 디자인이 없으면 null.';
comment on column public.orders.ready_made_design_data is
  '빠른 단체복 제작 의뢰의 구조화된 디자인 데이터(상품, 색상, 사이즈별 수량, 면별 배치 좌표 등 — 0~1 정규화 좌표). 프리뷰 이미지와 별개로 좌표를 보존해 관리자 화면에서 재현/재검토할 수 있게 한다.';
