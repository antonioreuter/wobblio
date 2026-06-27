# Sub-spec B — Remove the deposit→size inference (P2a)

## Why
Even automatic, the deposit→size signal is a guess that can write a wrong pack size into the
catalog and the price index. The user wants no inference beyond what is literally printed on the
receipt line. Revert P2a entirely; `ProductNormalizer` returns to printed-line → LLM/catalog size.

## Changes

### Database
- New migration (do NOT edit the shipped `..._container_deposit_rule.ts` create migration):
  `DROP TABLE IF EXISTS container_deposit_rule;` (up). Down recreates it + the NL seed if a clean
  reverse is wanted, or leave a no-op note — table is being retired.
- `Source/infra/src/local/reset-dev.ts`: remove `'container_deposit_rule'` from `PRESERVE_TABLES`.

### Backend deletes
- `core/domain/containerDeposit.ts`
- `core/ports/data-intelligence/IContainerDepositReference.ts`
- `infrastructure/adapters/data-intelligence/ContainerDepositReferenceAdapter.ts`
- `tests/unit/core/domain/containerDeposit.test.ts`

### ProductNormalizer revert (`core/services/data-intelligence/ProductNormalizer.ts`)
- Remove the `depositReference` ctor param + its import.
- Remove the deposit-rules load and `resolveDepositSizes` call in `normalize`; revert
  `lines.map((line, i) => toNormalizedLine(line, resolved[i]))`.
- `toNormalizedLine` + `resolvePackQuantity`: drop the `depositPackSize` argument. Precedence back
  to: printed line size (`parseUnitSize`) → `resolved.packSizeBaseUnits`.
- Delete the `resolveDepositSizes` helper + `depositImpliedPackSize`/`DepositSizeRule` imports.

### Wiring + tests
- `handlers/ingestion-worker/index.ts`: remove the `ContainerDepositReferenceAdapter` import and
  the 5th ctor arg to `new ProductNormalizer(...)`.
- `tests/unit/core/services/data-intelligence/ProductNormalizer.test.ts`: remove the `depositRef`
  mock + the ctor arg, the `setProvisionalPackSize` entry in the catalog mock, and the two deposit
  tests ("uses an adjacent deposit line…", "does not query deposit rules…").

## Validation
- `cd Source/backend && npm run skill:hexagonal-architecture-validator`
- `cd Source/backend && npm run test:unit` (+ `npx tsc --noEmit`)
- `cd Source/backend && npm run validate:security` (DDL drop)
- `cd Source/infra && STAGE=dev npx cdk synth`

## Deploy (dev only)
`migrate:up` on dev (drops the table), then `cdk:deploy:backend` (new ingestion-worker code).

## Done-when
`container_deposit_rule` gone; ingestion still normalizes printed-size products and leaves the
rest per-item with the caveat; gates green. Update `00-handoff.md` (Status B = done, Next = C).
