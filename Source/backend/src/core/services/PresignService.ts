import type { IInvoiceRepository } from '../ports/IInvoiceRepository';
import type { IS3FileStorage } from '../ports/IS3FileStorage';
import type { IUploadQuotaProvider } from '../ports/IUploadQuotaProvider';
import type { QuotaType } from '../ports/IQuotaRepository';
import type { UserRole } from '../ports/IAppUserRepository';
import type { QuotaService } from './QuotaService';
import { DuplicateInvoiceError } from '../domain/errors';

const PRESIGN_TTL_SECONDS = 300; // hard invariant #10

export interface PresignInput {
  tenantId: string;
  uploadedByUserId: string;
  role: UserRole;
  householdId: string | null;
  imageSha256: string;
  contentType: string;
}

export interface PresignResult {
  invoiceId: string;
  uploadUrl: string;
  s3Key: string;
}

export class PresignService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly quotaService: QuotaService,
    private readonly quotaProvider: IUploadQuotaProvider,
    private readonly fileStorage: IS3FileStorage,
  ) {}

  async presign(input: PresignInput): Promise<PresignResult> {
    const existing = await this.invoiceRepo.findSameTenantByHash(input.imageSha256);
    if (existing) throw new DuplicateInvoiceError(input.imageSha256);

    const isHousehold = input.householdId !== null;
    const counter: QuotaType = isHousehold ? 'HOUSEHOLD_UPLOADS' : 'UPLOADS';
    const cap = isHousehold
      ? await this.quotaProvider.getHouseholdUploadsCap()
      : await this.quotaProvider.getPersonalUploadsCap(input.role);

    await this.quotaService.reserveUpload(input.tenantId, counter, cap, new Date());

    const s3Key = `receipts/${input.tenantId}/${input.imageSha256}.jpg`;
    const invoiceId = await this.invoiceRepo.createPending({
      tenantId: input.tenantId,
      uploadedByUserId: input.uploadedByUserId,
      householdId: input.householdId,
      imageS3Key: s3Key,
      imageSha256: input.imageSha256,
    });

    const uploadUrl = await this.fileStorage.presignPut(s3Key, input.contentType, PRESIGN_TTL_SECONDS);
    return { invoiceId, uploadUrl, s3Key };
  }
}
