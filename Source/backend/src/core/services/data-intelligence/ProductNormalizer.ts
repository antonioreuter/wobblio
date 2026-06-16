import type { IProductNormalizer, NormalizationResult, NormalizedLine } from '../../ports/data-intelligence/IProductNormalizer';
import type { IProductCatalog, ProductMatch } from '../../ports/data-intelligence/IProductCatalog';
import type { IBedrockEmbedder } from '../../ports/data-intelligence/IBedrockEmbedder';
import type { BedrockConverseRequest, BedrockMessage } from '../../ports/ai/IBedrockConverse';
import type { BedrockSpendGuardService } from '../ai/BedrockSpendGuardService';
import type { ParsedLine } from '../../domain/ingestion';
import { ConfidenceThresholds } from '../../domain/ingestion';
import { computeNormalizedUnitPrice, parseUnitSize, type BaseUnit } from '../../domain/unitSize';
import { callJsonWithRetry } from '../../domain/llmJson';
import { parseProductExpansionJson, type ExpandedItem, type ProductExpansion } from '../../domain/productExpansionSchema';
import { CATEGORY_TAXONOMY } from '../../domain/categoryTaxonomy';
import { TAG_VOCABULARY } from '../../domain/tagVocabulary';
import { PRODUCT_EXPANSION_PROMPT, PRODUCT_EXPANSION_PROMPT_VERSION } from '../../../prompts/productExpansion';

const PROVISIONAL_CONFIDENCE = 0.5;

interface ResolvedProduct {
  productId: string | null;
  categoryId: string | null;
  baseUnit: BaseUnit | null;
  packSizeBaseUnits: number | null;
  isDepositOrFee: boolean;
  provisional: boolean;
  confidence: number;
  lowConfidence: boolean;
}

// §6.3 product normalization: per-line merchant-scoped exact alias → one batch LLM
// expansion (also yields tag suggestions) → embed + pgvector match (accept / low-conf
// / provisional) → alias write-back.
export class ProductNormalizer implements IProductNormalizer {
  constructor(
    private readonly catalog: IProductCatalog,
    private readonly embedder: IBedrockEmbedder,
    private readonly spendGuard: BedrockSpendGuardService,
    private readonly modelId: string,
  ) {}

  async normalize(tenantId: string, merchantId: string | null, lines: ParsedLine[]): Promise<NormalizationResult> {
    const normalizedTexts = lines.map(line => normalizeProductText(line.rawText));
    // Sequential, not Promise.all: every stage shares one pg connection, which
    // cannot run queries concurrently.
    const exact: (ProductMatch | null)[] = [];
    for (const text of normalizedTexts) {
      exact.push(await this.catalog.findExactAlias(merchantId, text));
    }

    const unmatched = exact.flatMap((match, index) => (match ? [] : [index]));
    const expansion = unmatched.length > 0
      ? await this.expand(tenantId, unmatched.map(index => lines[index].rawText))
      : { items: [], suggestedTags: [] };

    const resolved = new Array<ResolvedProduct>(lines.length);
    exact.forEach((match, index) => {
      if (match) resolved[index] = fromExactMatch(match);
    });
    for (let k = 0; k < unmatched.length; k++) {
      const index = unmatched[k];
      resolved[index] = await this.resolveProduct(merchantId, normalizedTexts[index], expansion.items[k]);
    }

    return {
      lines: lines.map((line, index) => toNormalizedLine(line, resolved[index])),
      suggestedTags: expansion.suggestedTags,
    };
  }

  private async resolveProduct(merchantId: string | null, normalizedText: string, item: ExpandedItem): Promise<ResolvedProduct> {
    if (item.isDepositOrFee) {
      return { productId: null, categoryId: item.categoryId, baseUnit: null, packSizeBaseUnits: null, isDepositOrFee: true, provisional: false, confidence: 1, lowConfidence: false };
    }

    const embedding = await this.embedder.embed(item.displayName);
    const [match] = await this.catalog.searchByEmbedding(embedding, item.categoryId, 1);

    if (match && match.similarity >= ConfidenceThresholds.embeddingAccept) {
      return this.acceptMatch(merchantId, normalizedText, match, false);
    }
    if (match && match.similarity >= ConfidenceThresholds.embeddingLow) {
      return this.acceptMatch(merchantId, normalizedText, match, true);
    }
    return this.createProvisional(merchantId, normalizedText, item, embedding);
  }

