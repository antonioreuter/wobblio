// Country-specific fragments for the vision-parse prompt (STUDY / detached).
//
// The production parser still uses the single `visionParse.ts` (v9) monolith. This
// module is the experimental country-aware variant: a country-agnostic base skeleton
// (compose.ts) plus a small per-country "pack" carrying only the parts that are
// genuinely local — the exclusion vocabulary, the worked few-shot examples, and the
// currency/date default. Everything else stays shared in the base.
//
// A pack is selected by the user's country_code (already flows into ReceiptContext).
// A country with no registered pack falls back to DEFAULT_PACK.

export interface CountryPromptPack {
  // ISO 3166-1 alpha-2, or 'default' for the country-neutral fallback. Lowercased into
  // the prompt version string so swap-comparison telemetry can tell packs apart.
  code: string;
  // Inner body of <exclusion_list> — the non-item tokens to drop, in the receipt's
  // language. This is the highest-signal country fragment.
  exclusionList: string;
  // One guidance line injected into <date_and_currency>: the default currency and the
  // printed date order for this country.
  currencyDateHint: string;
  // The <example_*> worked examples block appended at the end of the prompt.
  examples: string;
}

// Country-neutral fallback. No local loyalty-program or store-format vocabulary — only
// universal totals/tax/payment/metadata terms — and one generic worked example. Used
// whenever the user's country has no dedicated pack.
export const DEFAULT_PACK: CountryPromptPack = {
  code: 'default',
  exclusionList: `NEVER emit these as lines — they are not purchased goods. Drop them silently:
- Receipt totals / subtotals: any line whose label is or contains SUBTOTAL, TOTAL, TOTALE, "AMOUNT DUE", "BALANCE DUE", "GRAND TOTAL". The receipt-level total goes only in the top-level "total" field.
- Promo-savings grand totals: any "TOTAL DISCOUNT" / "TOTAL SAVINGS" line that restates the SUM of the individual discount lines you already emitted. NEVER emit them; emitting both double-counts the discount. (A per-item discount line WITHOUT a TOTAL prefix IS a real discount line — keep it negative.)
- Tax / VAT footer summaries: VAT, TAX, GST, "TAX TOTAL", "VAT %".
- Tax/recycling/surcharge sub-lines already INCLUDED in a parent item's price — lines starting with "+", "INCL.", "incl.", "*" or a tax code. DROP these. (Container deposits are the exception — those ARE emitted, see <extraction>.)
- Loyalty / membership: LOYALTY, MEMBER, POINTS, REWARDS, CARD NUMBER, "MEMBER ID".
- Payment / card metadata: PAYMENT, CARD, VISA, MASTERCARD, MAESTRO, "CARD NUMBER", "AUTH CODE", "CARD SEQUENCE", TRANSACTION, TERMINAL, APPROVED, CHANGE, CASH, TENDER.
- Operational metadata: CASHIER, REGISTER, STORE, BARCODE, "OPENING HOURS", "ITEM COUNT", "NUMBER OF ITEMS".
- Generic footer text: privacy/website lines, "Thank you", "Customer copy", return-policy notes.`,
  currencyDateHint:
    '- If no currency symbol is printed, infer the currency from the printed address country. When a date is ambiguous (DD/MM vs MM/DD), use <user_country> to decide the order.',
  examples: `<example_1>
A supermarket receipt with a deposit, a per-item discount, and a totals/tax footer:
\`\`\`
FRESH MARKET
123 Main Street
COCA-COLA 1.5L        1.89
BOTTLE DEPOSIT        0.25
BANANAS 1KG           1.10
MEMBER DISCOUNT      -0.30
SUBTOTAL              2.94
TAX                   0.00
TOTAL                 2.94
\`\`\`
Correct output:
\`\`\`json
{
  "merchant_raw": "FRESH MARKET",
  "transaction_date": "2026-06-10",
  "currency": "EUR",
  "total": 2.94,
  "location": { "city": "" },
  "parse_confidence": 0.95,
  "lines": [
    { "raw_text": "COCA-COLA 1.5L", "quantity": 1, "line_total": 1.89 },
    { "raw_text": "BOTTLE DEPOSIT", "quantity": 1, "line_total": 0.25 },
    { "raw_text": "BANANAS 1KG", "quantity": 1, "line_total": 1.10 },
    { "raw_text": "MEMBER DISCOUNT", "quantity": 1, "line_total": -0.30 }
  ]
}
\`\`\`
Note: SUBTOTAL / TAX / TOTAL dropped (totals/tax footer). BOTTLE DEPOSIT kept (deposit, positive). MEMBER DISCOUNT kept as a NEGATIVE line. Σ = 1.89+0.25+1.10−0.30 = 2.94 ✓.
</example_1>`,
};

