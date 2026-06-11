---
name: write-integration-test
description: Guidelines and template structures for writing integration tests to verify database adapters, AWS connections, and external REST endpoints.
---

# Write Integration Test Skill

Use this skill when you need to write integration tests for adapter implementations (PostgreSQL transactions, AWS S3 buckets, Cognito directories, Bedrock integrations) that require physical connections or database emulation.

## Architecture Guidelines
1. **Local Containers or Emulators**: Prefer running integration tests against local configurations (e.g., PostgreSQL local instances, AWS DynamoDB Local, S3 local stack emulators).
2. **Transaction Rollbacks**: For relational database tests, wrap queries inside transaction rollbacks to prevent test pollution and maintain a clean testing environment:
   ```typescript
   await client.query('BEGIN');
   // ... run test queries ...
   await client.query('ROLLBACK');
   ```
3. **Data Isolation (Prefixes)**: When testing S3 or DynamoDB operations directly on cloud/test resources, append unique randomized suffixes to object keys and tables (e.g., `invoices/test-user-${randomId}/`) to avoid collision.
4. **Complete Setup & Teardown Lifecycle**: Utilize `beforeAll`, `afterAll`, `beforeEach`, and `afterEach` lifecycle blocks to cleanly connect/disconnect client connections, populate reference metadata, and purge temp objects.

## Standard Relational Database Integration Test Skeleton (Vitest)
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client } from 'pg';
import { DbRelationalAdapter } from './db-relational.adapter';

describe('DbRelationalAdapter Integration Tests', () => {
  let dbClient: Client;
  let adapter: DbRelationalAdapter;

  beforeAll(async () => {
    // 1. Setup local database client connection
    dbClient = new Client({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/invoice_test',
    });
    await dbClient.connect();
    adapter = new DbRelationalAdapter(dbClient);
  });

  afterAll(async () => {
    // 2. Safely close database connection
    await dbClient.end();
  });

  beforeEach(async () => {
    // Start transaction isolation block
    await dbClient.query('BEGIN');
  });

  afterEach(async () => {
    // Rollback changes to keep tables clean
    await dbClient.query('ROLLBACK');
  });

  it('should enforce Row-Level Security and restrict query data to current session tenant', async () => {
    const userA = 'user-a-uuid';
    const userB = 'user-b-uuid';

    // Seed test users
    await dbClient.query('INSERT INTO users(id, email) VALUES ($1, $2), ($3, $4)', [
      userA, 'usera@test.com', userB, 'userb@test.com'
    ]);

    // Insert invoice for User B
    await dbClient.query('INSERT INTO invoices(id, user_id, total_amount) VALUES ($1, $2, $3)', [
      'inv-b-1', userB, 45.50
    ]);

    // Set connection context to User A
    await dbClient.query(`SET LOCAL app.current_user_id = '${userA}'`);

    // Fetch invoices using adapter method
    const invoices = await adapter.getInvoicesByUser(userA);

    // User A should not see User B's invoice
    expect(invoices).toHaveLength(0);

    // Set context to User B and check access
    await dbClient.query(`SET LOCAL app.current_user_id = '${userB}'`);
    const invoicesB = await adapter.getInvoicesByUser(userB);
    expect(invoicesB).toHaveLength(1);
    expect(invoicesB[0].totalAmount).toBe(45.50);
  });
});
```
