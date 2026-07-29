alter table public.orders
  add column if not exists request_source text not null default 'ai_design',
  add column if not exists request_title text,
  add column if not exists requested_quantity integer,
  add column if not exists estimate_snapshot jsonb;

comment on column public.orders.request_source is
  '제작 의뢰 유입 경로: ai_design 또는 design_upload';
comment on column public.orders.request_title is
  '관리자 목록에 표시할 제작 의뢰 제목';
comment on column public.orders.requested_quantity is
  '고객이 견적 또는 제작 의뢰 시 선택한 총 제작 수량';
comment on column public.orders.estimate_snapshot is
  '접수 시점의 AI 자동견적 및 분석 결과 스냅샷';

create index if not exists orders_request_source_created_at_idx
  on public.orders (request_source, created_at desc);
