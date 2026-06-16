import type { IMerchantResolver, MerchantResolution } from '../../ports/data-intelligence/IMerchantResolver';
import type { IMerchantCatalog, MerchantAliasMatch } from '../../ports/data-intelligence/IMerchantCatalog';
import type { BedrockConverseRequest, BedrockMessage } from '../../ports/ai/IBedrockConverse';
import type { BedrockSpendGuardService } from '../ai/BedrockSpendGuardService';
import { normalizeMerchantName } from '../../domain/merchantNormalize';
import { ConfidenceThresholds } from '../../domain/ingestion';
import { callJsonWithRetry } from '../../domain/llmJson';
import { parseMerchantFallbackJson } from '../../domain/merchantFallbackSchema';
import { MERCHANT_FALLBACK_PROMPT, MERCHANT_FALLBACK_PROMPT_VERSION } from '../../../prompts/merchantFallback';

const FUZZY_MIN_SIMILARITY = 0.65;
const FUZZY_CANDIDATE_LIMIT = 5;
const LLM_MATCH_CONFIDENCE = 0.8;
const PROVISIONAL_CONFIDENCE = 0.5;

// §6.2 merchant canonicalization: exact alias → pg_trgm fuzzy (margin-gated, with
// AUTO_FUZZY write-back) → LLM fallback → NEW_MERCHANT provisional.
export class MerchantResolver implements IMerchantResolver {
  constructor(
    private readonly catalog: IMerchantCatalog,
    private readonly spendGuard: BedrockSpendGuardService,
    private readonly modelId: string,
  ) {}

  async resolve(tenantId: string, merchantRaw: string, countryCode: string): Promise<MerchantResolution> {
    const normalized = normalizeMerchantName(merchantRaw);

    const exact = await this.catalog.findExactAlias(normalized, countryCode);
    if (exact) return this.toResolution(exact, false);

    const candidates = await this.catalog.findFuzzyAliases(normalized, countryCode, FUZZY_CANDIDATE_LIMIT);
    const winner = pickConfidentFuzzy(candidates);
    if (winner) {
      await this.catalog.writeAlias({ merchantId: winner.merchantId, aliasRaw: merchantRaw, aliasNormalized: normalized, countryCode, source: 'AUTO_FUZZY' });
      return this.toResolution(winner, false);
    }

    return this.llmFallback(tenantId, merchantRaw, normalized, countryCode, candidates);
  }

  private async llmFallback(
    tenantId: string,
    merchantRaw: string,
    normalized: string,
    countryCode: string,
    candidates: MerchantAliasMatch[],
  ): Promise<MerchantResolution> {
    const fallback = await callJsonWithRetry({
      call: request => this.spendGuard.callWithSpendGuard(tenantId, request),
      buildRequest: messages => this.buildRequest(messages),
      messages: [{ role: 'user', content: buildFallbackMessage(merchantRaw, candidates) }],
      validate: parseMerchantFallbackJson,
    });

    if (!fallback.isNew && fallback.merchantId) {
      await this.catalog.writeAlias({ merchantId: fallback.merchantId, aliasRaw: merchantRaw, aliasNormalized: normalized, countryCode, source: 'AUTO_LLM' });
      return { merchantId: fallback.merchantId, branchId: null, brandName: fallback.brandName, provisional: false, confidence: LLM_MATCH_CONFIDENCE };
    }

    const merchantId = await this.catalog.createProvisionalMerchant(fallback.brandName, countryCode);
    await this.catalog.writeAlias({ merchantId, aliasRaw: merchantRaw, aliasNormalized: normalized, countryCode, source: 'AUTO_LLM' });
    return { merchantId, branchId: null, brandName: fallback.brandName, provisional: true, confidence: PROVISIONAL_CONFIDENCE };
  }

  private toResolution(match: MerchantAliasMatch, provisional: boolean): MerchantResolution {
    return { merchantId: match.merchantId, branchId: match.branchId, brandName: match.brandName, provisional, confidence: match.similarity };
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

function buildFallbackMessage(merchantRaw: string, candidates: MerchantAliasMatch[]): string {
  const list = candidates.map(c => `<candidate id="${c.merchantId}" brand="${c.brandName}" />`).join('\n');
  return `<merchant_raw>${merchantRaw}</merchant_raw>\n<candidates>\n${list}\n</candidates>`;
}
