import { describe, it, expect, vi } from 'vitest';
import { OcrParserTool } from '@core/services/ingestion/agentic/tools/OcrParserTool';
import { MerchantResolverTool } from '@core/services/ingestion/agentic/tools/MerchantResolverTool';
import { ProductNormalizerTool } from '@core/services/ingestion/agentic/tools/ProductNormalizerTool';
import { InvoiceClassifierTool } from '@core/services/ingestion/agentic/tools/InvoiceClassifierTool';
import { SearchTagGeneratorTool } from '@core/services/ingestion/agentic/tools/SearchTagGeneratorTool';
import type { VisionParseService } from '@core/services/ingestion/VisionParseService';
import { UnsupportedUploadTypeError } from '@core/domain/errors';

const CTX = { countryCode: 'NL', processedDate: '2026-06-29' };
const BYTES = new Uint8Array([1, 2, 3]);

describe('OcrParserTool', () => {
  const vision = { parse: vi.fn().mockResolvedValue({ merchantRaw: 'AH' }) };
  const document = { parse: vi.fn().mockResolvedValue({ merchantRaw: 'AH-PDF' }) };
  const tool = new OcrParserTool(vision as unknown as VisionParseService, document as unknown as VisionParseService);

  it('routes a PDF to the document parser as a document attachment', async () => {
    await tool.parse('pdf', BYTES, CTX);
    expect(document.parse).toHaveBeenCalledWith({ format: 'pdf', bytes: BYTES, name: 'receipt' }, CTX);
    expect(vision.parse).not.toHaveBeenCalled();
  });

  it('routes an image to the vision parser as an image attachment', async () => {
    await tool.parse('jpeg', BYTES, CTX);
    expect(vision.parse).toHaveBeenCalledWith({ format: 'jpeg', bytes: BYTES }, CTX);
  });

  it('rejects an unsupported format before any model call', () => {
    expect(() => tool.parse('heic' as 'jpeg', BYTES, CTX)).toThrow(UnsupportedUploadTypeError);
  });
});

describe('canonicalization tools delegate to their service', () => {
  it('MerchantResolverTool → resolver.resolve', async () => {
    const resolver = { resolve: vi.fn().mockResolvedValue({ merchantId: 'm1' }) };
    await new MerchantResolverTool(resolver).run('AH', 'NL');
    expect(resolver.resolve).toHaveBeenCalledWith('AH', 'NL');
  });

  it('ProductNormalizerTool → normalizer.normalize', async () => {
    const normalizer = { normalize: vi.fn().mockResolvedValue({ lines: [], suggestedTags: [] }) };
    await new ProductNormalizerTool(normalizer).run('m1', [], 'NL');
    expect(normalizer.normalize).toHaveBeenCalledWith('m1', [], 'NL');
  });

  it('InvoiceClassifierTool → classifier.classify', async () => {
    const classifier = { classify: vi.fn().mockResolvedValue('groceries') };
    const input = { merchantId: 'm1', lines: [], normalized: [] };
    await new InvoiceClassifierTool(classifier).run(input);
    expect(classifier.classify).toHaveBeenCalledWith(input);
  });

  it('SearchTagGeneratorTool → tagGenerator.generate', async () => {
    const tagGenerator = { generate: vi.fn().mockResolvedValue(['t']) };
    const input = { merchantId: 'm1', merchantBrand: 'AH', categoryId: 'g', lines: [], normalized: [], suggestedTags: [] };
    await new SearchTagGeneratorTool(tagGenerator).run(input);
    expect(tagGenerator.generate).toHaveBeenCalledWith(input);
  });
});
