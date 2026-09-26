#!/usr/bin/env bash
# 관리자 마이그레이션 로컬 검증 (운영 DB 에는 절대 접속하지 않는다).
#  1) 임시 Postgres 에 Supabase 스텁 + 기존 마이그레이션 적용
#  2) 운영과 유사한 레거시 데이터 시드 → 스냅샷
#  3) 20260926* 관리자 마이그레이션 적용(2회: 재실행 안전성 확인) → 스냅샷 비교
#  4) RBAC 시나리오(20_tests.sql) / 전체 운영 플로우(30_flow.sql) 실행
# 사용법: PGHOST=/tmp PGPORT=55432 PGUSER=postgres scripts/admin-db-tests/run.sh
set -euo pipefail
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="${ADMIN_TEST_DB:-brander_admin_test}"
P=(psql -v ON_ERROR_STOP=1 -q -d "$DB")

dropdb --if-exists "$DB"; createdb "$DB"
"${P[@]}" -f "$HERE/00_supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  case "$(basename "$f")" in 20260926*) continue;; esac
  "${P[@]}" -f "$f" >/dev/null
done
"${P[@]}" -f "$HERE/10_seed_legacy.sql" >/dev/null
"${P[@]}" -At -f "$HERE/snapshot.sql" > /tmp/admin_before.txt
for pass in 1 2; do
  for f in "$ROOT"/supabase/migrations/20260926*.sql; do "${P[@]}" -f "$f" >/dev/null 2>&1 || { echo "FAIL $f (pass $pass)"; exit 1; }; done
done
"${P[@]}" -At -f "$HERE/snapshot.sql" > /tmp/admin_after.txt
diff /tmp/admin_before.txt /tmp/admin_after.txt && echo "LEGACY_DATA_PRESERVED"

for suite in 20_tests 30_flow; do
  "${P[@]}" -f "$HERE/$suite.sql" >/dev/null 2>&1
  "${P[@]}" -At -c "select '$suite', count(*) filter (where ok) as pass, count(*) filter (where not ok) as fail from _t"
  "${P[@]}" -At -c "select 'FAIL: ' || label || ' | ' || detail from _t where not ok"
done
