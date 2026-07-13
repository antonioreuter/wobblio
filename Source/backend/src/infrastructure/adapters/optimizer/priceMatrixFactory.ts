import type { PoolClient } from 'pg';
import type { IPriceMatrix } from '@core/ports/optimizer/IPriceMatrix';
import { PriceMatrixAdapter } from './PriceMatrixAdapter';
import { MockPriceMatrixAdapter } from './MockPriceMatrixAdapter';
import { SsmAmbiguityConfigAdapter } from '@infrastructure/adapters/data-intelligence/SsmAmbiguityConfigAdapter';

// Local dev returns a deterministic matrix (no seeded price observations needed);
// AWS queries the real price-observation store, folding in the caller's comparison sets under the
// comparability + ambiguity rules (09/05). Same IPriceMatrix port either way.
export function buildPriceMatrix(client: PoolClient): IPriceMatrix {
  if (process.env.STAGE === 'local') return new MockPriceMatrixAdapter();
  const region = process.env.AWS_REGION ?? 'eu-west-1';
  return new PriceMatrixAdapter(client, new SsmAmbiguityConfigAdapter(region));
}
