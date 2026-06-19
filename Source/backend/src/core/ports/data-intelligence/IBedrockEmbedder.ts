// §6.3 product embedding. 512-dim vector for the product.embedding pgvector column.
// Implemented by the Bedrock Titan Text Embeddings V2 adapter.
export interface IBedrockEmbedder {
  embed(text: string): Promise<number[]>;
}
