-- 매거진 기사 공개 범위 · 관리자 권한 테스트
-- (로컬 Postgres + scripts/admin-db-tests/00_supabase_stub.sql + 전체 migration 적용 후 실행)
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/magazine_articles.test.sql
-- 성공하면 마지막에 'ALL MAGAZINE TESTS PASSED' 가 출력된다. 전체를 롤백하므로 데이터가 남지 않는다.

begin;

set local session_replication_role = replica;

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-0000000000c1', 'customer@test.local'),
  ('30000000-0000-0000-0000-0000000000ad', 'super@test.local'),
  ('30000000-0000-0000-0000-0000000000c5', 'cs@test.local'),
  ('30000000-0000-0000-0000-0000000000a0', 'ops@test.local');

insert into public.profiles (id, username, full_name) values
  ('30000000-0000-0000-0000-0000000000c1', 'reader', '독자'),
  ('30000000-0000-0000-0000-0000000000ad', 'super', '슈퍼관리자'),
  ('30000000-0000-0000-0000-0000000000c5', 'cs', '상담원'),
  ('30000000-0000-0000-0000-0000000000a0', 'ops', '운영자')
on conflict (id) do update set username = excluded.username, full_name = excluded.full_name;

insert into public.admin_members (user_id, role, status) values
  ('30000000-0000-0000-0000-0000000000ad', 'super_admin', 'active'),
  ('30000000-0000-0000-0000-0000000000c5', 'cs_admin', 'active'),
  ('30000000-0000-0000-0000-0000000000a0', 'operations_admin', 'active');

set local session_replication_role = origin;

grant usage on schema public to authenticated, anon;

