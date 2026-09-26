-- Legacy production-like data created BEFORE the admin migrations.
insert into auth.users (id, email, raw_user_meta_data, created_at, last_sign_in_at) values
 ('00000000-0000-0000-0000-00000000a001','super@brander.test','{"full_name":"슈퍼관리자"}', now()-interval '90 days', now()),
 ('00000000-0000-0000-0000-00000000a002','ops@brander.test','{"full_name":"운영관리자"}', now()-interval '60 days', now()),
 ('00000000-0000-0000-0000-00000000a003','cs@brander.test','{"full_name":"CS관리자"}', now()-interval '60 days', now()),
 ('00000000-0000-0000-0000-00000000b001','buyer1@test.com','{"full_name":"김구매","account_type":"buyer"}', now()-interval '20 days', now()),
 ('00000000-0000-0000-0000-00000000b002','buyer2@test.com','{"full_name":"이구매","account_type":"buyer"}', now()-interval '3 days', now()),
 ('00000000-0000-0000-0000-00000000c001','creator@test.com','{"full_name":"박제작","account_type":"seller"}', now()-interval '40 days', now());
update public.profiles set phone_number='010-1234-5678', address='서울특별시 강남구 테헤란로 1' where id='00000000-0000-0000-0000-00000000b001';
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000a001','admin');

insert into public.creator_profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000c001','박제작');
insert into public.brands (id, owner_user_id, creator_profile_user_id, brand_name, status)
values ('00000000-0000-0000-0000-0000000bd001','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c001','FENRAX','active');

insert into public.fundings (id, creator_id, brand_id, product_name, cloth_type, material, size, image_url, moq, price, funding_days, status, reviewed_at, color_options, size_options, estimate_direct_unit_max, estimate_development_total, trademark_screening_required)
values ('00000000-0000-0000-0000-0000000f0001','00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-0000000bd001','레거시 후드티','hoodie','cotton','M','https://x/img.png',20,50000,30,'approved', now()-interval '5 days', array['black'], array['M','L'], 20000, 100000, false);

insert into public.funding_participations (id, funding_id, participant_id, selected_color, selected_size, quantity, unit_price, status, payment_provider, payment_status, partner_order_id, payment_approved_at, orderer_name, orderer_phone, recipient_name, recipient_phone, postal_code, shipping_address)
values
 ('00000000-0000-0000-0000-0000000e0001','00000000-0000-0000-0000-0000000f0001','00000000-0000-0000-0000-00000000b001','black','M',2,50000,'pledged','mock','paid','BRANDER-LEGACY1', now()-interval '4 days','김구매','010-1234-5678','김구매','010-1234-5678','06000','서울특별시 강남구 테헤란로 1'),
 ('00000000-0000-0000-0000-0000000e0002','00000000-0000-0000-0000-0000000f0001','00000000-0000-0000-0000-00000000b002','black','L',1,50000,'cancelled','mock','cancelled','BRANDER-LEGACY2', now()-interval '3 days','이구매','010-9999-0000','이구매','010-9999-0000','06000','부산광역시 해운대구 1');
update public.fundings set current_orders = 2 where id='00000000-0000-0000-0000-0000000f0001';

insert into public.community_posts (id, user_id, title) values ('00000000-0000-0000-0000-0000000c0001','00000000-0000-0000-0000-00000000b001','내 디자인');
insert into public.community_comments (id, post_id, user_id, content) values ('00000000-0000-0000-0000-0000000cc001','00000000-0000-0000-0000-0000000c0001','00000000-0000-0000-0000-00000000b002','욕설 댓글');
insert into public.community_reports (reporter_id, target_type, target_id, reason) values ('00000000-0000-0000-0000-00000000b001','comment','00000000-0000-0000-0000-0000000cc001','욕설');
insert into public.community_follows (follower_id, following_id) values ('00000000-0000-0000-0000-00000000b001','00000000-0000-0000-0000-00000000c001');
insert into public.site_visit_sessions (session_id, visitor_id, user_id) values (gen_random_uuid(), gen_random_uuid(), '00000000-0000-0000-0000-00000000b001'), (gen_random_uuid(), gen_random_uuid(), null);