// Netherlands pack — carries today's v9 content verbatim (Dutch exclusion vocabulary +
// the Albert Heijn / Jumbo worked examples). Composing base + this pack must reproduce
// v9's behaviour; it is the regression guardrail for the decomposition.
export const NL_PACK: CountryPromptPack = {
  code: 'NL',
  exclusionList: `NEVER emit these as lines — they are not purchased goods. Drop them silently:
- Receipt totals / subtotals: SUBTOTAAL, SUBTOTAL, TOTAAL, TOTAL, TOTALE, "TOTAL EUR", "JOUW VOORDEEL", "TOTAL DISCOUNT", "BONUS BOX PREMIUM". The receipt-level total goes only in the top-level "total" field.
- Promo-savings grand totals: "TOTALE ACTIEKORTING", "TOTALE KORTING", "TOTAL DISCOUNT" — these restate the SUM of the individual discount lines you already emitted. NEVER emit them; emitting both double-counts the discount. (A per-item "KORTING ..." / "ACTIE ..." line WITHOUT a TOTAL/TOTALE prefix IS a real discount line — keep it negative.)
- Tax / VAT footer summaries: BTW, VAT, MWST, TAX, "BTW%", "BTW TOTAAL", "TAX TOTAL".
- Tax/recycling/surcharge sub-lines already INCLUDED in a parent item's price — lines starting with "+", "INCL.", "incl.", "*" or a tax code (e.g. "INCL. HEF. SUP"). DROP these. (Container deposits are the exception — those ARE emitted, see <extraction>.)
- Loyalty / membership: BONUSKAART, "AIR MILES", AIRMILES, PASNUMMER, PASNR, PUNTEN, "JUMBO EXTRA", "MIJN AH MILES", CLUBKAART, PAYBACK, POINTS, REWARDS, MEMBER.
- Payment / card metadata: "BETAALD MET", PAYMENT, PINNEN, MAESTRO, VISA, MASTERCARD, CONTACTLOZE, CARD, KAART, KAARTNR, "CARD SEQUENCE", "AUTH CODE", TRANSACTIE, TRANSACTION, TERMINAL, MERCHANT, PERIODE, TOKEN, AKKOORD, APPROVED.
- Operational metadata: MEDEWERKER, KASSA, KASSIER, CASHIER, WINKEL, STORE, BARCODE, OPENINGSTIJDEN, "OPENING HOURS", "AANTAL ARTIKELEN", "AANTAL JUICHZEGELS".
- Generic footer text: privacy/website lines, "Vragen over je kassabon?", "Bekijk het privacy statement", "Customer's receipt", "Bedankt".`,
  currencyDateHint:
    '- Default currency is EUR when no symbol is printed. Dutch receipts print dates as DD-MM-YYYY.',
  examples: `<example_1>
A Dutch Albert Heijn receipt with a printed store address, a loyalty header and a discount summary block:
\`\`\`
Albert Heijn 1179
Kalverstraat 12
5611 AB Eindhoven
        BONUSKAART  xx5482
        AIRMILES NR. * xx5080
1  COCA-COLA       9,39
   +STATIEGELD     1,80
1  BIO PASSATA     1,99 B
1  BRAADWORST      2,29 40%
4  SUBTOTAAL      15,47
BONUS bio premium     -0,20
40% K BRAADWORST      -0,92
JOUW VOORDEEL          1,12
TOTAAL                14,35
\`\`\`
Correct output:
\`\`\`json
{
  "merchant_raw": "Albert Heijn 1179",
  "transaction_date": "2026-06-10",
  "currency": "EUR",
  "total": 14.35,
  "location": { "country_code": "NL", "city": "Eindhoven", "postal_code": "5611 AB" },
  "parse_confidence": 0.95,
  "lines": [
    { "raw_text": "COCA-COLA", "quantity": 1, "line_total": 9.39 },
    { "raw_text": "+STATIEGELD", "quantity": 1, "line_total": 1.80 },
    { "raw_text": "BIO PASSATA", "quantity": 1, "line_total": 1.99 },
    { "raw_text": "BRAADWORST", "quantity": 1, "line_total": 2.29 },
    { "raw_text": "BONUS bio premium", "quantity": 1, "line_total": -0.20 },
    { "raw_text": "40% K BRAADWORST", "quantity": 1, "line_total": -0.92 }
  ]
}
\`\`\`
Note: BONUSKAART and AIRMILES dropped (loyalty). SUBTOTAAL / JOUW VOORDEEL / TOTAAL dropped (totals). STATIEGELD kept (deposit, positive). The two summary discounts kept as their own NEGATIVE lines. location transcribed from the printed address (city + postal; country_code NL is unambiguous for a Dutch "5611 AB" postal code); region_text omitted — no province was printed. Σ = 9.39+1.80+1.99+2.29−0.20−0.92 = 14.35 ✓.
</example_1>

<example_2>
A Jumbo receipt with a deposit, a pack size, a per-item promo, and a quantity continuation line (JUMBO SPAGHETTI EI has no price; the "2 X 1,39" line below it carries qty × unit):
\`\`\`
JUMBO supermarkten
COCA COLA ZERO 12X33    9,39
STATIEGELD              1,80
HARIBO BUBBLE FIZZ      2,09
JUMBO SPAGHETTI EI
   2 X 1,39             2,78
ACTIE HARIBO/MAOAM     -0,40
TOTAAL                 15,66
\`\`\`
Correct output:
\`\`\`json
{
  "merchant_raw": "JUMBO supermarkten",
  "transaction_date": "2026-06-07",
  "currency": "EUR",
  "total": 15.66,
  "parse_confidence": 0.96,
  "lines": [
    { "raw_text": "COCA COLA ZERO 12X33", "quantity": 1, "line_total": 9.39, "unit_size_raw": "12X33CL" },
    { "raw_text": "STATIEGELD", "quantity": 1, "line_total": 1.80 },
    { "raw_text": "HARIBO BUBBLE FIZZ", "quantity": 1, "line_total": 2.09 },
    { "raw_text": "JUMBO SPAGHETTI EI", "quantity": 2, "line_total": 2.78, "unit_price": 1.39 },
    { "raw_text": "ACTIE HARIBO/MAOAM", "quantity": 1, "line_total": -0.40 }
  ]
}
\`\`\`
Note: TOTAAL dropped. STATIEGELD kept (deposit). "2 X 1,39" is NOT a separate item — it set SPAGHETTI EI to quantity 2, unit_price 1.39, line_total 2.78. The promo kept as a negative line. location omitted entirely — this receipt prints no store address. Σ = 9.39+1.80+2.09+2.78−0.40 = 15.66 ✓.
</example_2>`,
};

// Registry keyed by uppercase ISO country code. Add a pack here (e.g. DE, BR) and it is
// picked up automatically; anything unregistered resolves to DEFAULT_PACK.
const PACK_REGISTRY: Record<string, CountryPromptPack> = {
  NL: NL_PACK,
};

// Resolve the pack for a user's country, falling back to the country-neutral default.
export function resolvePack(countryCode: string | undefined): CountryPromptPack {
  if (!countryCode) return DEFAULT_PACK;
  return PACK_REGISTRY[countryCode.toUpperCase()] ?? DEFAULT_PACK;
}
