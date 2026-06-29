import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { UserRole } from '../../ports/identity/IAppUserRepository';
import type { IReverseGeocoder } from '../../ports/data-intelligence/IReverseGeocoder';
import type { IRegionReference } from '../../ports/data-intelligence/IRegionReference';
import type { IUploadQuotaProvider } from '../../ports/quota/IUploadQuotaProvider';
import type { IUploadLimitsProvider } from '../../ports/quota/IUploadLimitsProvider';
import type { QuotaService } from '../quota/QuotaService';
import type { UploadAllowance, UploadAllowanceResolver } from '../quota/UploadAllowanceResolver';
import {
  DuplicateInvoiceError,
  PremiumRequiredError,
  QuotaExceededError,
  UnsupportedUploadTypeError,
} from '../../domain/errors';
import { extensionFor, isAllowedUploadType, isPdf } from '../../domain/uploadFormat';
import { hasPremiumAccess } from '../../domain/access';

const PRESIGN_TTL_SECONDS = 300; // hard invariant #10

export interface UploadCoordinates {
  lat: number;
  lon: number;
}

export interface PresignInput {
  tenantId: string;
  uploadedByUserId: string;
  role: UserRole;
  imageSha256: string;
  contentType: string;
  // Browser geolocation (tier 2), when the user granted it. Reverse-geocoded to a
  // coarse country/region here; the raw coordinates are discarded after this call.
  coordinates?: UploadCoordinates;
}

interface UploadGeo {
  uploadCountryCode: string | null;
  uploadRegionCode: string | null;
}

export interface PresignResult {
  invoiceId: string;
  // Presigned multipart POST target + the form fields the client submits with the file.
  url: string;
  fields: Record<string, string>;
  s3Key: string;
}

export class PresignService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly quotaService: QuotaService,
    private readonly allowanceResolver: UploadAllowanceResolver,
    private readonly quotaProvider: IUploadQuotaProvider,
    private readonly limitsProvider: IUploadLimitsProvider,
    private readonly fileStorage: IS3FileStorage,
    private readonly reverseGeocoder: IReverseGeocoder,
    private readonly regionReference: IRegionReference,
  ) {}

  async presign(input: PresignInput): Promise<PresignResult> {
    if (!isAllowedUploadType(input.contentType)) throw new UnsupportedUploadTypeError(input.contentType);
    // PDF invoices are a paid-tier feature (premium + the elevated operator roles).
    if (isPdf(input.contentType) && !hasPremiumAccess(input.role)) {
      throw new PremiumRequiredError('PDF invoice uploads');
    }

    const existing = await this.invoiceRepo.findSameTenantByHash(input.imageSha256);
    if (existing) throw new DuplicateInvoiceError(input.imageSha256);

    // A user belongs to at most one household; every upload is stamped with it so
    // members share each other's receipts (RLS household_member_read). The resolver
    // owns the §2.4 matrix: pool counter at 2+ members (cap from the owner's role),
    // else the uploader's personal counter.
    const allowance = await this.allowanceResolver.resolve({
      userId: input.uploadedByUserId,
      role: input.role,
    });
    await this.assertCreditsAvailable(allowance);

    const uploadGeo = await this.resolveUploadGeo(input.coordinates);

    const s3Key = `receipts/${input.tenantId}/${input.imageSha256}.${extensionFor(input.contentType)}`;
    const invoiceId = await this.invoiceRepo.createPending({
      tenantId: input.tenantId,
      uploadedByUserId: input.uploadedByUserId,
      householdId: allowance.householdId,
      // Persist the pool-vs-personal decision so the worker charges the same counter.
      quotaPooled: allowance.isPool,
      imageS3Key: s3Key,
      imageSha256: input.imageSha256,
      ...uploadGeo,
    });

    // Per-format size ceiling enforced by S3 at upload time (content-length-range), so an
    // oversize file is rejected before the bytes land — truly free (§06 primary guard).
    const maxBytes = isPdf(input.contentType)
      ? await this.limitsProvider.getMaxPdfBytes()
      : await this.limitsProvider.getMaxImageBytes();
    const { url, fields } = await this.fileStorage.presignPost(
      s3Key, input.contentType, maxBytes, PRESIGN_TTL_SECONDS,
    );
    return { invoiceId, url, fields, s3Key };
  }

  // Soft-Cap check only — no counter write (the worker charges actual tokens on
  // success). A pessimistic projection (in-flight PROCESSING uploads × avg tokens)
  // is added to current usage so a burst of concurrent presigns can't all clear the
  // cap before any of them is charged.
  private async assertCreditsAvailable(allowance: UploadAllowance): Promise<void> {
    const now = new Date();
    const avgTokens = await this.quotaProvider.getAverageTokensPerInvoice();
    const inFlightCredits = (await this.invoiceRepo.countInFlightUploads(
      allowance.quotaOwnerId, allowance.isPool, this.quotaService.getWeekStart(now),
    )) * avgTokens;
    const available = await this.quotaService.checkAvailability(
      allowance.quotaOwnerId, allowance.counter, allowance.cap, now, inFlightCredits,
    );
    if (available) return;
    // Report the real projected usage that tripped the cap (stored used + in-flight
    // projection), not the cap itself — so the CloudWatch quota-block log is informative.
    const used = await this.quotaService.getUsed(allowance.quotaOwnerId, allowance.counter, now);
    throw new QuotaExceededError(allowance.counter, used + inFlightCredits, allowance.cap);
  }

  // Reverse-geocode the upload coordinates to a coarse country/region for tier 2.
  // Both geocode and region mapping degrade to null independently, so a known country
  // with an unmapped region still prefills the country (the user picks the region).
  private async resolveUploadGeo(coordinates: UploadCoordinates | undefined): Promise<UploadGeo> {
    if (!coordinates) return { uploadCountryCode: null, uploadRegionCode: null };
    const geocoded = await this.reverseGeocoder.reverseGeocode(coordinates.lat, coordinates.lon);
    if (!geocoded) return { uploadCountryCode: null, uploadRegionCode: null };

    const resolved = await this.regionReference.resolveReceiptLocation({
      countryCode: geocoded.countryCode,
      regionText: geocoded.regionText ?? undefined,
    });
    return { uploadCountryCode: resolved.countryCode, uploadRegionCode: resolved.regionCode };
  }
}
