# Country-specific vision prompt & Brazil finalization (living handoff)

The receipt-parsing prompt (`src/prompts/visionParse.ts`, `vision-parse/v9`) is NL-shaped: its
`<exclusion_list>` is Dutch (SUBTOTAAL, BONUSKAART, STATIEGELD…) and both worked examples are Dutch
grocers (Albert Heijn, Jumbo). Every non-NL user — including the freshly-seeded Brazil market — gets
that Dutch prompt. This epic makes the prompt country-aware (few-shot examples + local exclusion
vocabulary + currency/date defaults per country, a neutral **default** when a country has no pack)
and uses it to finalize Brazil end-to-end.

Each sub-spec is independently shippable; implement one at a time and update this tracker.
Clear context between sub-specs.

| Sub-spec | Status | Notes |
|---|---|---|
| 00 — Detached decomposition + A/B harness | ✅ Built 2026-07-09 (in tree, uncommitted) | `src/prompts/visionParseByCountry/` (base skeleton + NL/default packs + `composeCountryVisionPrompt`); `npm run eval:country-prompt` A/B scorer; 8 unit tests green; validator + tsc clean. Production still on v9 — this is detached. |
| 01 — Validate decomposition (NL no-regression gate) | ✅ PASS 2026-07-09 (5 runs, dev Qwen) | Decomposition is quality-neutral on NL. Deltas are model noise on `jumbo_2` Σ (flakes on control too) + an `ah_1` fixture-date bug (fails both arms). Tightened `NL_PACK.currencyDateHint` to currency-only (dropped redundant date-order clause) to minimise delta from v9. See verdict below. |
| 02 — Brazil pack, currency & fixtures | 🟨 Code done 2026-07-09; fixtures + eval blocked on real BR images | ✅ 2a `BR: 'BRL'` in `currencyByCountry.ts` + test. ✅ 2b `BR_PACK` (Portuguese fiscal exclusion vocab + BRL/DD-MM + hand-authored Pão de Açúcar cupom-fiscal example) registered; `v9c+br`; 13 unit tests green. ⬜ 2c BR fixtures (need real receipt images) + 2d eval (BR_PACK ≥ default). |
| 03 — Production per-country wiring & rollout | 🟨 Code done 2026-07-09; rollout held (user) pending BR images | `VisionParseService` now takes a `VisionPromptSelector` (per-message, keyed on `ctx.countryCode`) instead of a fixed prompt. Composition root: image primary + Sonnet fallback use `composeCountryVisionPrompt`; PDF stays on the v9 monolith. Full unit suite green (947), validator + tsc clean, eval harness re-verified on the new selector path against real Bedrock. ⬜ Not deployed; dev replay (NL + BR receipt) pending BR images. |

## Where this stands (phase 0, already built — detached)

- `src/prompts/visionParseByCountry/pack.ts` — `CountryPromptPack {code, exclusionList, currencyDateHint, examples}`; `NL_PACK` (v9 content verbatim = the regression guardrail), `DEFAULT_PACK` (country-neutral), `PACK_REGISTRY` (NL only), `resolvePack(code)` → pack ?? DEFAULT.
- `src/prompts/visionParseByCountry/compose.ts` — country-agnostic base skeleton with 3 slots; `composeCountryVisionPrompt(code)` → `{template, version, pack}`; version `vision-parse/v9c+<pack>`.
- `src/local/eval-country-prompt.ts` + `npm run eval:country-prompt` — offline A/B: each fixture run twice (control = v9, candidate = composed), single variable = prompt; scores merchant/date/currency/total/Σ-reconciliation + tokens/cost/latency.
- `src/tests/unit/prompts/visionParseByCountry.test.ts` — 8 tests (fallback, version encoding, slot-filling, vocab isolation).

## 01 verdict (evidence)

5 A/B passes on dev Qwen (`qwen.qwen3-vl-235b-a22b`), control = `v9`, candidate = `v9c+nl`,
5 checks/fixture (merchant, date, currency, total, Σ-reconcile):

