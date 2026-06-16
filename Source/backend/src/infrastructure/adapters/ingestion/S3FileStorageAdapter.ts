import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { IS3FileStorage } from '@core/ports/ingestion/IS3FileStorage';

const MAX_TTL_SECONDS = 300; // hard invariant #10

export class S3FileStorageAdapter implements IS3FileStorage {
  private readonly client: S3Client;

  constructor(region: string, private readonly bucket: string) {
    this.client = new S3Client({ region });
  }

  async presignPut(key: string, contentType: string, ttlSeconds: number): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.client, command, { expiresIn: Math.min(ttlSeconds, MAX_TTL_SECONDS) });
  }

  async presignGet(key: string, ttlSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: Math.min(ttlSeconds, MAX_TTL_SECONDS) });
  }

  async headExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  }

  async getObjectBytes(key: string): Promise<Uint8Array> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) throw new Error(`S3 object ${key} has no body`);
    return response.Body.transformToByteArray();
  }
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}
