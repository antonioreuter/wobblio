// Versioned product-expansion prompt (Appendix B.3). One batch call per receipt
// normalizes every line and piggybacks tag suggestions (§6.10). The service supplies
// an optional <merchant> venue hint, valid <categories>, valid <tags>, and raw <lines>.

export const PRODUCT_EXPANSION_PROMPT_VERSION = 'product-expansion/v5';

export const PRODUCT_EXPANSION_PROMPT = `You normalize raw receipt line items into canonical products and propose search tags.

<rules>
- Respond with a single JSON object and nothing else. No markdown, no prose.
- Return one item per input line, in the same order. The items array length MUST equal the number of <lines>.
- display_name: the canonical PRODUCT IDENTITY only (brand + product + size when known). It MUST NOT contain promotion text. Strip promotion/discount/multibuy words and markers such as "Discount", "Korting", "Bonus", "Actie", "Aanbieding", "1+1", "2+1", "2e halve prijs", "2=1", "50%", and any percent or multi-buy marker — these describe pricing, not the product. Example: "Discount 1+1 Lucovitaal" => brand "Lucovitaal", display_name "Lucovitaal".
- brand: the isolated brand name (e.g. "Lucovitaal", "Albert Heijn", "Coca-Cola"), or null when the product is unbranded or the brand is unknown. Never put promotion text in brand.
- category_id: choose the most specific id from <categories>. Vitamins, supplements and gummy vitamins (e.g. "GUMMIES VITAMINE", multivitamine, magnesium) go to cat-vitamins.
- Venue rule (takes precedence over "most specific"): when <merchant> marks a food/drink venue — a restaurant, fast-food/quick-service, café, canteen, takeaway or snackbar (by brand such as McDonald's, KFC, Burger King, Subway, Starbucks, FEBO, or typical_category="cat-dining-out"); or a bar/pub (typical_category="cat-bars-pubs") — classify FOOD and DRINK lines into that venue's leaves, NOT grocery leaves. A burger, fries, wrap or menu goes to cat-dining-meals; a fountain drink, coffee or milkshake to cat-dining-drinks; sides, nuggets or snacks to cat-dining-snacks. For a bar/pub use cat-bar-drinks and cat-bar-food. A meal served by a restaurant is dining-out, never a supermarket ready-meal (cat-ready-deli) or grocery item. Non food/drink lines (e.g. retail merchandise) keep their normal category.
- base_unit: KG for weight goods, L for liquids, PIECE for counted goods.
- pack_size_base_units: transcribe ONLY a size token printed on the line, converted to base units (e.g. a printed "500 G" => 0.5). Do NOT calculate, infer, or estimate pack size. If no size is printed on the line, output null. A printed multipack marker (e.g. "6x33cl") is transcribed verbatim into display_name as raw text; never do the arithmetic yourself — leave pack_size_base_units null unless a single explicit size is printed.
- is_deposit_or_fee: true for refundable container deposits (statiegeld, pfand, emballage, "deposit"), bag fees, and surcharges — these are not products.
- A line with a negative amount is a discount/refund (e.g. korting, bonus, actie), not a deposit: set is_deposit_or_fee false and pick the line's product macro.
- suggested_tags: 0..3 keys taken only from <tags> that describe the invoice / venue type (the kind of shop or spending category), not individual products; [] if none apply.
</rules>

<schema>
{
  "items": [
    { "display_name": "string", "brand": "string or null", "category_id": "cat-...", "base_unit": "KG|L|PIECE", "pack_size_base_units": 0.5, "is_deposit_or_fee": false }
  ],
  "suggested_tags": ["slug"]
}
</schema>`;
