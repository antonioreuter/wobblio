import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { IS3FileStorage, PresignedPost } from '@core/ports/ingestion/IS3FileStorage';
import type { IArchiveUploader } from '@core/ports/gdpr/IArchiveUploader';

const MAX_TTL_SECONDS = 300; // hard invariant #10

// Also implements IArchiveUploader (putObject) — the §14 export worker depends on that narrow
// port, not the full ingestion-flow IS3FileStorage, even though this one class backs both.
export class S3FileStorageAdapter implements IS3FileStorage, IArchiveUploader {
  private readonly client: S3Client;

  constructor(region: string, private readonly bucket: string) {
    // Locally (AWS_ENDPOINT_URL → LocalStack) use path-style addressing so
    // presigned URLs resolve at http://localhost:4566/<bucket>/… instead of a
    // virtual-hosted <bucket>.localhost subdomain (DNS-fragile across browsers
    // and an extra CSP origin). On AWS the endpoint is unset and addressing
    // stays virtual-hosted. Mirrors S3BillingArchiveAdapter.
    this.client = new S3Client({
      region,
      ...(process.env.AWS_ENDPOINT_URL ? { forcePathStyle: true } : {}),
    });
  }

  async presignPost(
    key: string,
    contentType: string,
    maxBytes: number,
    ttlSeconds: number,
  ): Promise<PresignedPost> {
    // content-length-range makes S3 reject an over/undersize body before it lands (§06
    // primary size guard). Min is 1: a 0-byte upload would otherwise pass the worker size
    // check and crash Bedrock into a (wrong) system-fault quarantine. Content-Type is
    // pinned so the stored object keeps the declared type.
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [['content-length-range', 1, maxBytes]],
      Fields: { 'Content-Type': contentType },
      Expires: Math.min(ttlSeconds, MAX_TTL_SECONDS),
    });
    return { url, fields };
  }

  async presignGet(key: string, ttlSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: Math.min(ttlSeconds, MAX_TTL_SECONDS) });
  }

  async headObject(key: string): Promise<{ exists: boolean; size: number }> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { exists: true, size: head.ContentLength ?? 0 };
    } catch (err) {
      if (isNotFound(err)) return { exists: false, size: 0 };
      throw err;
    }
  }

  async getObjectBytes(key: string): Promise<Uint8Array> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) throw new Error(`S3 object ${key} has no body`);
    return response.Body.transformToByteArray();
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
  }
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}
