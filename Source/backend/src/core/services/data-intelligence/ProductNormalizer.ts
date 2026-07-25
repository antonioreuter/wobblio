import type { IProductNormalizer, NormalizationResult, NormalizedLine, MerchantExpansionContext } from '../../ports/data-intelligence/IProductNormalizer';
import type { IProductCatalog, ProductMatch } from '../../ports/data-intelligence/IProductCatalog';
import type { IBedrockEmbedder } from '../../ports/data-intelligence/IBedrockEmbedder';
import type { BedrockConverseRequest, BedrockMessage, IBedrockConverse } from '../../ports/ai/IBedrockConverse';
import type { ParsedLine } from '../../domain/ingestion';
import { ConfidenceThresholds, RESTAURANT_BILL_HINT } from '../../domain/ingestion';
import { parseUnitSize, type BaseUnit, type SizeSource } from '../../domain/unitSize';
import { normalizeProductText } from '../../domain/textNormalize';
import { callJsonWithRetry } from '../../domain/llmJson';
import { parseProductExpansionJson, type ExpandedItem, type ProductExpansion } from '../../domain/productExpansionSchema';
import { CATEGORY_TAXONOMY, macroCategoryId } from '../../domain/categoryTaxonomy';
import { escapeXmlAttr } from '../../domain/xmlEscape';
import { TAG_VOCABULARY } from '../../domain/tagVocabulary';
import { PRODUCT_EXPANSION_PROMPT, PRODUCT_EXPANSION_PROMPT_VERSION } from '../../../prompts/productExpansion';

const PROVISIONAL_CONFIDENCE = 0.5;

// Large receipts produce expansion JSON that overran the model's output ceiling and
// truncated mid-JSON (invalid JSON → DLQ). Chunk the unmatched lines so each call's
// output stays well under the cap; positional alignment is preserved by processing
// chunks in order.
const EXPANSION_BATCH = 20;

