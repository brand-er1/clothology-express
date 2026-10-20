-- ⚠️ 로컬 전용. KSNET 결제 시연용 데이터.
--
-- 먼저 테스트 계정 두 개를 만든다 (docs/KSNET_PAYMENT.md "로컬 테스트" 3단계):
--   seller@test.local / test1234!  (판매자)
--   buyer@test.local  / test1234!  (구매자)
-- 그 다음 이 파일을 실행한다:
--   docker exec -i supabase_db_jwmzjszdjlrqrhadbggr psql -U postgres < docs/local-dev/seed_ksnet_demo.sql

-- 결제 화면 위에 '프로필 정보 완성하기' 팝업이 뜨지 않도록 필수 프로필을 채운다.
update public.profiles
set phone_number = '010-1234-5678', address = '서울시 강남구 테헤란로 1', height = 175, weight = 70
where id in (select id from auth.users where email in ('seller@test.local', 'buyer@test.local'));

-- 펀딩은 제작자 프로필과 브랜드가 있어야 만들 수 있다 (enforce_funding_brand_ownership).
insert into public.creator_profiles (user_id, display_name)
select id, '테스트판매자' from auth.users where email = 'seller@test.local'
on conflict do nothing;

with seller as (
  select id from auth.users where email = 'seller@test.local'
), brand as (
  insert into public.brands (owner_user_id, creator_profile_user_id, brand_name)
  select id, id, '테스트브랜드' from seller
  returning id, owner_user_id
)
-- 1,000원 = KSPay 최소 결제금액. 심사를 건너뛰고 바로 승인 상태로 넣는다.
insert into public.fundings (
  creator_id, brand_id, product_name, cloth_type, material, size, image_url,
  moq, price, status, reviewed_at, color_options, size_options, description, trademark_screening_required
)
select
  brand.owner_user_id, brand.id, '[테스트] KSNET 결제 테스트 반팔티', '반팔 티셔츠', '면 100%', 'M',
  'http://localhost:8080/brand-er-hero-editorial-v2.webp',
  20, 1000, 'approved', now(), array['블랙', '화이트'], array['M', 'L'],
  'KSNET 테스트 결제용 펀딩입니다. 1,000원(KSPay 최소 결제금액).', false
from brand
returning id as funding_id, product_name, price;
