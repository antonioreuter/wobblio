# Runtime DB role provisioning (RLS enforcement)

The application must connect to Postgres as a **non-owner** role. A table's owner is
exempt from its RLS policies (we do **not** use `FORCE ROW LEVEL SECURITY` — SECURITY
DEFINER helpers depend on owner-bypass), so connecting as the owner silently returns
cross-tenant rows. `provision-runtime-role.sql` creates the safe runtime role; the app
secret is then pointed at it.

A fail-closed guard (`Source/backend/src/infrastructure/config/db.ts`,
`assertRuntimeRoleCannotBypassRls`) refuses to start if the app's role can bypass RLS —
so a stage that skips this provisioning fails loudly instead of leaking.

## Reproducible (preferred) — one command

`provisionRuntimeRole.ts` does the whole thing idempotently (create/rotate role, grants,
default privileges, rotate the app secret) using the RDS master from `shared/db/master`.
Re-run it after any environment teardown/rebuild, then redeploy the backend:

```bash
STAGE=dev  CONFIRM_PROVISION=wobblio_dev npm run provision:runtime-role
STAGE=prod CONFIRM_PROVISION=wobblio     npm run provision:runtime-role   # prod owner only
cd Source/infra && STAGE=<stage> npm run cdk:deploy:backend
```

The manual psql path below is the equivalent for ops without Node.

## Per-stage procedure (run as the RDS master)

Values per stage:

| stage | db          | runtime role          | owner          | app secret              |
|-------|-------------|-----------------------|----------------|-------------------------|
| dev   | wobblio_dev | wobblio_dev_runtime   | wobblio_dev_app| shared/db/wobblio_dev   |
| prod  | wobblio     | wobblio_runtime       | wobblio_app    | shared/db/wobblio       |

```bash
RPW=$(openssl rand -hex 24)
export PGPASSWORD=$(aws secretsmanager get-secret-value --secret-id shared/db/master \
  --region eu-west-1 --output json --query SecretString \
  | python3 -c "import sys,json;print(json.loads(json.load(sys.stdin))['password'])")

# 1. create/rotate the non-owner role + grants  (set <db>/<role>/<owner> per the table)
psql -h <endpoint> -U postgres -d <db> -v ON_ERROR_STOP=1 \
  -v role=<role> -v dbname=<db> -v owner=<owner> -v runtime_pw="$RPW" \
  -f Source/infra/src/provisioning/provision-runtime-role.sql

# 2. point the app secret at the runtime role (same ARN -> no CDK/IAM change)
aws secretsmanager put-secret-value --secret-id <app-secret> --region eu-west-1 \
  --secret-string "{\"username\":\"<role>\",\"password\":\"$RPW\",\"host\":\"<endpoint>\",\"port\":\"5432\",\"dbname\":\"<db>\"}"

# 3. redeploy the backend so Lambdas cold-start on the new creds (and ship the guard)
cd Source/infra && STAGE=<stage> npm run cdk:deploy:backend
```

The owner role stays in use for **migrations/seeds only** (run with owner creds passed
manually, never from the app secret).

## Verify

Connect as the runtime role, set a tenant, confirm isolation:

```sql
SELECT set_config('app.current_tenant_id','<tenant-A-uuid>', false);
SELECT count(*) FROM invoice;   -- only tenant A's rows; 0 with no tenant set
```
