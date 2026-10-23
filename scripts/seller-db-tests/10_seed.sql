-- 판매자 센터 · 리뷰 · 매거진 검증용 시드 (임시 DB 전용)
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000a001','super@brander.test','{"full_name":"슈퍼관리자"}'),
 ('00000000-0000-0000-0000-00000000a003','cs@brander.test','{"full_name":"CS관리자"}'),
 ('00000000-0000-0000-0000-00000000b001','buyer1@test.com','{"full_name":"김구매","account_type":"buyer"}'),
 ('00000000-0000-0000-0000-00000000b002','buyer2@test.com','{"full_name":"이구매","account_type":"buyer"}'),
 ('00000000-0000-0000-0000-00000000b003','buyer3@test.com','{"full_name":"박구매","account_type":"buyer"}'),
 ('00000000-0000-0000-0000-00000000c001','sellera@test.com','{"full_name":"판매자A","account_type":"seller"}'),
 ('00000000-0000-0000-0000-00000000c002','sellerb@test.com','{"full_name":"판매자B","account_type":"seller"}');

insert into public.admin_members (user_id, role, status, display_name) values
 ('00000000-0000-0000-0000-00000000a001','super_admin','active','슈퍼'),
 ('00000000-0000-0000-0000-00000000a003','cs_admin','active','CS');

insert into public.creator_profiles (user_id, display_name) values
 ('00000000-0000-0000-0000-00000000c001','판매자A'), ('00000000-0000-0000-0000-00000000c002','판매자B');
insert into public.brands (id, owner_user_id, creator_profile_user_id, brand_name, status) values
 ('00000000-0000-0000-0000-0000000bd001','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c001','ALPHA','active'),
 ('00000000-0000-0000-0000-0000000bd002','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-00000000c002','BRAVO','active');

insert into public.fundings (id, creator_id, brand_id, product_name, cloth_type, material, size, image_url, moq, price, funding_days, status, reviewed_at, color_options, size_options, estimate_direct_unit_max, estimate_development_total, trademark_screening_required) values
 ('00000000-0000-0000-0000-0000000f000a','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','알파 후드','hoodie','cotton','M','https://x/a.png',20,50000,30,'approved', now()-interval '5 days', array['black'], array['M','L'], 20000, 100000, false),
 ('00000000-0000-0000-0000-0000000f000b','00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-0000000bd002','브라보 셔츠','shirt','cotton','M','https://x/b.png',20,30000,30,'approved', now()-interval '5 days', array['white'], array['M'], 10000, 100000, false);

insert into public.funding_participations (id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price, status, payment_provider, payment_status, partner_order_id, payment_approved_at, payment_cancelled_at, shipping_status, orderer_name, orderer_phone, orderer_email, recipient_name, recipient_phone, postal_code, shipping_address) values
 -- 실결제 · 배송 완료
 ('00000000-0000-0000-0000-0000000e0001','00000000-0000-0000-0000-0000000f000a','00000000-0000-0000-0000-00000000b001','black','M',2,50000,'confirmed','ksnet','paid','BRANDER-A1', now()-interval '3 days', null,'delivered','김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1'),
 -- 모의결제 · 배송 완료
 ('00000000-0000-0000-0000-0000000e0002','00000000-0000-0000-0000-0000000f000a','00000000-0000-0000-0000-00000000b002','black','L',1,50000,'confirmed','mock','paid','BRANDER-A2', now()-interval '2 days', null,'delivered','이구매','010-2222-3333','b2@test.com','이구매','010-2222-3333','06000','부산 해운대구 2'),
 -- 실결제 후 환불
 ('00000000-0000-0000-0000-0000000e0003','00000000-0000-0000-0000-0000000f000a','00000000-0000-0000-0000-00000000b003','black','M',1,50000,'cancelled','ksnet','cancelled','BRANDER-A3', now()-interval '2 days', now()-interval '1 day','preparing','박구매','010-4444-5555','b3@test.com','박구매','010-4444-5555','06000','대구 중구 3'),
 -- 결제 대기
 ('00000000-0000-0000-0000-0000000e0004','00000000-0000-0000-0000-0000000f000a','00000000-0000-0000-0000-00000000b001','black','L',1,50000,'pledged','ksnet','ready','BRANDER-A4', null, null,'preparing','김구매','010-1234-5678','b1@test.com','김구매','010-1234-5678','06000','서울 강남구 1'),
 -- 판매자 B 실결제
 ('00000000-0000-0000-0000-0000000e0005','00000000-0000-0000-0000-0000000f000b','00000000-0000-0000-0000-00000000b002','white','M',3,30000,'confirmed','ksnet','paid','BRANDER-B1', now()-interval '1 day', null,'delivered','이구매','010-2222-3333','b2@test.com','이구매','010-2222-3333','06000','부산 해운대구 2');

-- 판매자 A 펀딩 정산서(미지급) — 계산은 테스트에서 다시 한다
insert into public.settlements (id, funding_id, brand_id, creator_id, commission_rate, status)
values ('00000000-0000-0000-0000-00000005e001','00000000-0000-0000-0000-0000000f000a','00000000-0000-0000-0000-0000000bd001','00000000-0000-0000-0000-00000000c001',10,'pending');

-- 비공개 문의(판매자 A 펀딩)
insert into public.funding_inquiries (id, funding_id, author_id, nickname, inquiry_type, title, content, is_private)
values ('00000000-0000-0000-0000-00000001a001','00000000-0000-0000-0000-0000000f000a','00000000-0000-0000-0000-00000000b001','김*매','size_fit','사이즈 문의','M 사이즈 어깨 너비가 궁금합니다.', true);
