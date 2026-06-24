// Parses a Cost Explorer Bedrock USAGE_TYPE string into a model display name.
// Examples:
//   EU-Qwen3-VL-235B-A22B-input-tokens                -> Qwen3-VL-235B-A22B
//   EU-TitanEmbeddingV2-Text-output-tokens            -> TitanEmbeddingV2-Text
//   EU-Nova2.0Lite-input-tokens-cross-region-global   -> Nova2.0Lite
//   EUW1-Claude-Haiku-output-tokens                   -> Claude-Haiku
// Region prefix (EU-, EUW1-, USE1- …) and the input/output-token + cross-region
// suffixes are stripped; both token directions collapse to one model.
export function parseBedrockModel(usageType: string): string {
  const stripped = usageType
    .replace(/^[A-Z]{2}[A-Z0-9]*-/, '')
    .replace(/-cross-region-global$/i, '')
    .replace(/-(input|output)-tokens?$/i, '')
    .replace(/-(input|output)-tokencount$/i, '');
  return stripped || usageType;
}
