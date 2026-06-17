import type { PoolClient } from 'pg';
import type { IPriceMatrix } from '@core/ports/optimizer/IPriceMatrix';
import { PriceMatrixAdapter } from './PriceMatrixAdapter';
import { MockPriceMatrixAdapter } from './MockPriceMatrixAdapter';

// Local dev returns a deterministic matrix (no seeded price observations needed);
// AWS queries the real price-observation store. Same IPriceMatrix port either way.
export function buildPriceMatrix(client: PoolClient): IPriceMatrix {
  if (process.env.STAGE === 'local') return new MockPriceMatrixAdapter();
  return new PriceMatrixAdapter(client);
}
