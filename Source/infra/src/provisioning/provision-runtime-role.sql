-- Canonical, stage-agnostic provisioning of the non-owner application DB role.
-- =====================================================================================
-- WHY: the app must NOT connect as the table owner. Postgres exempts a table's owner
-- from its RLS policies unless FORCE ROW LEVEL SECURITY is set (which we must NOT use —
-- SECURITY DEFINER helpers rely on owner-bypass). So the runtime role is a non-owner,
-- NOSUPERUSER, NOBYPASSRLS login: RLS + `SET LOCAL app.current_tenant_id` then actually
-- isolate every request. Connecting as the owner = silent cross-tenant data leak.
--
-- RUN ONCE PER STAGE, as the RDS master, against that stage's database, e.g.:
--   dev : -d wobblio_dev -v role=wobblio_dev_runtime -v dbname=wobblio_dev -v owner=wobblio_dev_app
--   prod: -d wobblio     -v role=wobblio_runtime     -v dbname=wobblio     -v owner=wobblio_app
-- The password is supplied out-of-band and ALSO stored in that stage's app secret
-- (shared/db/wobblio_dev | shared/db/wobblio). Never commit it:
--   RPW=$(openssl rand -hex 24)
--   psql ... -v role=<r> -v dbname=<db> -v owner=<o> -v runtime_pw="$RPW" -f provision-runtime-role.sql
--
-- This is provisioning, NOT a node-pg-migrate migration: migrations run as the owner
-- (no CREATEROLE) and must stay secret-free and stage-deterministic.
-- =====================================================================================

\if :{?role}
\else
  \echo '>>> ERROR: pass -v role / -v dbname / -v owner / -v runtime_pw'
  \quit 1
\endif

-- CREATE/ALTER at top level so psql binds :'runtime_pw' as a quoted literal
-- (substitution does not happen inside DO $$ ... $$ blocks).
SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role') AS need_create \gset
\if :need_create
  CREATE ROLE :"role" LOGIN PASSWORD :'runtime_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
\else
  ALTER ROLE :"role" LOGIN PASSWORD :'runtime_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
\endif

GRANT CONNECT ON DATABASE :"dbname" TO :"role";
GRANT USAGE ON SCHEMA public TO :"role";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"role";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO :"role";

-- Future objects created by the owner (new migrations) must auto-grant to the runtime
-- role, else a later migration silently leaves the app without access on new tables.
-- ALTER DEFAULT PRIVILEGES FOR ROLE <owner> requires membership in <owner>; the master
-- (rds_superuser) grants itself that membership first.
GRANT :"owner" TO CURRENT_USER;
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"role";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"role";
-- Functions too: SECURITY DEFINER helpers added by later migrations are called by the
-- runtime role (e.g. household_owner_role, household_member_count_for). Without this a
-- new fn migration leaves the app with "permission denied for function" until a manual
-- GRANT EXECUTE re-run. Default privileges fix it for every future owner-created fn.
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO :"role";

-- Verify: must be f | f | f (not superuser, not bypassrls, not createrole = safe runtime role)
SELECT rolname, rolsuper, rolbypassrls, rolcreaterole FROM pg_roles WHERE rolname = :'role';
