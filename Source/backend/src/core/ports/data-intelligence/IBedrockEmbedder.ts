// §6.3 product embedding. 512-dim vector for the product.embedding pgvector column.
// Implemented by the Bedrock Titan Text Embeddings V2 adapter.
export interface EmbeddingResult {
  embedding: number[];
  // Input tokens billed for the embedding call — accumulated into the per-invoice
  // credit charge (all-model token accounting, Non-Functional 02 locked-decision #2).
  inputTokens: number;
}

export interface IBedrockEmbedder {
  embed(text: string): Promise<EmbeddingResult>;
}
