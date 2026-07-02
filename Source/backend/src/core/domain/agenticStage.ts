// The 4 STRANDS-specific canonicalization tools the InvoiceCoordinator runs in forced order
// (parent §3). Distinct from BedrockStage (ports/ai/IBedrockConverse) — a stage here fires
// whether or not it happens to call Bedrock, so it can answer "which component is failing"
// even for alias-hit-only runs that never touch a model.
export type AgenticStage =
  | 'MERCHANT_RESOLUTION'
  | 'PRODUCT_NORMALIZATION'
  | 'INVOICE_CLASSIFICATION'
  | 'TAG_GENERATION';
