import type { SQSEvent, SQSBatchResponse, Context } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { createLambdaLogger } from '@infrastructure/logging/logger';
import { buildPool } from '@infrastructure/config/db';
import { TenantContextAdapter } from '@infrastructure/adapters/TenantContextAdapter';
import { IngestionLedgerAdapter } from '@infrastructure/adapters/IngestionLedgerAdapter';
import { InvoiceRepositoryAdapter } from '@infrastructure/adapters/InvoiceRepositoryAdapter';
import { S3FileStorageAdapter } from '@infrastructure/adapters/S3FileStorageAdapter';
import { AiSpendLedgerAdapter } from '@infrastructure/adapters/AiSpendLedgerAdapter';
import { SsmSpendCapAdapter } from '@infrastructure/adapters/SsmSpendCapAdapter';
import { buildConverseAdapter } from '@infrastructure/adapters/converseFactory';
import {
  StubMerchantResolver,
  StubProductNormalizer,
  StubInvoiceClassifier,
  StubTagGenerator,
} from '@infrastructure/adapters/stubDataIntelligence';
import { BedrockSpendGuardService } from '@core/services/BedrockSpendGuardService';
import { VisionParseService } from '@core/services/VisionParseService';
import { IngestionService } from '@core/services/IngestionService';
import type { IngestionMessage } from '@core/ports/IIngestionQueue';
import { VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION } from '../../prompts/visionParse';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';
const VISION_MODEL_PARAM = '/wobblio/config/models/vision_parser';

let cachedModelId: string | null = null;

async function resolveVisionModelId(): Promise<string> {
  if (cachedModelId) return cachedModelId;
  if (process.env.STAGE === 'local') {
    cachedModelId = process.env.OLLAMA_MODEL ?? 'gemma4:31b-it-qat';
    return cachedModelId;
  }
  const ssm = new SSMClient({ region: REGION });
  const response = await ssm.send(new GetParameterCommand({ Name: VISION_MODEL_PARAM }));
  cachedModelId = response.Parameter?.Value ?? '';
  if (!cachedModelId) throw new Error(`SSM parameter ${VISION_MODEL_PARAM} is missing`);
  return cachedModelId;
}

export const handler = async (event: SQSEvent, context: Context): Promise<SQSBatchResponse> => {
  const log = createLambdaLogger('ingestion-worker', context.awsRequestId);
  const pool = await buildPool(process.env.DB_SECRET_ARN!, process.env.DB_HOST!, process.env.DB_PORT!);
  const uploadsBucket = process.env.UPLOADS_BUCKET!;
  const modelId = await resolveVisionModelId();
  const converse = buildConverseAdapter(REGION);
  const capProvider = new SsmSpendCapAdapter(REGION);

  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    const client = await pool.connect();
    try {
      const message = JSON.parse(record.body) as IngestionMessage;
      await client.query('BEGIN');

      const spendGuard = new BedrockSpendGuardService(converse, new AiSpendLedgerAdapter(client), capProvider);
      const visionParser = new VisionParseService(spendGuard, modelId, VISION_PARSE_PROMPT, VISION_PARSE_PROMPT_VERSION);
      const service = new IngestionService(
        new TenantContextAdapter(client),
        new IngestionLedgerAdapter(client),
        new S3FileStorageAdapter(REGION, uploadsBucket),
        visionParser,
        new StubMerchantResolver(),
        new StubProductNormalizer(),
        new StubInvoiceClassifier(),
        new StubTagGenerator(),
        new InvoiceRepositoryAdapter(client),
      );

      const outcome = await service.process(message);
      await client.query('COMMIT');
      log.info('ingestion processed', {
        invoiceId: message.invoiceId,
        handled: outcome.handled,
        status: outcome.status,
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      log.error('ingestion failed', { messageId: record.messageId, error: (err as Error).message });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    } finally {
      client.release();
    }
  }

  return { batchItemFailures };
};
