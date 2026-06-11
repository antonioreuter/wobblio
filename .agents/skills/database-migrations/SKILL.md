---
name: database-migrations
description: Guide to creating, running, rolling back, and auditing database migrations using node-pg-migrate.
---

# Database Migrations Skill

This skill documents how to manage schema updates safely and check execution histories in our PostgreSQL database.

---

## 1. Migration Guidelines

All database schema changes (DDR/DDL) **must** go through database migration files. Direct schema alterations are prohibited.

### Creating Migrations
We use `node-pg-migrate`. To create a migration, execute:
```bash
npm run migration:create --prefix backend <migration-name>
```
This generates a new TypeScript file under `infra/db/migrations/` (e.g., `1716900000000_name.ts`).

### Migration Code Constraints
Every migration file must export both an `up` and a `down` function:
```typescript
import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`CREATE TABLE x (...);`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`DROP TABLE IF EXISTS x CASCADE;`);
}
```

---

## 2. Command Reference

* **Run all pending migrations (Local)**:
  ```bash
  ./update-db-schema.sh
  ```
* **Run all pending migrations (Prod)**:
  ```bash
  ./update-db-schema.sh --prod
  ```
* **Roll back the latest migration**:
  ```bash
  npm run migration:down --prefix backend
  ```
* **Roll back N migrations**:
  ```bash
  npm run migration:down --prefix backend -- <N>
  ```
  *(Note: Requires setting PG connection env variables like `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` before running rollback).*

---

## 3. Migration Check Script

To audit the execution status of all migrations and check whether local files align with the database:
```bash
npm run db:migrations-check --prefix backend
```
This script queries the `pgmigrations` table and verifies that all local migrations:
1. Have been applied in the database.
2. Properly export both `up` and `down` functions for rollbacks.
