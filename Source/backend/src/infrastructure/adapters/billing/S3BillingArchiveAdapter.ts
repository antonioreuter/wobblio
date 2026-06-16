import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { IBillingArchive } from '@core/ports/billing/IBillingArchive';

export class S3BillingArchiveAdapter implements IBillingArchive {
  private readonly client: S3Client;

  constructor(
    region: string,
    private readonly bucket: string,
  ) {
    this.client = new S3Client({
      region,
      forcePathStyle: !!process.env.AWS_ENDPOINT_URL,
    });
  }

  async archiveEventPayload(eventId: string, json: string): Promise<{ s3Key: string }> {
    const now = new Date();
    const yyyy = now.getUTCFullYear().toString();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const s3Key = `${yyyy}/${mm}/${eventId}.json`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: json,
        ContentType: 'application/json',
      }),
    );

    return { s3Key };
  }
}
