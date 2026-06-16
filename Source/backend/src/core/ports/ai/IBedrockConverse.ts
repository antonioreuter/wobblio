export type BedrockStage =
  | 'VISION_PARSE'
  | 'MERCHANT_FALLBACK'
  | 'PRODUCT_EXPANSION'
  | 'CLASSIFICATION_TIEBREAK'
  | 'WEEKLY_ADVISOR'
  | 'EMBEDDING';

export interface BedrockImage {
  format: 'jpeg' | 'png';
  bytes: Uint8Array;
}

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
  // Optional image attachment for vision-capable stages (e.g. VISION_PARSE).
  image?: BedrockImage;
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
}

export interface IBedrockConverse {
  converse(request: BedrockConverseRequest): Promise<BedrockConverseResult>;
}
