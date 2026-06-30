import type { IBedrockConverse } from '@core/ports/ai/IBedrockConverse';
import { callJsonWithRetry } from '@core/domain/llmJson';
import { parsePipelineJudgeJson, type PipelineJudgement } from '@core/domain/pipelineJudgeSchema';
import type { ExtractionResult } from '@core/services/ingestion/InvoiceFinalizer';
import {
  PIPELINE_JUDGE_SYSTEM_PROMPT,
  PIPELINE_JUDGE_PROMPT_VERSION,
  buildPipelineJudgeUserPrompt,
} from '../../prompts/pipelineJudge';

// Grades the two extractions against ground truth with the insight-role model. Uses the
// WEEKLY_ADVISOR stage (the insight/advisor lane) so the existing Bedrock plumbing applies;
// schema-validated with one retry-with-errors (callJsonWithRetry → parsePipelineJudgeJson).
export async function judgePipelines(
  converse: IBedrockConverse,
  insightModelId: string,
  groundTruth: unknown,
  legacy: ExtractionResult,
  agentic: ExtractionResult,
): Promise<PipelineJudgement> {
  const userPrompt = buildPipelineJudgeUserPrompt({
    groundTruth: JSON.stringify(groundTruth, null, 2),
    legacyOutput: JSON.stringify(toJudgeOutput(legacy), null, 2),
    agenticOutput: JSON.stringify(toJudgeOutput(agentic), null, 2),
  });

  return callJsonWithRetry({
    call: (request) => converse.converse(request),
    buildRequest: (messages) => ({
      modelId: insightModelId,
      stage: 'WEEKLY_ADVISOR',
      messages,
      systemPrompt: PIPELINE_JUDGE_SYSTEM_PROMPT,
      promptVersion: PIPELINE_JUDGE_PROMPT_VERSION,
      maxTokens: 1024,
      temperature: 0,
    }),
    messages: [{ role: 'user', content: userPrompt }],
    validate: parsePipelineJudgeJson,
  });
}

// Compact, gradeable projection of a pipeline's output — the fields the judge scores. Drops the
// internal ids the judge can't interpret (productId/categoryId are opaque), keeping the
// human-meaningful extraction.
export function toJudgeOutput(extraction: ExtractionResult): unknown {
  const { receipt, merchant, normalized, categoryId, tags } = extraction;
  return {
    merchant: merchant.brandName ?? receipt.merchantRaw,
    transactionDate: receipt.transactionDate,
    currency: receipt.currency,
    total: receipt.total,
    categoryId,
    tags,
    lines: receipt.lines.map((line, index) => ({
      rawText: line.rawText,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
      productId: normalized[index]?.productId ?? null,
      categoryId: normalized[index]?.categoryId ?? null,
    })),
  };
}
