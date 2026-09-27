-- AI 상세페이지 에디토리얼 엔진 (비파괴적)
--
-- 상품 분석 → 콘셉트 추천 → 아트 디렉션 → 추가 이미지 생성 흐름을 위한 최소 확장.
-- 기존 테이블/행/정책/함수는 그대로 두고 CHECK 제약만 상위 집합으로 넓힌다.
--
--  * 콘셉트(스타일) 추가: editorial, outdoor
--  * 상세페이지 이미지 유형 추가: 프린트/자수/넥라인/소매·밑단/봉제 디테일, 접힌 제품, 마네킹, 와이드 텍스처
--
-- 상품 분석 결과, 추천 콘셉트, 페이지 아트 디렉션은 기존 product_detail_pages.generation(jsonb)에,
-- 섹션별 레이아웃 변형(variant)·동영상 URL은 기존 detail_page_sections.content(jsonb)에 저장되므로
-- 새 컬럼이 필요 없고 save / publish / version / restore RPC 도 그대로 동작한다.
-- 펀딩 · 참여 · 주문 · 결제 · 회원 · 브랜드 데이터는 읽지도 바꾸지도 않는다.

alter table public.product_detail_pages
  drop constraint if exists product_detail_pages_template_check,
  add constraint product_detail_pages_template_check
    check (template in (
      'minimal', 'street', 'luxury', 'sports', 'casual', 'vintage', 'y2k', 'emotional', 'lookbook',
      'editorial', 'outdoor'
    ));

alter table public.generated_assets
  drop constraint if exists generated_assets_image_type_check,
  add constraint generated_assets_image_type_check
    check (image_type in (
      'hero', 'product_front', 'product_back', 'detail', 'editorial', 'lifestyle', 'fabric', 'mood', 'flat_lay',
      'detail_print', 'detail_embroidery', 'detail_neck', 'detail_cuff', 'detail_stitch',
      'folded', 'mannequin', 'texture_wide'
    ));

comment on column public.product_detail_pages.generation is
  'AI 생성 메타: provider/generatedAt/fallbackReason + analysis(상품 분석) + concepts(추천 콘셉트) + conceptId + direction(페이지 아트 디렉션).';

notify pgrst, 'reload schema';