| Fixture | Stable checks | Variance seen | Attribution |
|---|---|---|---|
| `ah_1` | merchant/currency/total/Σ = ✓ both arms, all passes | date = ✗ on **both** arms every pass | Fixture bug: model reads a date ≠ truth `2025-06-04`. Cancels in A/B. Fix the fixture later; not a pack effect. |
| `jumbo_1` | all 5 = ✓ both arms after hint tightening | 1 candidate date flake in the initial batch, gone after tightening | Model noise. |
| `jumbo_2` | merchant/date/currency/total = ✓ both arms | Σ-reconcile flips ✓/✗ on **either** arm across passes | Known-hard multi-buy fixture; non-determinism hits control and candidate equally. |

Aggregate per-pass totals (control / candidate): 14/13, 13/14, 14/14, 13/14, 14/13 — no systematic
direction. Token/cost delta ≈ 0 (same model, near-identical prompt). **Conclusion:** promoting NL to
the composed prompt does not regress the launch market → 03 wiring is unblocked. Residual TODO
(non-blocking): fix the `ah_1` truth date; `jumbo_2` Σ is the pre-existing hard case tracked elsewhere.

## DAG

```
00 (done) ──► 01 (NL gate) ──► 03 (prod wiring) ──► roll out
                     └────────► 02 (Brazil content) ─┘
```
01 proves the mechanism doesn't regress the launch market. 02 and 03 can be built in parallel after
01, but **03 must not roll out to production before 02** — otherwise a Brazilian receipt in prod
gets `default` when it could have `BR`.

## Decisions of record

- **Detached, not flagged through core.** The country machinery is a separate prompt module + harness
  wired by composition; no runtime flag in `src/core` (feedback: detached & removable AI experiments).
  Production keeps using v9 until 03 rewires the composition root. The study (00–02) can run and be
  measured with zero production impact.
- **Packs are TS modules, not SSM.** Matches the existing prompt-artifact convention (bundles into the
  Lambda, git-reviewable, unit-testable). SSM live-swap is YAGNI until a real need appears.
- **Selection key = the user's `country_code`** (already flows to the parse call via
  `ReceiptContext.countryCode`). It is the *user's preference* country, not the receipt's printed
  country — a NL user shopping in Germany gets the NL pack. Accepted limitation for v1; revisit only
  if cross-border scanning is common.
- **Only the image vision path is country-composed** (primary + Sonnet fallback). The PDF parser
  (`pdf_parser`, structured invoices) stays on the shared prompt for now — packs are tuned for photo
  receipts. Record and revisit if BR PDF invoices matter.
- **Version string is the A/B signal.** `composeCountryVisionPrompt` encodes the pack
  (`vision-parse/v9c+nl`), recorded into `invoice_feedback.model_ids_snapshot` like every prompt
  version — so a per-country regression shows up instead of hiding in the aggregate.
- **BRL rates need no code.** The ECB daily-reference adapter (`EcbRateSourceAdapter`) parses every
  currency in the XML (which includes EUR/BRL), so `fx_rate` gets BRL→EUR automatically once the cron
  runs. The only currency gap is the `countryCurrency` domain map (02).
- **Brazil has no deposit system** (no statiegeld/Pfand), so the deposit→size enrichment is moot for
  BR. The BR-specific parsing risk is the opposite: cupom-fiscal / NFC-e tax noise (Trib aprox, ICMS,
  TROCO, DINHEIRO, CPF/CNPJ) — that is what `BR_PACK`'s exclusion vocabulary targets.

## Already done outside this epic (BR baseline — do not redo)

- Merchants: 38 BR seeds (SP/BA/RJ), 3-copy pinned + tested (`seed_merchants.test.ts`).
- Regions: all 27 BR states as ISO 3166-2 (`20260616100000_seed_reference_data.ts`).
- Product normalization, categories, postal/CEP storage: language-agnostic, no NL assumption.

## Invariants & rules touched

- No new tables, no DDL in 01/03. 02 adds a domain-map line only → no migration, but run
  `npm run test:unit` (currencyByCountry has a unit test).
- Hexagonal: the composer is pure prompt code (`src/prompts`), no infra import; the wiring change (03)
  stays in the handler/composition root and the core `VisionParseService`. Run
  `npm run skill:hexagonal-architecture-validator` (exit 0).
- Bedrock prompt rules (ai-prompt-extraction-engineer): XML separators, schema-conformant output,
  one retry-with-errors — unchanged; packs only vary content inside the same XML structure.
- Fixtures follow the evaluation-set contract (`<name>.jpeg` + `<name>.truth.json`).
```
