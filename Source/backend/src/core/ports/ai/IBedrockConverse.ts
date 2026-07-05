export type BedrockStage =
  | 'VISION_PARSE'
  | 'VISION_PARSE_FALLBACK'
  | 'MERCHANT_FALLBACK'
  | 'PRODUCT_EXPANSION'
  | 'CLASSIFICATION_TIEBREAK'
  | 'WEEKLY_ADVISOR'
  | 'EMBEDDING';

export interface BedrockImage {
  format: 'jpeg' | 'png' | 'webp';
  bytes: Uint8Array;
}

export interface BedrockDocument {
  format: 'pdf';
  bytes: Uint8Array;
  // Converse requires a document name (alphanumeric/space/hyphen).
  name: string;
}

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
  // Optional attachment for vision-capable stages (e.g. VISION_PARSE). An image is
  // sent as a Converse image block; a PDF as a native document block. Mutually exclusive.
  image?: BedrockImage;
  document?: BedrockDocument;
}

export interface BedrockConverseRequest {
  modelId: string;
  stage: BedrockStage;
  messages: BedrockMessage[];
  systemPrompt?: string;
  promptVersion: string;
  maxTokens?: number; // output ceiling; defaults applied by the adapter
  temperature?: number; // defaults to 0 (deterministic) when omitted
}

export interface BedrockConverseResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  durationMs: number;
  // Prompt-caching usage, populated only by cache-capable adapters (Claude/Nova). When the
  // cached prefix is a HIT these are read at ~0.1× cost; on the first call the prefix is a
  // WRITE at ~1.25×. Absent (undefined) means caching was not used for this call.
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
}

export interface IBedrockConverse {
  converse(request: BedrockConverseRequest): Promise<BedrockConverseResult>;
}
