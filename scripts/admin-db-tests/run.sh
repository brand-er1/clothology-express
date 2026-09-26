#!/usr/bin/env bash
# 관리자 마이그레이션 로컬 검증 (운영 DB 에는 절대 접속하지 않는다).
#  1) 임시 Postgres 에 Supabase 스텁 + 기존 마이그레이션 적용
#  2) 운영과 유사한 레거시 데이터 시드 → 스냅샷
#  3) 20260926* 관리자 마이그레이션 적용(2회: 재실행 안전성 확인) → 스냅샷 비교
#  4) RBAC 시나리오(20_tests.sql) / 전체 운영 플로우(30_flow.sql) / 상세페이지(40) / 펀딩 성공 알림(50) 실행
#  5) 동시 결제·동시 디스패처 경합 테스트(55_concurrency.sh)
# 사용법: PGHOST=/tmp PGPORT=55432 PGUSER=postgres scripts/admin-db-tests/run.sh
set -euo pipefail
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="${ADMIN_TEST_DB:-brander_admin_test}"
# 검증 대상(신규) 마이그레이션. 나머지는 "운영에 이미 적용된 상태"로 간주해 먼저 적용한다.
NEW_MIGRATIONS=(20260926000000 20260926010000 20260926020000 20260927000000 20260928000000 20260929000000 20260930000000)
is_new() { local base; base="$(basename "$1")"; for v in "${NEW_MIGRATIONS[@]}"; do [[ "$base" == "$v"* ]] && return 0; done; return 1; }
P=(psql -v ON_ERROR_STOP=1 -q -d "$DB")

dropdb --if-exists "$DB"; createdb "$DB"
"${P[@]}" -f "$HERE/00_supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  is_new "$f" && continue
  "${P[@]}" -f "$f" >/dev/null
done
"${P[@]}" -f "$HERE/10_seed_legacy.sql" >/dev/null
"${P[@]}" -At -f "$HERE/snapshot.sql" > /tmp/admin_before.txt
for pass in 1 2; do
  for f in "$ROOT"/supabase/migrations/*.sql; do
    is_new "$f" || continue
    "${P[@]}" -f "$f" >/dev/null 2>/tmp/admin_mig_err || { echo "FAIL $f (pass $pass)"; grep -v NOTICE /tmp/admin_mig_err | head; exit 1; }
  done
done
"${P[@]}" -At -f "$HERE/snapshot.sql" > /tmp/admin_after.txt
diff /tmp/admin_before.txt /tmp/admin_after.txt && echo "LEGACY_DATA_PRESERVED"

for suite in 20_tests 30_flow 40_detail_pages 50_funding_success; do
  "${P[@]}" -f "$HERE/$suite.sql" >/dev/null 2>&1
  "${P[@]}" -At -c "select '$suite', count(*) filter (where ok) as pass, count(*) filter (where not ok) as fail from _t"
  "${P[@]}" -At -c "select 'FAIL: ' || label || ' | ' || detail from _t where not ok"
done

"$HERE/55_concurrency.sh"
"${P[@]}" -At -c "select '55_concurrency', count(*) filter (where ok) as pass, count(*) filter (where not ok) as fail from _t"
"${P[@]}" -At -c "select 'FAIL: ' || label || ' | ' || detail from _t where not ok"

"${P[@]}" -f "$HERE/60_funding_colors.sql" >/dev/null 2>&1
"${P[@]}" -At -c "select '60_funding_colors', count(*) filter (where ok) as pass, count(*) filter (where not ok) as fail from _t"
"${P[@]}" -At -c "select 'FAIL: ' || label || ' | ' || detail from _t where not ok"

"${P[@]}" -f "$HERE/70_order_export.sql" >/dev/null 2>&1
"${P[@]}" -At -c "select '70_order_export', count(*) filter (where ok) as pass, count(*) filter (where not ok) as fail from _t"
"${P[@]}" -At -c "select 'FAIL: ' || label || ' | ' || detail from _t where not ok"
