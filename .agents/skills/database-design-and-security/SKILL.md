---
name: database-design-and-security
description: Schema design conventions, indexing rules, and tenant isolation policies (Row-Level Security) to build robust and performant databases.
---

# Database Design and Security Skill

This skill documents guidelines and automated validations to ensure the quality, performance, and data isolation of our PostgreSQL database schemas.

---

## 1. Schema Design Standards

* **Primary Keys**: Every table must use a `UUID` as its primary key. Default values must be generated via `gen_random_uuid()` or `uuid_generate_v4()`.
* **Timestamps**: Always use `TIMESTAMP WITH TIME ZONE` (e.g. `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL`).
* **Foreign Keys**: Ensure clear cascading rules: `ON DELETE CASCADE` or `ON DELETE SET NULL`.
* **Naming**: Keep all identifiers (tables, columns, indexes, keys) in `snake_case`.

---

## 2. Indexing Best Practices

* **Foreign Keys**: Always create a B-Tree index on foreign key columns. Postgres does not automatically index foreign keys. Without them, joins and deletes result in slow table scans.
* **Uniqueness**: Do not create redundant indexes for unique columns. Adding a `UNIQUE` constraint or a `PRIMARY KEY` already creates a unique index.
* **Partial Indexes**: Use partial indexes (`WHERE` clause) to filter common subsets (e.g., global stores vs user-created custom stores).
* **Naming**: Prefix indexes with `idx_[table_name]_[column_names]`.

---

## 3. Row-Level Security (RLS)

To comply with GDPR and prevent cross-tenant data leaks, all tables containing user-specific data must enable Row-Level Security.

### Enabling RLS
Enable RLS in migrations:
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Implementing Policies
Tenant identification is handled using the custom PostgreSQL function `get_current_tenant()`, which reads the session variable `app.current_user_id`:
```sql
CREATE POLICY table_name_isolation_policy ON table_name
  FOR ALL
  USING (user_id = get_current_tenant());
```

---

## 4. Database Schema and Security Audit

To run compliance and performance checks on the schema:
```bash
npm run db:design-audit --prefix backend
```

This tool audits the database metadata and warns about:
1. **Disabled RLS**: Tables missing RLS policies.
2. **Missing Primary Keys**: Tables without a primary key constraint.
3. **Unindexed Foreign Keys**: Referencing columns on foreign keys that lack a supporting index.
