import type { IMerchantResolver, MerchantResolution } from '../../ports/data-intelligence/IMerchantResolver';
import type { IMerchantCatalog, MerchantAliasMatch, MerchantBrandCandidate } from '../../ports/data-intelligence/IMerchantCatalog';
import type { BedrockConverseRequest, BedrockMessage, IBedrockConverse } from '../../ports/ai/IBedrockConverse';
import { normalizeMerchantName } from '../../domain/merchantNormalize';
import { ConfidenceThresholds } from '../../domain/ingestion';
import { callJsonWithRetry } from '../../domain/llmJson';
import { parseMerchantFallbackJson } from '../../domain/merchantFallbackSchema';
import { MERCHANT_FALLBACK_PROMPT, MERCHANT_FALLBACK_PROMPT_VERSION } from '../../../prompts/merchantFallback';

const FUZZY_MIN_SIMILARITY = 0.65;
const FUZZY_CANDIDATE_LIMIT = 5;
const BRAND_CANDIDATE_LIMIT = 5;
const LLM_MATCH_CONFIDENCE = 0.8;
const PROVISIONAL_CONFIDENCE = 0.5;

// §6.2 merchant canonicalization: exact alias → pg_trgm fuzzy (margin-gated, with
// AUTO_FUZZY write-back) → LLM fallback (brand-level candidates) → NEW_MERCHANT provisional.
export class MerchantResolver implements IMerchantResolver {
  constructor(
    private readonly catalog: IMerchantCatalog,
    private readonly converse: IBedrockConverse,
    private readonly modelId: string,
  ) {}

  async resolve(merchantRaw: string, countryCode: string): Promise<MerchantResolution> {
    const normalized = normalizeMerchantName(merchantRaw);

    const exact = await this.catalog.findExactAlias(normalized, countryCode);
    if (exact) return this.toResolution(exact, false);

    const fuzzy = await this.catalog.findFuzzyAliases(normalized, countryCode, FUZZY_CANDIDATE_LIMIT);
    const winner = pickConfidentFuzzy(fuzzy);
    if (winner) {
      await this.writeBrandAlias(winner.merchantId, winner.brandName, countryCode, 'AUTO_FUZZY');
      return this.toResolution(winner, false);
    }

    const brandCandidates = await this.catalog.findBrandCandidates(normalized, countryCode, BRAND_CANDIDATE_LIMIT);
    return this.llmFallback(merchantRaw, countryCode, brandCandidates);
  }

  private async llmFallback(
    merchantRaw: string,
    countryCode: string,
    candidates: MerchantBrandCandidate[],
  ): Promise<MerchantResolution> {
    const fallback = await callJsonWithRetry({
      call: request => this.converse.converse(request),
      buildRequest: messages => this.buildRequest(messages),
      messages: [{ role: 'user', content: buildFallbackMessage(merchantRaw, candidates) }],
      validate: parseMerchantFallbackJson,
    });

    if (!fallback.isNew && fallback.merchantId) {
      await this.writeBrandAlias(fallback.merchantId, fallback.brandName, countryCode, 'AUTO_LLM');
      const defaultCategoryId = (await this.catalog.getDefaultCategory(fallback.merchantId)) ?? null;
      return { merchantId: fallback.merchantId, brandName: fallback.brandName, defaultCategoryId, provisional: false, confidence: LLM_MATCH_CONFIDENCE };
    }

    const merchantId = await this.catalog.createProvisionalMerchant(fallback.brandName, countryCode, fallback.defaultCategoryId);
    await this.writeBrandAlias(merchantId, fallback.brandName, countryCode, 'AUTO_LLM');
    // The prior we just persisted is the venue hint for §6.3 — no need to read it back.
    return { merchantId, brandName: fallback.brandName, defaultCategoryId: fallback.defaultCategoryId, provisional: true, confidence: PROVISIONAL_CONFIDENCE };
  }

  // Persist the resolved brand (not the raw receipt header) so repeat receipts hard-hit the
  // exact-alias path and merchant_alias stops bloating one row per store/city variant.
  private async writeBrandAlias(merchantId: string, brandName: string, countryCode: string, source: 'AUTO_FUZZY' | 'AUTO_LLM'): Promise<void> {
    await this.catalog.writeAlias({
      merchantId,
      aliasRaw: brandName,
      aliasNormalized: normalizeMerchantName(brandName),
      countryCode,
      source,
    });
  }

  // The alias JOIN already carries the merchant's default_category_id, so the prior needs
  // no follow-up SELECT — the hot exact/fuzzy path stays a single query.
  private toResolution(match: MerchantAliasMatch, provisional: boolean): MerchantResolution {
    return { merchantId: match.merchantId, brandName: match.brandName, defaultCategoryId: match.defaultCategoryId, provisional, confidence: match.similarity };
  }

  private buildRequest(messages: BedrockMessage[]): BedrockConverseRequest {
    return {
      modelId: this.modelId,
      stage: 'MERCHANT_FALLBACK',
      messages,
      systemPrompt: MERCHANT_FALLBACK_PROMPT,
      promptVersion: MERCHANT_FALLBACK_PROMPT_VERSION,
      temperature: 0,
    };
  }
}

function pickConfidentFuzzy(candidates: MerchantAliasMatch[]): MerchantAliasMatch | null {
  const top = candidates[0];
  if (!top || top.similarity < FUZZY_MIN_SIMILARITY) return null;
  const runnerUpSimilarity = candidates[1]?.similarity ?? 0;
  if (top.similarity - runnerUpSimilarity < ConfidenceThresholds.fuzzyMatchMargin) return null;
  return top;
}

function buildFallbackMessage(merchantRaw: string, candidates: MerchantBrandCandidate[]): string {
  const list = candidates.map(c => `<candidate id="${c.merchantId}" brand="${c.brandName}" />`).join('\n');
  return `<merchant_raw>${merchantRaw}</merchant_raw>\n<candidates>\n${list}\n</candidates>`;
}