  private async acceptMatch(merchantId: string | null, normalizedText: string, match: ProductMatch, lowConfidence: boolean): Promise<ResolvedProduct> {
    await this.catalog.writeAlias({ productId: match.productId, aliasNormalized: normalizedText, merchantId, source: 'AUTO_LLM' });
    return { productId: match.productId, categoryId: match.categoryId, baseUnit: match.baseUnit, packSizeBaseUnits: match.packSizeBaseUnits, isDepositOrFee: false, provisional: false, confidence: match.similarity, lowConfidence };
  }

  private async createProvisional(merchantId: string | null, normalizedText: string, item: ExpandedItem, embedding: number[]): Promise<ResolvedProduct> {
    const productId = await this.catalog.createProvisionalProduct({
      displayName: item.displayName,
      categoryId: item.categoryId,
      baseUnit: item.baseUnit,
      packSizeBaseUnits: item.packSizeBaseUnits,
      embedding,
    });
    await this.catalog.writeAlias({ productId, aliasNormalized: normalizedText, merchantId, source: 'AUTO_LLM' });
    return { productId, categoryId: item.categoryId, baseUnit: item.baseUnit, packSizeBaseUnits: item.packSizeBaseUnits, isDepositOrFee: false, provisional: true, confidence: PROVISIONAL_CONFIDENCE, lowConfidence: false };
  }

  private async expand(tenantId: string, rawTexts: string[]): Promise<ProductExpansion> {
    return callJsonWithRetry({
      call: request => this.spendGuard.callWithSpendGuard(tenantId, request),
      buildRequest: messages => this.buildRequest(messages),
      messages: [{ role: 'user', content: buildExpansionMessage(rawTexts) }],
      validate: content => parseProductExpansionJson(content, rawTexts.length),
    });
  }

  private buildRequest(messages: BedrockMessage[]): BedrockConverseRequest {
    return {
      modelId: this.modelId,
      stage: 'PRODUCT_EXPANSION',
      messages,
      systemPrompt: PRODUCT_EXPANSION_PROMPT,
      promptVersion: PRODUCT_EXPANSION_PROMPT_VERSION,
      temperature: 0,
    };
  }
}

function fromExactMatch(match: ProductMatch): ResolvedProduct {
  return { productId: match.productId, categoryId: match.categoryId, baseUnit: match.baseUnit, packSizeBaseUnits: match.packSizeBaseUnits, isDepositOrFee: false, provisional: false, confidence: match.similarity, lowConfidence: false };
}

function toNormalizedLine(line: ParsedLine, resolved: ResolvedProduct): NormalizedLine {
  const baseUnit = resolved.isDepositOrFee ? null : resolved.baseUnit;
  const packQuantity = resolvePackQuantity(line, resolved, baseUnit);
  return {
    productId: resolved.productId,
    categoryId: resolved.categoryId,
    baseUnit,
    packQuantity,
    normalizedUnitPrice: computeNormalizedUnitPrice(line.lineTotal, line.quantity, packQuantity),
    isDepositOrFee: resolved.isDepositOrFee,
    productProvisional: resolved.provisional,
    confidence: resolved.confidence,
    lowConfidence: resolved.lowConfidence,
  };
}

// Prefer the unit size printed on this receipt line over the catalog/LLM pack size, but
// only when its unit matches the canonical base unit, so a stray parse can't flip the
// product's comparison unit (§6.3 — clean data beats large data).
function resolvePackQuantity(line: ParsedLine, resolved: ResolvedProduct, baseUnit: BaseUnit | null): number | null {
  if (resolved.isDepositOrFee || baseUnit === null) return null;
  const printed = parseUnitSize(line.unitSizeRaw);
  if (printed && printed.baseUnit === baseUnit) return printed.packQuantity;
  return resolved.packSizeBaseUnits;
}

function normalizeProductText(raw: string): string {
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function buildExpansionMessage(rawTexts: string[]): string {
  const categories = CATEGORY_TAXONOMY.map(c => `<category id="${c.id}">${c.name}</category>`).join('\n');
  const tags = TAG_VOCABULARY.map(t => `<tag>${t.key}</tag>`).join('\n');
  const lines = rawTexts.map((text, index) => `<line index="${index}">${text}</line>`).join('\n');
  return `<categories>\n${categories}\n</categories>\n<tags>\n${tags}\n</tags>\n<lines>\n${lines}\n</lines>`;
}
