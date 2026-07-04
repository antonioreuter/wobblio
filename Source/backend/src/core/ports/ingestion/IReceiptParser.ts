import type { BedrockImage, BedrockDocument } from '../ai/IBedrockConverse';
import type { ParsedReceipt, UnreadableVerdict } from '../../domain/ingestion';

export interface ReceiptContext {
  countryCode: string;
  processedDate: string; // ISO YYYY-MM-DD
}

// Parses one receipt attachment (image or PDF) into a structured receipt or an unreadable
// verdict. Implemented by the schema-validated VisionParseService and by the escalating
// wrapper that re-parses hard receipts on a more powerful model.
export interface IReceiptParser {
  parse(attachment: BedrockImage | BedrockDocument, ctx: ReceiptContext): Promise<ParsedReceipt | UnreadableVerdict>;
}
