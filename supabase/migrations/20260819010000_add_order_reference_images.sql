alter table public.orders
  add column if not exists reference_image_paths jsonb;

comment on column public.orders.reference_image_paths is
  '고객이 자동견적 시 업로드한 전체 참고 이미지의 storage 경로 배열 (정면·후면·디테일 등, 최대 10장). image_path/generated_image_url은 이 중 대표(첫 번째) 이미지를 계속 가리킵니다.';
