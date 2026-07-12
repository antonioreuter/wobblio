# 09/04 — Comparison sets & the per-merchant trend picker

**Blocks:** 05. **Blocked by:** 02, 03.

## Principle

Cross-merchant comparability is a **user assertion**, stored per tenant. A comparison set says "these products (each at its own merchant) are interchangeable *for me*." Because sets are tenant-scoped (RLS), there is zero catalog-poisoning surface — one user's claims never affect another user's comparisons or the global store.

## Schema (migration, both tables RLS-enabled per invariant #1)

```
product_comparison_set (
  id UUID PK,
  tenant_id UUID NOT NULL,          -- RLS: app.current_tenant_id
  name TEXT NULL,                   -- optional user label ("milk")
  created_at timestamptz
)
product_comparison_set_member (
  id UUID PK,
  set_id UUID FK,
  tenant_id UUID NOT NULL,          -- RLS
  product_id UUID FK,               -- product implies merchant (09/02)
  source ENUM(USER | SPLIT_SEED),
  size_equivalent BOOLEAN NOT NULL DEFAULT false,  -- see link-creation flow
  added_at timestamptz,
  UNIQUE (set_id, product_id)
)
```

- Max **5 members** per set (enforced in the domain service). A product may belong to multiple sets.
- `size_equivalent` is a property of membership: true means the user confirmed this member is the same size/pack as the others. It is the only override to the comparability rule (09/05).

## Link-creation flow (one question, no silent claims)

From a shopping-list item or a trend series, "compare with…" → same-merchant-aware product search (own purchase history first) → user picks the counterpart → one confirmation: **"Same size/pack?"**
- **Yes** → `size_equivalent = true`: pair is rankable/optimizer-eligible even when sizes aren't printed.
- **Not sure** → `size_equivalent = false`: link is **watch-only** — plotted and displayed side-by-side, never ranked, never fed to the optimizer (until sizes become known-and-equal via receipt/annotation, or the user upgrades the answer).
- `SPLIT_SEED` members (09/03) are always created watch-only.

## API

- CRUD under `/me/comparison-sets` (tenant-scoped, standard authorizer); member add/remove; `size_equivalent` toggle.
- Existing trend endpoint semantics change: `products=<id,id,id>` — since identity is now per-merchant, each id already *is* a `(product, merchant)` series. `TREND_MAX_PRODUCTS = 3` unchanged. Comparison sets are offered by the client as one-tap presets that prefill the picker (sets with >3 members: user picks which 3 to plot).
- Market series stay k≥3-gated and staleness-greyed per cell (§6.5 unchanged); own-history series ungated (unchanged); single view currency per chart (unchanged).

## Trend UI (webapp `reports/page.tsx`; mobile follows in its own epic)

- Picker selects concrete `(product @ merchant)` entries — merchant always shown; no bare product names.
- Each plotted series carries its size chip (09/01 evidence states). When plotted series have differing/unknown sizes, show the honesty note: *"Sizes differ or aren't stated — you're comparing prices as paid, not per unit."* Plotting is always allowed (viewing is not ranking).
- **Price-ambiguity banner:** a series whose underlying `(product, merchant)` is flagged ambiguous (definition in 09/05) shows *"This name may cover different products at this store — prices ranged €X–€Y."* with a link to the resolution flow (09/05).

## Acceptance criteria

- [ ] RLS on both tables verified by `npm run validate:security`; a tenant cannot read/write another tenant's sets (integration test).
- [ ] Trend chart plots up to 3 per-merchant series with merchant labels and size chips; preset flow from a comparison set works.
- [ ] Watch-only members render but are excluded from any ranked/crowned surface (assert via unit test on the serving DTO flags).
- [ ] "Same size/pack?" answer round-trips to `size_equivalent` and is editable.
- [ ] Honesty note appears exactly when plotted sizes differ or are unknown.
