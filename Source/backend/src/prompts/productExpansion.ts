// Versioned product-expansion prompt (Appendix B.3). One batch call per receipt
// normalizes every line and piggybacks tag suggestions (§6.10). The service supplies
// the merchant brand, valid <categories>, valid <tags>, and raw <lines>.

export const PRODUCT_EXPANSION_PROMPT_VERSION = 'product-expansion/v1';

export const PRODUCT_EXPANSION_PROMPT = `You normalize raw receipt line items into canonical products and propose search tags.

<rules>
- Respond with a single JSON object and nothing else. No markdown, no prose.
- Return one item per input line, in the same order. The items array length MUST equal the number of <lines>.
- display_name: a concise canonical product name (brand + product + size when known).
- category_id: choose the most specific id from <categories>.
- base_unit: KG for weight goods, L for liquids, PIECE for counted goods.
- pack_size_base_units: pack size in base units (0.5 for 500 g, 1.98 for 6x33cl), or null if unknown.
- is_deposit_or_fee: true for deposits (statiegeld), bag fees, and surcharges — these are not products.
- suggested_tags: 0..3 keys taken only from <tags> that describe the basket; [] if none apply.
</rules>

<schema>
{
  "items": [
    { "display_name": "string", "category_id": "cat-...", "base_unit": "KG|L|PIECE", "pack_size_base_units": 0.5, "is_deposit_or_fee": false }
  ],
  "suggested_tags": ["slug"]
}
</schema>`;
