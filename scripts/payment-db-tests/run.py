#!/usr/bin/env python3
"""Test payment RPCs in a disposable database on a LOCAL Supabase container.

Copies schema and migration names only; never resets or writes to the source database.
"""
import argparse
import concurrent.futures
import json
from pathlib import Path
import subprocess
import uuid

parser = argparse.ArgumentParser()
parser.add_argument('--container', required=True, help='Local supabase_db_* Docker container')
args = parser.parse_args()
if not args.container.startswith('supabase_db_'):
    parser.error('Only a local supabase_db_* container is supported')
root = Path(__file__).resolve().parents[2]
database = 'ksnet_test_' + uuid.uuid4().hex[:12]
docker = ['docker', 'exec', '-i', args.container]


def command(argv, data=None):
    result = subprocess.run(docker + argv, input=data, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-5000:])
    return result.stdout


def sql(statement, user='postgres'):
    return command(['psql', '-X', '-U', user, '-d', database, '-At', '-v', 'ON_ERROR_STOP=1'], statement)


try:
    migrations = sorted((root / 'supabase/migrations').glob('*.sql'))
    versions = [path.name.split('_', 1)[0] for path in migrations]
    if len(versions) != len(set(versions)):
        raise RuntimeError('Duplicate migration versions would prevent deployment')
    applied = set(command([
        'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1',
        '-c', "select version || '_' || name from supabase_migrations.schema_migrations"
    ]).splitlines())
    schema = command(['pg_dump', '-U', 'postgres', '-d', 'postgres', '--schema-only'])
    command(['createdb', '-U', 'postgres', database])
    sql(schema, user='supabase_admin')
    # Bring an older local schema up to date inside the disposable DB only.
    # Match both version and name: a pre-release KSNET migration was renumbered
    # when main added a different migration under its original version.
    hardening = '20261019000000_harden_ksnet_payments'
    for migration in migrations:
        if migration.stem != hardening and migration.stem not in applied:
            sql(migration.read_text())
            print('Applied in disposable database: ' + migration.name, flush=True)
    # Permit repeated tests even if the source local DB already has this migration.
    sql('''
      drop trigger if exists guard_ksnet_operation on public.funding_participations;
      drop table if exists public.ksnet_payment_operations cascade;
      drop function if exists public.claim_ksnet_operation(uuid,text,text,uuid,text,text);
      drop function if exists public.cancel_unapproved_ksnet_payment(uuid);
      drop function if exists public.record_ksnet_approval(uuid,text,jsonb);
      drop function if exists public.finish_ksnet_operation(uuid,text,jsonb);
      drop function if exists public.get_ksnet_operation(uuid);
      drop function if exists public.guard_ksnet_operation();
    ''')
    sql((root / 'supabase/migrations' / (hardening + '.sql')).read_text())
    output = sql((Path(__file__).parent / 'checks.sql').read_text())
    print('\n'.join(line for line in output.splitlines() if line.startswith('PASS')))

    claim_query = '''begin;
      select public.claim_ksnet_operation('00000000-0000-4000-8000-000000000099', 'confirm', 'parallel-' || pg_backend_pid());
      select pg_sleep(0.2);
      commit;'''
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: sql(claim_query), range(2)))
    claims = [json.loads(line) for result in results for line in result.splitlines() if line.startswith('{')]
    assert sum(c['claimed'] for c in claims) == 1, claims
    print('PASS real concurrent PostgreSQL sessions: exactly one approval claim')
    # A cancellation started after the claim must not mutate the ready row.
    sql("select public.cancel_unapproved_ksnet_payment('00000000-0000-4000-8000-000000000099');")
    assert sql("select payment_status from public.funding_participations where id='00000000-0000-4000-8000-000000000099';").strip() == 'ready'
    print('PASS concurrent claim prevents browser cancellation')
finally:
    command(['dropdb', '-U', 'postgres', '--if-exists', '--force', database])
    print('Disposable test database removed; source database unchanged.')
