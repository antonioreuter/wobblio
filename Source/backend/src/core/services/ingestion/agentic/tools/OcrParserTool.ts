import type { IReceiptParser, ReceiptContext } from '../../../../ports/ingestion/IReceiptParser';
import type { ParsedReceipt, UnreadableVerdict } from '../../../../domain/ingestion';
import { isImageBlockFormat, type UploadFormat } from '../../../../domain/uploadFormat';
import { UnsupportedUploadTypeError } from '../../../../domain/errors';

// Tool 1 (parent §3): file-type detection + OCR. PDFs route to the document-capable
// pdf_parser model (the vision model rejects document blocks); images route to the vision
// parser (which may itself escalate hard receipts to a powerful fallback model). Both run
// the same receipt prompt + schema-validated parse. A thin wrapper — no business logic.
export class OcrParserTool {
  constructor(
    private readonly visionParser: IReceiptParser,
    private readonly documentParser: IReceiptParser,
  ) {}

  parse(format: UploadFormat, bytes: Uint8Array, ctx: ReceiptContext): Promise<ParsedReceipt | UnreadableVerdict> {
    if (format === 'pdf') return this.documentParser.parse({ format, bytes, name: 'receipt' }, ctx);
    if (isImageBlockFormat(format)) return this.visionParser.parse({ format, bytes }, ctx);
    throw new UnsupportedUploadTypeError(`image/${format}`);
  }
}
