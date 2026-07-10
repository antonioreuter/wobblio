# 02 — Brazil: pack, currency & fixtures

**Goal.** Give Brazil the two things it is missing to parse and report correctly: a country pack for
the vision prompt, and its currency in the price-trends honesty map. Then prove the pack beats the
neutral default on real BR receipts.

Depends on 01 (mechanism validated on NL). Blocked on **real BR receipt images** — needed for the
fixtures; they cannot be fabricated.

## 2a — `BR: 'BRL'` in the currency map (do first — trivial, standalone)

`src/core/domain/currencyByCountry.ts` maps a country to its expected ISO-4217 currency for the
price-trends currency-honesty filter (§6.5). `BR` is absent, so `countryCurrency('BR')` returns null
and a BR region's price view falls back to modal-currency guessing.

- Add `BR: 'BRL'` to `COUNTRY_CURRENCY` (the non-euro group).
- Add a case to `src/tests/unit/core/domain/currencyByCountry.test.ts`
  (`expect(countryCurrency('BR')).toBe('BRL')`).
- No migration, no DDL. Run `npm run test:unit`.
- FX rates need no work: `EcbRateSourceAdapter` already ingests every currency in the ECB daily XML
  (BRL included) → `fx_rate` gets EUR→BRL once `cron-fx-rate-fetch` runs.

## 2b — `BR_PACK` in `src/prompts/visionParseByCountry/pack.ts`

Author a `CountryPromptPack` for Brazil and register it: `PACK_REGISTRY = { NL: NL_PACK, BR: BR_PACK }`.

**`code`**: `'BR'`.

**`exclusionList`** — the highest-value fragment. Brazilian *cupom fiscal* / NFC-e receipts are dense
with tax and payment noise the neutral default does not name in Portuguese. Cover at least:
- Totals/subtotals: `SUBTOTAL`, `TOTAL`, `VALOR TOTAL`, `TOTAL R$`, `VALOR A PAGAR`, `TOTAL A PAGAR`,
  `Qtd. total de itens`, `Quantidade total de itens`.
- Payment / change: `TROCO`, `DINHEIRO`, `CARTÃO`, `CARTAO`, `CRÉDITO`, `DÉBITO`, `PIX`, `VALOR PAGO`,
  `FORMA DE PAGAMENTO`.
- Tax lines already included in item prices: `Trib aprox`, `Valor aprox dos tributos`,
  `Val Aprox Tributos`, `ICMS`, `Tributos Totais Incidentes`, `Lei 12.741`.
- Fiscal / operational metadata: `CPF`, `CNPJ`, `CPF/CNPJ`, `CPF na nota`, `Consumidor`, `SAT`,
  `NFC-e`, `Nota Fiscal`, `Chave de acesso`, `Protocolo`, `Número`, `Série`, `Caixa`, `Operador`,
  `CAIXA`, `S/N` document/serial lines.
- Loyalty: `Programa de fidelidade`, `Clube`, `Pontos`, `Cashback`.
- Generic footer: `Obrigado`, `Volte sempre`, `Consulte pela chave de acesso`, website/QR lines.

Keep the same shape as `DEFAULT_PACK.exclusionList` (a headed bullet list). Do **not** add deposit
tokens — Brazil has no container-deposit system, so there is nothing to keep positive.

**`currencyDateHint`**: `- Default currency is BRL (R$) when no symbol is printed. Brazilian receipts
print dates as DD/MM/YYYY.`

**`examples`** — one worked `<example_1>` from a real Brazilian grocery cupom fiscal (e.g. Pão de
Açúcar or Carrefour): a handful of items with Portuguese names and `R$` prices, an item-included tax
footer (`Trib aprox`), a `TROCO`/`DINHEIRO` block, and `VALOR TOTAL`. Show the correct output: items
only, tax/troco/total/CPF dropped, Σ line_totals = total. Mirror the note style of the NL examples
(explain each drop and the Σ check). If a second example adds signal (a pharmacy, or a promo/discount
line `DESCONTO` kept negative), add `<example_2>`.

## 2c — BR fixtures

Add 1–2 representative BR receipts to `invoices/fixtures/evaluation-set/`, each as
`<name>.jpeg` + `<name>.truth.json` (same contract as the NL fixtures):
- Suggested: `paodeacucar_1`, `carrefour_br_1` (grocery); optionally a pharmacy (`drogasil_1`).
- `truth.json`: `merchant`, `transactionDate`, `currency: "BRL"`, `total`, and a `country: "BR"`
  field so the harness selects the BR pack automatically; plus a curated `lines` subset.

## 2d — Measure: BR pack vs default

```
cd Source/backend && npm run eval:country-prompt -- --country=BR
```
(`--country=BR` also lets you sanity-check the *default* fallback path by temporarily removing BR from
the registry, or run a specific fixture with `--only=paodeacucar_1`.)

Because the harness's candidate arm uses the fixture's country (`BR` → `BR_PACK`) and the control arm
is v9, this run actually compares **v9 vs BR_PACK**. To isolate **default vs BR_PACK** (the question
that justifies the pack over just shipping default), run once with BR registered and once with it
unregistered and diff the candidate columns. Record both.

## Acceptance

- `countryCurrency('BR') === 'BRL'`, unit test green.
- `BR_PACK` registered; `composeCountryVisionPrompt('BR').version === 'vision-parse/v9c+br'`; the 8
  existing composer unit tests still pass (add a BR assertion mirroring the NL ones).
- On the BR fixtures, `BR_PACK` ≥ `DEFAULT_PACK` on checks passed (Σ-reconciliation and total are the
  load-bearing ones). Record the table in `00-handoff.md`.
- If `BR_PACK` does **not** beat default, keep default in the registry and record why — the fallback
  is the honest choice when a pack adds no measurable value.

## Notes

- Portuguese tag/category display names are **out of scope** (parked `multilingual-localization.md`);
  ingestion tags are English-keyed and unaffected.
- Currency **symbol** rendering (`R$`) is a webapp/mobile concern, tracked separately — not a backend
  blocker for this sub-spec.
