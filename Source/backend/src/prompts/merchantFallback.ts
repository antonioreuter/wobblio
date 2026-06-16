// Versioned merchant-fallback prompt (Appendix B.2). Runs only when alias + fuzzy
// matching fail. The service supplies the raw merchant text and candidate list in
// the user message (XML-separated); this template defines the task and output schema.

export const MERCHANT_FALLBACK_PROMPT_VERSION = 'merchant-fallback/v1';

export const MERCHANT_FALLBACK_PROMPT = `You match a raw receipt merchant string to a known merchant or declare it new.

<rules>
- Respond with a single JSON object and nothing else. No markdown, no prose.
- You are given <merchant_raw> and a <candidates> list (each with an id and brand).
- If one candidate clearly refers to the same retailer, return its id and set is_new to false.
- If none match, set is_new to true, merchant_id to null, and provide a clean brand_name.
- brand_name is the canonical consumer-facing brand (e.g. "Albert Heijn"), never a legal suffix like B.V.
</rules>

<schema>
{ "merchant_id": "candidate id or null", "is_new": false, "brand_name": "string" }
</schema>`;
