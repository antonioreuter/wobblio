import type { IDataRequestRepository } from '../../ports/gdpr/IDataRequestRepository';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import { DataRequestNotFoundError } from '../../domain/errors';

const DOWNLOAD_URL_TTL_SECONDS = 300; // invariant #10 — no long-TTL exception (§14 decision)

export type ExportDownloadStatus = 'PENDING' | 'PROCESSING' | 'FAILED' | 'COMPLETED' | 'EXPIRED';

export interface ExportDownload {
  status: ExportDownloadStatus;
  downloadUrl: string | null;
}

export class ResolveExportDownloadService {
  constructor(
    private readonly requests: IDataRequestRepository,
    private readonly exportsStorage: IS3FileStorage,
  ) {}

  // A fresh presigned URL is minted on every call rather than emailing a single long-lived
  // link — the download endpoint is the only place a URL is ever produced.
  async resolve(requestId: string): Promise<ExportDownload> {
    const request = await this.requests.getExportById(requestId);
    if (!request) throw new DataRequestNotFoundError(requestId);
    if (request.status !== 'COMPLETED') return { status: request.status, downloadUrl: null };

    // EXPIRED is derived from the S3 7-day lifecycle rule at read time, never persisted —
    // avoids a second cron whose only job would be flipping a status column.
    const head = await this.exportsStorage.headObject(request.exportS3Key!);
    if (!head.exists) return { status: 'EXPIRED', downloadUrl: null };

    const downloadUrl = await this.exportsStorage.presignGet(request.exportS3Key!, DOWNLOAD_URL_TTL_SECONDS);
    return { status: 'COMPLETED', downloadUrl };
  }
}
