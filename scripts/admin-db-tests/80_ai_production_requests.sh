#!/usr/bin/env bash
# AI 이미지 제작의뢰(20261127000000) 로컬 검증. 운영 DB 에는 접속하지 않는다.
#  1) 임시 DB 에 Supabase 스텁 + 기존 마이그레이션 적용
#  2) 기존 회원 · 제작의뢰(orders) 시드 → 스냅샷
#  3) 신규 마이그레이션 2회 적용(재실행 안전성) → 기존 orders · profiles 가 그대로인지 비교
#  4) 접수 · 검증 · 중복 방지 · 관리자 목록/상세/상태/메모/미확인 배지 · 권한 시나리오(80_ai_production_requests.sql)
# 사용법: PGHOST=/tmp PGPORT=55432 PGUSER=postgres scripts/admin-db-tests/80_ai_production_requests.sh
set -euo pipefail
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="${AI_REQUEST_TEST_DB:-brander_ai_request_test}"
NEW=20261127000000
P=(psql -v ON_ERROR_STOP=1 -q -d "$DB")

dropdb --if-exists "$DB" 2>/dev/null; createdb "$DB"
"${P[@]}" -f "$HERE/00_supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  [[ "$(basename "$f")" == "$NEW"* ]] && continue
  "${P[@]}" -f "$f" >/dev/null
done

"${P[@]}" >/dev/null <<'SQL'
set session_replication_role = replica;
insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-0000000000c1', 'member@test.local'),
  ('80000000-0000-0000-0000-0000000000ad', 'super@test.local'),
  ('80000000-0000-0000-0000-0000000000a0', 'ops@test.local'),
  ('80000000-0000-0000-0000-0000000000c5', 'cs@test.local');
insert into public.profiles (id, username, full_name, phone_number, account_type) values
  ('80000000-0000-0000-0000-0000000000c1', 'hoodie_fan', '김회원', '010-3333-0000', 'buyer'),
  ('80000000-0000-0000-0000-0000000000ad', 'super', '슈퍼관리자', null, 'seller'),
  ('80000000-0000-0000-0000-0000000000a0', 'ops', '운영자', null, 'seller'),
  ('80000000-0000-0000-0000-0000000000c5', 'cs', '상담원', null, 'seller')
on conflict (id) do update set username = excluded.username, full_name = excluded.full_name, phone_number = excluded.phone_number, account_type = excluded.account_type;
insert into public.admin_members (user_id, role, status, display_name) values
  ('80000000-0000-0000-0000-0000000000ad', 'super_admin', 'active', '슈퍼'),
  ('80000000-0000-0000-0000-0000000000a0', 'operations_admin', 'active', '운영'),
  ('80000000-0000-0000-0000-0000000000c5', 'cs_admin', 'active', '상담');
-- 기존 제작의뢰 3건(검토 대기 · 승인 · 반려) + 초안 1건
insert into public.orders (id, user_id, cloth_type, material, detail_description, generated_image_url, image_path, status, request_source, request_title, admin_comment, created_at) values
  ('80000000-0000-0000-0000-00000000e001', '80000000-0000-0000-0000-0000000000c1', '후드티', '면', '기존 의뢰', 'https://x/legacy1.png', 'legacy1.png', 'pending', 'ai_design', '후드티 AI 디자인 제작 의뢰', null, now() - interval '3 day'),
  ('80000000-0000-0000-0000-00000000e002', '80000000-0000-0000-0000-0000000000c1', '셔츠', '면', '기존 의뢰', 'https://x/legacy2.png', 'legacy2.png', 'approved', 'design_upload', '셔츠', '상담 진행', now() - interval '2 day'),
  ('80000000-0000-0000-0000-00000000e003', null, '티셔츠', '면', '기존 단체복', null, null, 'rejected', 'ready_made_group_wear', '단체복', '수량 부족', now() - interval '1 day'),
  ('80000000-0000-0000-0000-00000000e004', '80000000-0000-0000-0000-0000000000c1', '자켓', '울', '초안', null, null, 'draft', 'ai_design', null, null, now());
SQL

snapshot() { "${P[@]}" -At -c "select md5(string_agg(to_jsonb(o)::text, '|' order by id)) from public.orders o" -c "select md5(string_agg(to_jsonb(p)::text, '|' order by id)) from public.profiles p"; }
snapshot > /tmp/ai_request_before.txt
for pass in 1 2; do
  "${P[@]}" -f "$ROOT"/supabase/migrations/"$NEW"_*.sql >/dev/null 2>/tmp/ai_request_mig_err || { echo "FAIL migration (pass $pass)"; grep -v NOTICE /tmp/ai_request_mig_err | head; exit 1; }
done
snapshot > /tmp/ai_request_after.txt
diff /tmp/ai_request_before.txt /tmp/ai_request_after.txt && echo "LEGACY_ORDERS_AND_MEMBERS_PRESERVED"

"${P[@]}" -f "$HERE/80_ai_production_requests.sql" >/dev/null
"${P[@]}" -At -c "select '80_ai_production_requests', count(*) filter (where ok) as pass, count(*) filter (where not ok) as fail from _t"
"${P[@]}" -At -c "select 'FAIL: ' || label || ' | ' || detail from _t where not ok"
fails=$("${P[@]}" -At -c "select count(*) from _t where not ok")
[[ "$fails" == "0" ]]
