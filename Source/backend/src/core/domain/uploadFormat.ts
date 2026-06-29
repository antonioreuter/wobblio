// Single source of truth for accepted receipt/invoice upload formats. Images are
// open to every tier; PDF is premium-gated at presign (see PresignService). The S3
// key carries the extension so the ingestion worker can pick the Bedrock attachment
// type (image vs document block) without a DB column.

export type UploadFormat = 'jpeg' | 'png' | 'webp' | 'pdf' | 'heic';

const TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  // HEIC is accepted at presign so the contract stays forgiving for clients that hand us
  // the original (iOS capture). The model can't read it, so a well-behaved client converts
  // to JPEG before the upload; a raw HEIC that reaches the worker is a user-fault reject.
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};

export function isAllowedUploadType(contentType: string): boolean {
  return contentType in TYPE_TO_EXTENSION;
}

export function isPdf(contentType: string): boolean {
  return contentType === 'application/pdf';
}

export function extensionFor(contentType: string): string | null {
  return TYPE_TO_EXTENSION[contentType] ?? null;
}

// Map an S3 key's extension back to the Bedrock attachment format. Defaults to jpeg
// for legacy/unknown keys (the historical image-only path wrote `.jpg`).
export function attachmentFormatFromKey(s3Key: string): UploadFormat {
  const ext = s3Key.slice(s3Key.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'png') return 'png';
  if (ext === 'webp') return 'webp';
  if (ext === 'heic') return 'heic';
  return 'jpeg';
}

// Image-block formats Bedrock accepts (jpeg/png/webp). PDFs ride a document block; every
// other format (HEIC, or any future accepted-but-unreadable type) is rejected pre-AI as a
// user-fault (UNSUPPORTED_FORMAT), never quarantined. A type predicate so the caller
// narrows without a cast — a new format added to the allow-list defaults to "reject" until
// it is explicitly handled here.
export function isImageBlockFormat(format: UploadFormat): format is 'jpeg' | 'png' | 'webp' {
  return format === 'jpeg' || format === 'png' || format === 'webp';
}
