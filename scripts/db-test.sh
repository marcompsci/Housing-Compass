#!/usr/bin/env bash
# Runs migrations + seeds + database tests against a throwaway local Postgres.
# Usage:
#   DATABASE_URL=postgres://... bash scripts/db-test.sh   # use an existing empty DB (CI)
#   bash scripts/db-test.sh                               # spins up a temp cluster (needs postgres + postgis installed)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() { if [[ -n "${PGTMP:-}" ]]; then ${AS:-} "$PGBIN/pg_ctl" -D "$PGTMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PGTMP"; fi; }
trap cleanup EXIT

if [[ -z "${DATABASE_URL:-}" ]]; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
  PGTMP="$(mktemp -d)"
  PORT="${PGPORT_TEST:-54329}"
  AS=""
  if [[ "$(id -u)" == "0" ]]; then chown postgres "$PGTMP"; AS="sudo -u postgres"; fi
  $AS "$PGBIN/initdb" -D "$PGTMP/data" -U postgres -A trust >/dev/null
  $AS "$PGBIN/pg_ctl" -D "$PGTMP/data" -o "-p $PORT -k $PGTMP" -l "$PGTMP/log" -w start >/dev/null
  DATABASE_URL="postgresql://postgres@localhost:$PORT/postgres?host=$PGTMP"
fi

run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1"; echo "✓ $(basename "$1")"; }

run "$ROOT/supabase/tests/00_local_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do run "$f"; done
run "$ROOT/supabase/seed/seed.sql"
run "$ROOT/supabase/seed/seed.demo.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/tests/10_trust_tests.sql"

echo "── core ↔ database contract tests"
( cd "$ROOT/packages/core" && DATABASE_URL="$DATABASE_URL" npx vitest run test/db.integration.test.ts )
