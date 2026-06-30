# Pipeline evaluation set (NF-01/07)

Ground-truth fixtures for the offline pipeline comparison harness
(`Source/backend` → `npm run compare:pipelines`).

## Layout

Each fixture is an image plus a sibling `<name>.truth.json`:

```
jumbo_1.jpeg
jumbo_1.truth.json
ah_1.jpeg
ah_1.truth.json
```

## Ground-truth schema

```jsonc
{
  "merchant": "Jumbo",            // canonical brand
  "transactionDate": "2026-06-07",// ISO YYYY-MM-DD
  "currency": "EUR",
  "total": 51.02,                 // printed grand total (authoritative)
  "category": "supermarket",
  "tags": ["groceries", "supermarket"],
  "lines": [                       // curated line items
    { "rawText": "JUMBO VANILLE IJS", "quantity": 1, "lineTotal": 2.65 }
  ]
}
```

The judge (`insight` model) grades each pipeline's output against this on four criteria:
extraction accuracy, line-item completeness, classification alignment, tag relevance.

## Curation notes

- `jumbo_1` — clean receipt, line items transcribed directly.
- `ah_1` — crumpled; merchant/date/currency/total are authoritative, but the line items are a
  confidently-legible **subset** (see the `note` field). Expand them before trusting the
  `line_item_completeness` score for this fixture.

Add more fixtures by dropping an image + its `.truth.json` here; the harness picks up every
image automatically.
