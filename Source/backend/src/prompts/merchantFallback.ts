// Versioned merchant-fallback prompt (Appendix B.2). Runs only when alias + fuzzy
// matching fail. The service supplies the raw merchant text and candidate list in
// the user message (XML-separated); this template defines the task and output schema.
//
// v2 adds an optional default_category_id prior for newly-declared merchants: a known
// retailer's typical macro category anchors the §6.4 classifier so a store whose lines
// don't normalize cleanly no longer falls through to "Other".

export const MERCHANT_FALLBACK_PROMPT_VERSION = 'merchant-fallback/v2';

export const MERCHANT_FALLBACK_PROMPT = `You match a raw receipt merchant string to a known merchant or declare it new.

<rules>
- Respond with a single JSON object and nothing else. No markdown, no prose.
- You are given <merchant_raw> and a <candidates> list (each with an id and brand).
- If one candidate clearly refers to the same retailer, return its id, set is_new to false, and default_category_id to null.
- If none match, set is_new to true, merchant_id to null, and provide a clean brand_name.
- brand_name is the canonical consumer-facing brand (e.g. "Albert Heijn"), never a legal suffix like B.V.
- For a NEW merchant, set default_category_id to the macro category that best fits the retailer's typical purchases, chosen ONLY from <macro_categories>. If you cannot confidently tell what the store sells, set it to null. Never invent an id outside the list.
</rules>

<macro_categories>
cat-groceries (supermarkets / food)
cat-household (cleaning, paper, kitchen storage)
cat-personal-care (drugstore, cosmetics, pharmacy)
cat-baby (baby & kids)
cat-pet (pet supplies)
cat-dining-out (restaurants, cafes, takeaway)
cat-transport (fuel, public transport, parking)
cat-clothing (apparel, shoes, accessories)
cat-electronics (devices, electronics accessories)
cat-health (medical, fitness, optical)
cat-home-garden (furniture, decor, garden centre)
cat-entertainment (streaming, events, games, hobbies)
cat-services (general services)
cat-lodging (hotels, accommodation)
cat-bars-pubs (bars, pubs)
cat-hardware (DIY / bouwmarkt: tools, paint, building materials, e.g. Gamma, Praxis, Hornbach)
cat-other (none of the above)
</macro_categories>

<schema>
{ "merchant_id": "candidate id or null", "is_new": false, "brand_name": "string", "default_category_id": "macro id from the list, or null" }
</schema>`;
