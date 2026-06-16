// §6.3 product embedding. 512-dim vector for the product.embedding pgvector column.
// AWS adapter = Bedrock Titan Text Embeddings V2; local adapter = Ollama.
export interface IBedrockEmbedder {
  embed(text: string): Promise<number[]>;
}
