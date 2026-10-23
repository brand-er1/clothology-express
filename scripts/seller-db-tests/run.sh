#!/usr/bin/env bash
# 판매자 센터 · 리뷰 확장 · 정산 · 매거진 마이그레이션 로컬 검증 (운영 DB 에는 접속하지 않는다).
#  1) 임시 Postgres 에 Supabase 스텁 + 전체 마이그레이션 적용
#  2) 2026-10-23 신규 마이그레이션을 한 번 더 적용(재실행 안전성)
#  3) 시드 → 권한 · 금액 · 마스킹 시나리오 실행
# 사용법: PGHOST=/tmp PGPORT=55432 PGUSER=postgres scripts/seller-db-tests/run.sh
set -euo pipefail
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="${SELLER_TEST_DB:-brander_seller_test}"
P=(psql -v ON_ERROR_STOP=1 -q -d "$DB")

dropdb --if-exists "$DB"; createdb "$DB"
"${P[@]}" -f "$ROOT/scripts/admin-db-tests/00_supabase_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${P[@]}" -f "$f" >/dev/null 2>/tmp/seller_mig_err || { echo "FAIL $f"; grep -v NOTICE /tmp/seller_mig_err | head; exit 1; }
done
for f in "$ROOT"/supabase/migrations/20261023*.sql; do
  "${P[@]}" -f "$f" >/dev/null 2>/tmp/seller_mig_err || { echo "REAPPLY FAIL $f"; grep -v NOTICE /tmp/seller_mig_err | head; exit 1; }
done
echo "MIGRATIONS_OK (re-run safe)"

# 테스트 헬퍼(_t, t_ok, t_fail, t_eq)는 기존 관리자 테스트 정의를 그대로 쓴다.
sed -n '1,24p' "$ROOT/scripts/admin-db-tests/20_tests.sql" | "${P[@]}" >/dev/null
"${P[@]}" -f "$HERE/10_seed.sql" >/dev/null
"${P[@]}" -f "$HERE/20_tests.sql" >/dev/null
"${P[@]}" -At -c "select 'seller_center', count(*) filter (where ok) as pass, count(*) filter (where not ok) as fail from _t"
"${P[@]}" -At -c "select 'FAIL: ' || label || ' | ' || detail from _t where not ok order by n"
fails="$("${P[@]}" -At -c "select count(*) from _t where not ok")"
[[ "$fails" == "0" ]]
