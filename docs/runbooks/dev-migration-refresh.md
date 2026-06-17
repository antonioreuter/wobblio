# Runbook — refreshing the dev DB for the in-flight budget/advisor migrations

**Applies to:** branch `fix/ingestion-pipeline-iam-and-robustness`
**Why:** two in-flight migrations were **edited in place** (not shipped), and one was
**reordered**, so an incremental `migrate up` cannot bring an already-migrated DB current.

## What changed in the migrations

1. `20260616101000_budgets_notifications.ts` — `list_active_budgets()` `RETURNS TABLE`
   gained a `currency` column (sourced from `app_user.home_currency`).
2. `20260616103000_weekly_advisor.ts` — `list_advisor_eligible_tenants()` `RETURNS TABLE`
   gained `currency`; `advisor_price_findings` cheapest CTE got a deterministic tie-break.
3. `20260617100000_uk_nations_resplit.ts` → **renamed** to `20260617115000_uk_nations_resplit.ts`
   so it runs **after** `20260617110000_invoice_location_gate.ts` (which adds the
   `invoice.location_country_code` column it depends on). A from-scratch `migrate up`
   failed before this fix.

## Why incremental `migrate up` is not enough

- A migration already in the `pgmigrations` ledger is **never re-run**, so the edited
  `budgets_notifications` / `weekly_advisor` bodies won't reapply.
- The two functions changed their `RETURNS TABLE` signature; `CREATE OR REPLACE FUNCTION`
  **errors on a return-type change** ("cannot change return type of existing function"),
  so even forcing a re-run would fail without a `DROP FUNCTION` first.
- The rename means the ledger holds the old filename; `down` would look for a file that no
  longer exists.

The reliable remedy for an **in-flight (unshipped) dev DB** is a schema reset + clean
`migrate up`. (Once these migrations ship, this no longer applies — shipped migrations are
immutable; write a new migration instead.)

## Local (already done in this branch)

```bash
# wobblio_local, as the local superuser
psql "$LOCAL_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO wobblio_dev; GRANT ALL ON SCHEMA public TO public;"
cd Source/infra
DATABASE_URL="$LOCAL_DB_URL" npm run migrate:up
DATABASE_URL="$LOCAL_DB_URL" npm run seed:local
```

Verified: 17 migrations applied clean; `list_active_budgets` / `list_advisor_eligible_tenants`
both return `currency`; `advisor_price_findings` carries the tie-break.

## Dev RDS (run from a host with VPC/SG access to the shared RDS)

The dev DB is the stage-isolated `wobblio_dev` database on the shared RDS
(`shared/db/wobblio_dev`). It is **not reachable from a local sandbox** — run from a bastion
/ CI runner / SSM session with network access and the dev credentials.

```bash
export DATABASE_URL="postgres://<dev_user>:<dev_pass>@<shared-rds-host>:5432/wobblio_dev"

# 1. (Recommended for in-flight state) reset the schema, then migrate clean:
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO <dev_user>; GRANT ALL ON SCHEMA public TO public;"
cd Source/infra
DATABASE_URL="$DATABASE_URL" npm run migrate:up
DATABASE_URL="$DATABASE_URL" npm run seed:local   # reference data only

# 2. Sanity checks:
psql "$DATABASE_URL" -tA -c "SELECT count(*) FROM pgmigrations;"            # expect 17
psql "$DATABASE_URL" -tA -c "SELECT pg_get_function_result(oid) FROM pg_proc WHERE proname='list_advisor_eligible_tenants';"
#   expect: TABLE(tenant_id uuid, language text, currency text)
```

> ⚠️ Reset drops all dev data. If dev carries data worth keeping, instead drop only the two
> changed functions, manually re-run their `CREATE` bodies, and apply the (renamed)
> `weekly_advisor` migration by hand — fiddlier, but non-destructive. The reset path is
> recommended while these migrations are still in-flight.
