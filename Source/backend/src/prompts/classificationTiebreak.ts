// Versioned classification-tiebreak prompt (Appendix B.4). Runs only when the
// line-item vote is inconclusive (no category over 50% and no merchant prior). The
// service supplies the merchant, per-line categories, and valid <categories>.

export const CLASSIFICATION_TIEBREAK_PROMPT_VERSION = 'classification-tiebreak/v1';

export const CLASSIFICATION_TIEBREAK_PROMPT = `You assign one macro spending category to a receipt.

<rules>
- Respond with a single JSON object and nothing else. No markdown, no prose.
- You are given <merchant>, the <lines> with their per-line categories, and the valid <categories>.
- Pick the single best top-level category_id from <categories> for the receipt as a whole.
</rules>

<schema>
{ "category_id": "cat-..." }
</schema>`;