// Embedding calls are independent network round-trips (~124ms each), so they run concurrently —
// but bounded, so a 60-line receipt doesn't fire 60 simultaneous Bedrock calls at the account's
// throughput quota. Only the pg work that consumes them has to stay serial.
const EMBED_CONCURRENCY = 8;

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
    private readonly converse: IBedrockConverse,
    private readonly modelId: string,
  ) {}

  async normalize(merchantId: string | null, lines: ParsedLine[], countryCode: string, merchant?: MerchantExpansionContext): Promise<NormalizationResult> {
    const normalizedTexts = lines.map(line => normalizeProductText(line.rawText));
    // Sequential, not Promise.all: every stage shares one pg connection, which
    // cannot run queries concurrently.
    const exact: (ProductMatch | null)[] = [];
    for (const text of normalizedTexts) {
      exact.push(await this.catalog.findExactAlias(merchantId, text, countryCode));
    }

    const unmatched = exact.flatMap((match, index) => (match ? [] : [index]));
    const expansion = await this.expandBatched(unmatched.map(index => lines[index].rawText), merchant);

    const resolved = new Array<ResolvedProduct>(lines.length);
    exact.forEach((match, index) => {
      if (match) resolved[index] = fromExactMatch(match);
    });

    // Phase A — Bedrock only, concurrent. The "sequential" constraint below protects the shared
    // pg connection; it never applied to the embedder, which is a separate network call.
    const embeddings = await this.embedUnmatched(expansion.items);

    // Phase B — pg only, still serial: every stage shares one connection, which cannot run
    // queries concurrently. A null embedding means (and only means) a deposit/fee line, which
    // never reaches the catalog at all.
    for (let k = 0; k < unmatched.length; k++) {
      const index = unmatched[k];
      const embedding = embeddings[k];
      resolved[index] = embedding === null
        ? depositOrFeeResolved(expansion.items[k])
        : await this.resolveProduct(merchantId, normalizedTexts[index], countryCode, expansion.items[k], embedding);
    }

    return {
      lines: lines.map((line, index) => toNormalizedLine(line, resolved[index])),
      suggestedTags: expansion.suggestedTags,
    };
  }

  // One embedding per unmatched line, in input order; null for a deposit/fee line, which is
  // resolved without ever touching the catalog. Concurrency is bounded per window rather than
  // per call, which keeps the ordering guarantee the positional alignment depends on.
  private async embedUnmatched(items: ExpandedItem[]): Promise<(number[] | null)[]> {
    const embeddings: (number[] | null)[] = [];
    for (let start = 0; start < items.length; start += EMBED_CONCURRENCY) {
      const window = items.slice(start, start + EMBED_CONCURRENCY);
      embeddings.push(...await Promise.all(window.map(item =>
        item.isDepositOrFee ? null : this.embedder.embed(item.displayName).then(r => r.embedding),
      )));
    }
    return embeddings;
  }

  private async resolveProduct(merchantId: string | null, normalizedText: string, countryCode: string, item: ExpandedItem, embedding: number[]): Promise<ResolvedProduct> {
    // Per-merchant identity (09/02): only this merchant's products are candidates.
    const [match] = await this.catalog.searchByEmbedding(merchantId, embedding, item.categoryId, countryCode, 1);

    if (match && match.similarity >= ConfidenceThresholds.embeddingAccept) {
      return this.acceptMatch(merchantId, normalizedText, match, false);
    }
    if (match && match.similarity >= ConfidenceThresholds.embeddingLow) {
      return this.acceptMatch(merchantId, normalizedText, match, true);
    }
    return this.createProvisional(merchantId, normalizedText, countryCode, item, embedding);
  }

  private async acceptMatch(merchantId: string | null, normalizedText: string, match: ProductMatch, lowConfidence: boolean): Promise<ResolvedProduct> {
    await this.catalog.writeAlias({ productId: match.productId, aliasNormalized: normalizedText, merchantId, source: 'AUTO_LLM' });
    return { productId: match.productId, categoryId: match.categoryId, baseUnit: match.baseUnit, packSizeBaseUnits: match.packSizeBaseUnits, isDepositOrFee: false, provisional: false, confidence: match.similarity, lowConfidence };
  }

  private async createProvisional(merchantId: string | null, normalizedText: string, countryCode: string, item: ExpandedItem, embedding: number[]): Promise<ResolvedProduct> {
    const productId = await this.catalog.createProvisionalProduct({
      displayName: item.displayName,
      brand: item.brand,
      categoryId: item.categoryId,
      countryCode,
      merchantId,
      baseUnit: item.baseUnit,
      packSizeBaseUnits: item.packSizeBaseUnits,
      embedding,
    });
    await this.catalog.writeAlias({ productId, aliasNormalized: normalizedText, merchantId, source: 'AUTO_LLM' });
    return { productId, categoryId: item.categoryId, baseUnit: item.baseUnit, packSizeBaseUnits: item.packSizeBaseUnits, isDepositOrFee: false, provisional: true, confidence: PROVISIONAL_CONFIDENCE, lowConfidence: false };
  }

  // Chunk so each expansion call's JSON output stays under the model's token cap; items
  // concatenate in order (positional), tags union across batches.
  //
  // Chunks run concurrently: each is an independent Bedrock call that shares no pg state, and
  // retry-with-errors stays per-chunk. Positional alignment comes from the ORDER OF THE CHUNKS,
  // not the order they resolve in — Promise.all preserves that, so a fast second chunk can never
  // transpose itself ahead of the first. A receipt under 20 unmatched lines is one chunk and is
  // unaffected; a long one stops paying ~3.8s per extra chunk.
  private async expandBatched(rawTexts: string[], merchant?: MerchantExpansionContext): Promise<ProductExpansion> {
    if (rawTexts.length === 0) return { items: [], suggestedTags: [] };
    const chunks: string[][] = [];
    for (let start = 0; start < rawTexts.length; start += EXPANSION_BATCH) {
      chunks.push(rawTexts.slice(start, start + EXPANSION_BATCH));
    }
    const batches = await Promise.all(chunks.map(chunk => this.expand(chunk, merchant)));
    return {
      items: batches.flatMap(batch => batch.items),
      suggestedTags: [...new Set(batches.flatMap(batch => batch.suggestedTags))],
    };
  }

  private async expand(rawTexts: string[], merchant?: MerchantExpansionContext): Promise<ProductExpansion> {
    return callJsonWithRetry({
      call: request => this.converse.converse(request),
      buildRequest: messages => this.buildRequest(messages),
      messages: [{ role: 'user', content: buildExpansionMessage(rawTexts, merchant) }],
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

// A deposit/fee line (statiegeld, bag charge) is not a product: it keeps its category but never
// gets an embedding, a catalog match, or an alias.
function depositOrFeeResolved(item: ExpandedItem): ResolvedProduct {
  return { productId: null, categoryId: item.categoryId, baseUnit: null, packSizeBaseUnits: null, isDepositOrFee: true, provisional: false, confidence: 1, lowConfidence: false };
}

function fromExactMatch(match: ProductMatch): ResolvedProduct {
  return { productId: match.productId, categoryId: match.categoryId, baseUnit: match.baseUnit, packSizeBaseUnits: match.packSizeBaseUnits, isDepositOrFee: false, provisional: false, confidence: match.similarity, lowConfidence: false };
}

function toNormalizedLine(line: ParsedLine, resolved: ResolvedProduct): NormalizedLine {
  const baseUnit = resolved.isDepositOrFee ? null : resolved.baseUnit;
  const { packQuantity, sizeSource } = resolvePackQuantity(line, resolved, baseUnit);
  return {
    productId: resolved.productId,
    categoryId: resolved.categoryId,
    baseUnit,
    packQuantity,
    sizeSource,
    isDepositOrFee: resolved.isDepositOrFee,
    productProvisional: resolved.provisional,
    confidence: resolved.confidence,
    lowConfidence: resolved.lowConfidence,
  };
}

// Prefer the unit size printed on this receipt line over the catalog/LLM pack size, but
// only when its unit matches the canonical base unit, so a stray parse can't flip the
// product's comparison unit (§6.3 — clean data beats large data). Size is descriptive
// only (fix 09/01): no per-unit price is derived. A size taken from a printed line token
// is tagged RECEIPT; a size inherited from the catalog carries no line-level evidence (null).
function resolvePackQuantity(
  line: ParsedLine,
  resolved: ResolvedProduct,
  baseUnit: BaseUnit | null,
): { packQuantity: number | null; sizeSource: SizeSource | null } {
  if (resolved.isDepositOrFee || baseUnit === null) return { packQuantity: null, sizeSource: null };
  const printed = parseUnitSize(line.unitSizeRaw);
  if (printed && printed.baseUnit === baseUnit) {
    return { packQuantity: printed.packQuantity, sizeSource: 'RECEIPT' };
  }
  return { packQuantity: resolved.packSizeBaseUnits, sizeSource: null };
}

function buildExpansionMessage(rawTexts: string[], merchant?: MerchantExpansionContext): string {
  const categories = CATEGORY_TAXONOMY.map(c => `<category id="${c.id}">${c.name}</category>`).join('\n');
  const tags = TAG_VOCABULARY.map(t => `<tag>${t.key}</tag>`).join('\n');
  const lines = rawTexts.map((text, index) => `<line index="${index}">${text}</line>`).join('\n');
  return `${buildMerchantBlock(merchant)}<categories>\n${categories}\n</categories>\n<tags>\n${tags}\n</tags>\n<lines>\n${lines}\n</lines>`;
}

// Venue hint for the expansion model (fixes/08). Emitted ONLY for a food/drink venue — a
// dining-out/bars macro prior, or a RESTAURANT_BILL parse hint for an unseeded eatery that
// has no prior yet — so served food routes to a dining leaf, not a grocery leaf. For a
// non-venue merchant (e.g. a supermarket) the block is omitted, keeping the message shape
// identical to the legacy call on the common grocery path.
function buildMerchantBlock(merchant?: MerchantExpansionContext): string {
  if (!merchant) return '';
  const macroPrior = merchant.categoryPrior ? macroCategoryId(merchant.categoryPrior) : null;
  const venueCategory =
    macroPrior === 'cat-dining-out' || macroPrior === 'cat-bars-pubs'
      ? macroPrior
      : merchant.documentKindHint === RESTAURANT_BILL_HINT
        ? 'cat-dining-out'
        : null;
  if (!venueCategory) return '';
  const brand = merchant.brandName?.trim() || null;
  const attrs = [
    brand ? `brand="${escapeXmlAttr(brand)}"` : null,
    `typical_category="${venueCategory}"`,
  ].filter(Boolean).join(' ');
  return `<merchant ${attrs}/>\n`;
}
