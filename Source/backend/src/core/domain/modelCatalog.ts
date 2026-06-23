import type { ModelRole } from '@core/ports/ai/IModelRegistry';

// Curated model options offered in the admin model-swap matrix (preselects). IDs are
// Bedrock model / cross-region inference-profile identifiers known to be enabled in
// the account (Qwen vision, Nova, Claude, Titan — all seen in Cost Explorer usage).
// The UI also allows a free-text "Custom…" entry, so this list is convenience, not a
// hard allowlist; an unavailable pick surfaces via the DOWN-ratio canary.
export interface ModelOption {
  id: string;
  label: string;
}

export const MODEL_OPTIONS: Record<ModelRole, ModelOption[]> = {
  vision_parser: [
    { id: 'qwen.qwen3-vl-235b-a22b', label: 'Qwen3-VL 235B — vision' },
    { id: 'eu.amazon.nova-lite-v1:0', label: 'Amazon Nova Lite — vision' },
    { id: 'eu.amazon.nova-pro-v1:0', label: 'Amazon Nova Pro — vision' },
    { id: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5 — vision' },
  ],
  auxiliary: [
    { id: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
    { id: 'eu.amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
    { id: 'eu.amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  ],
  insight: [
    { id: 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Claude Sonnet 4.5' },
    { id: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
    { id: 'eu.amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
  ],
  embedder: [
    { id: 'amazon.titan-embed-text-v2:0', label: 'Amazon Titan Text Embeddings V2' },
    { id: 'cohere.embed-multilingual-v3', label: 'Cohere Embed Multilingual v3' },
  ],
};
