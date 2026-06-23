// Single source of truth for accepted receipt/invoice upload formats. Images are
// open to every tier; PDF is premium-gated at presign (see PresignService). The S3
// key carries the extension so the ingestion worker can pick the Bedrock attachment
// type (image vs document block) without a DB column.

export type UploadFormat = 'jpeg' | 'png' | 'pdf';

const TYPE_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
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
  return 'jpeg';
}
