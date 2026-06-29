import { describe, it, expect } from 'vitest';
import {
  attachmentFormatFromKey,
  extensionFor,
  isAllowedUploadType,
  isImageBlockFormat,
  isPdf,
} from '@core/domain/uploadFormat';

describe('uploadFormat', () => {
  it('accepts the supported upload types (incl. WebP/HEIC) and rejects others', () => {
    expect(isAllowedUploadType('image/jpeg')).toBe(true);
    expect(isAllowedUploadType('image/png')).toBe(true);
    expect(isAllowedUploadType('image/webp')).toBe(true);
    expect(isAllowedUploadType('image/heic')).toBe(true);
    expect(isAllowedUploadType('application/pdf')).toBe(true);
    expect(isAllowedUploadType('image/gif')).toBe(false);
  });

  it('identifies PDFs', () => {
    expect(isPdf('application/pdf')).toBe(true);
    expect(isPdf('image/jpeg')).toBe(false);
  });

  it('maps content types to file extensions, null for unknown', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
    expect(extensionFor('image/heic')).toBe('heic');
    expect(extensionFor('application/pdf')).toBe('pdf');
    expect(extensionFor('image/gif')).toBeNull();
  });

  it('derives the attachment format from the S3 key extension', () => {
    expect(attachmentFormatFromKey('receipts/t/abc.pdf')).toBe('pdf');
    expect(attachmentFormatFromKey('receipts/t/abc.png')).toBe('png');
    expect(attachmentFormatFromKey('receipts/t/abc.webp')).toBe('webp');
    expect(attachmentFormatFromKey('receipts/t/abc.heic')).toBe('heic');
    expect(attachmentFormatFromKey('receipts/t/abc.jpg')).toBe('jpeg');
    expect(attachmentFormatFromKey('receipts/t/abc.JPG')).toBe('jpeg');
    // Legacy/unknown keys fall back to jpeg.
    expect(attachmentFormatFromKey('receipts/t/abc')).toBe('jpeg');
  });

  it('recognises only jpeg/png/webp as Bedrock image-block formats (pdf rides a document block; heic is rejected)', () => {
    expect(isImageBlockFormat('jpeg')).toBe(true);
    expect(isImageBlockFormat('png')).toBe(true);
    expect(isImageBlockFormat('webp')).toBe(true);
    expect(isImageBlockFormat('pdf')).toBe(false);
    expect(isImageBlockFormat('heic')).toBe(false);
  });
});