create or replace function pg_temp.expect_denied(p_sql text, p_label text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL [%]: 권한 없는 호출이 성공했습니다', p_label;
exception
  when insufficient_privilege then null;
end;
$$;

create or replace function pg_temp.expect_error(p_sql text, p_like text, p_label text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL [%]: 실패해야 하는 호출이 성공했습니다', p_label;
exception
  when others then
    if sqlerrm like 'FAIL [%' then raise; end if;
    if sqlerrm not like p_like then raise exception 'FAIL [%]: 예상과 다른 오류 %', p_label, sqlerrm; end if;
end;
$$;

create or replace function pg_temp.assert(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAIL [%]', p_label; end if;
end;
$$;

create or replace function pg_temp.as_user(p_user text)
returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user, ''), true);
$$;

grant execute on function pg_temp.expect_denied(text, text) to authenticated, anon;
grant execute on function pg_temp.expect_error(text, text, text) to authenticated, anon;
grant execute on function pg_temp.assert(boolean, text) to authenticated, anon;
grant execute on function pg_temp.as_user(text) to authenticated, anon;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated, anon;

-- =========================================================================
-- 1. 기존 기사 시드 유지
-- =========================================================================

select pg_temp.assert((select count(*) from public.magazine_articles where is_published) >= 4, '1. legacy articles seeded and published');

-- =========================================================================
-- 2. 운영 관리자: 등록 · 수정 · 공개 전환
-- =========================================================================

set local role authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-0000000000a0');

insert into ids values ('draft', (public.admin_save_magazine_article(null, jsonb_build_object(
  'slug', '2026-10-20-test-press', 'title', '테스트 보도', 'publisher', '테스트신문', 'published_at', '2026-10-20',
  'summary', '요약', 'key_points', jsonb_build_array('첫째', '  ', '둘째'), 'external_url', 'https://example.com/a',
  'is_published', false
))->>'id')::uuid);

select pg_temp.assert((select jsonb_array_length(r->'key_points') = 2
                       from jsonb_array_elements(public.admin_list_magazine_articles('draft', null)->'rows') r
                       where r->>'slug' = '2026-10-20-test-press'),
  '2. blank key points dropped');
select pg_temp.assert(public.can_manage_magazine(), '2. ops can manage magazine images');

select pg_temp.expect_error($q$select public.admin_save_magazine_article(null, '{"slug":"2026-10-20-test-press","title":"중복","publisher":"x","published_at":"2026-10-20"}')$q$,
  '%이미 사용 중인%', '2. duplicate slug rejected');
select pg_temp.expect_error($q$select public.admin_save_magazine_article(null, '{"slug":"Bad Slug","title":"x","publisher":"x","published_at":"2026-10-20"}')$q$,
  '%slug%', '2. invalid slug rejected');
select pg_temp.expect_error($q$select public.admin_save_magazine_article(null, '{"slug":"no-date","title":"x","publisher":"x"}')$q$,
  '%발행일%', '2. published_at required');
select pg_temp.expect_error($q$select public.admin_save_magazine_article(null, '{"slug":"bad-url","title":"x","publisher":"x","published_at":"2026-10-20","external_url":"javascript:alert(1)"}')$q$,
  '%external_url_check%', '2. non-http url rejected');

select public.admin_save_magazine_article((select v from ids where k = 'draft'), jsonb_build_object(
  'slug', '2026-10-20-test-press', 'title', '테스트 보도(수정)', 'publisher', '테스트신문', 'published_at', '2026-10-19',
  'summary', '수정 요약', 'key_points', '[]'::jsonb, 'brand_highlight', 'BRAND-ER 핵심'
));
select pg_temp.assert((select r->>'title' = '테스트 보도(수정)' and r->>'published_at' = '2026-10-19' and not (r->>'is_published')::boolean
                       from jsonb_array_elements(public.admin_list_magazine_articles('all', null)->'rows') r
                       where r->>'slug' = '2026-10-20-test-press'),
  '2. update keeps draft status when is_published omitted');

select pg_temp.assert((select (admin_list_magazine_articles('draft', null)->'counts'->>'draft')::int >= 1), '2. admin list sees drafts');
select pg_temp.assert((select (admin_list_magazine_articles('all', null)->'rows'->0->>'slug') = '2026-10-20-test-press'), '2. admin list newest first');

-- =========================================================================
-- 3. 비공개 기사는 공개 조회에서 숨김
-- =========================================================================

reset role;
set local role anon;
select pg_temp.as_user(null);
select pg_temp.assert(not exists (select 1 from public.magazine_articles where slug = '2026-10-20-test-press'), '3. anon cannot see draft');
select pg_temp.assert(exists (select 1 from public.magazine_articles where slug = '2026-06-06-newsfinder-founder-story'), '3. anon sees published');
select pg_temp.expect_denied($q$insert into public.magazine_articles (slug, title, publisher, published_at) values ('anon-x', 'x', 'x', '2026-10-20')$q$, '3. anon direct insert blocked');
select pg_temp.expect_denied($q$select public.admin_list_magazine_articles('all', null)$q$, '3. anon cannot call admin list');

reset role;
set local role authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-0000000000a0');
select public.admin_set_magazine_article_published((select v from ids where k = 'draft'), true);

reset role;
set local role anon;
select pg_temp.as_user(null);
select pg_temp.assert(exists (select 1 from public.magazine_articles where slug = '2026-10-20-test-press'), '3. published article visible');

-- =========================================================================
-- 4. 일반 회원 · CS 관리자는 수정 불가
-- =========================================================================

reset role;
set local role authenticated;
select pg_temp.as_user('30000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_denied($q$select public.admin_save_magazine_article(null, '{"slug":"member-x","title":"x","publisher":"x","published_at":"2026-10-20"}')$q$, '4. member cannot create');
select pg_temp.expect_denied($q$update public.magazine_articles set title = '변조'$q$, '4. member direct update blocked');
select pg_temp.expect_denied($q$delete from public.magazine_articles$q$, '4. member direct delete blocked');
select pg_temp.expect_denied($q$select public.admin_list_magazine_articles('all', null)$q$, '4. member cannot call admin list');
select pg_temp.assert(not public.can_manage_magazine(), '4. member cannot manage images');

select pg_temp.as_user('30000000-0000-0000-0000-0000000000c5');
select pg_temp.assert((select (admin_list_magazine_articles('all', null)->>'can_manage')::boolean = false), '4. cs sees list read-only');
select pg_temp.expect_denied($q$select public.admin_set_magazine_article_published((select v from ids where k = 'draft'), false)$q$, '4. cs cannot unpublish');
select pg_temp.expect_denied($q$select public.admin_delete_magazine_article((select v from ids where k = 'draft'), 'x')$q$, '4. cs cannot delete');
select pg_temp.assert(not public.can_manage_magazine(), '4. cs cannot manage images');

-- =========================================================================
-- 5. 삭제 + Audit Log
-- =========================================================================

select pg_temp.as_user('30000000-0000-0000-0000-0000000000ad');
select public.admin_delete_magazine_article((select v from ids where k = 'draft'), '테스트 정리');

reset role;
select pg_temp.assert(not exists (select 1 from public.magazine_articles where slug = '2026-10-20-test-press'), '5. deleted');
select pg_temp.assert((select array_agg(action order by created_at, action) @> array['magazine.create', 'magazine.update', 'magazine.publish', 'magazine.delete']
                       from public.admin_audit_logs where target_type = 'magazine_article'), '5. all changes audited');

select 'ALL MAGAZINE TESTS PASSED';
rollback;
