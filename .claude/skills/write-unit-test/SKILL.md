---
name: write-unit-test
description: Guidelines and template structures for writing fast, mock-isolated unit tests for the core business logic using Vitest.
---

# Write Unit Test Skill

Use this skill when you need to write unit tests for the core business logic (services, entities, ports) of the backend or frontend modules.

## Architecture Guidelines
1. **Mock All Dependencies**: Unit tests must run completely locally, in-memory, and in isolation. Never make actual database connections or external API calls (Cognito, S3, Bedrock).
2. **Inject Ports**: Instantiate the core services by injecting mock adapters (e.g., `MockDbRelationalAdapter` or Vitest mocks `vi.mock`).
3. **Tenant Data Isolation**: Assert that domain services strictly segregate data by `userId`. Test with multiple users (e.g., `user-a` and `user-b`) to ensure leaks do not occur.
4. **Target Code Coverage**: Ensure that the code coverage for the target service remains above 85% by testing standard flows, boundary values, error handler routes, and validation failures.

## Standard Unit Test Skeleton (Vitest)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoreService } from './core.service';
import { IAuthPort } from '../ports/auth.port';
import { IDbRelationalPort } from '../ports/db-relational.port';

describe('CoreService Unit Tests', () => {
  let mockDbPort: vi.Mocked<IDbRelationalPort>;
  let mockAuthPort: vi.Mocked<IAuthPort>;
  let service: CoreService;

  const tenantId = 'tenant-uuid-123';

  beforeEach(() => {
    // 1. Initialize Mock Ports
    mockDbPort = {
      getInvoicesByUser: vi.fn(),
      getInvoiceById: vi.fn(),
      // Add other operations as mock functions
    } as unknown as vi.Mocked<IDbRelationalPort>;

    mockAuthPort = {
      verifyToken: vi.fn(),
    } as unknown as vi.Mocked<IAuthPort>;

    // 2. Instantiate Service with injected Mock Ports
    service = new CoreService(mockDbPort, mockAuthPort);
  });

  it('should successfully retrieve data filtered by tenant ID', async () => {
    const mockInvoices = [
      { id: '1', userId: tenantId, storeId: 'store-1', invoiceDate: '2026-05-22', totalAmount: 10.0 },
    ];
    mockDbPort.getInvoicesByUser.mockResolvedValue(mockInvoices);

    const result = await service.getUserInvoices(tenantId);

    expect(mockDbPort.getInvoicesByUser).toHaveBeenCalledWith(tenantId);
    expect(result).toEqual(mockInvoices);
  });

  it('should throw an error if an unauthorized tenant accesses another user\'s invoice', async () => {
    const intruderId = 'intruder-uuid-999';
    const ownerId = 'owner-uuid-111';
    
    mockDbPort.getInvoiceById.mockResolvedValue({
      id: 'inv-1',
      userId: ownerId,
      storeId: 'store-1',
      invoiceDate: '2026-05-22',
      totalAmount: 10.0
    });

    await expect(service.getInvoiceDetails(intruderId, 'inv-1'))
      .rejects.toThrow('Unauthorized access to invoice record');
  });
});
```
