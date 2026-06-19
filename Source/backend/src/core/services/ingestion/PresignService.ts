import type { IInvoiceRepository } from '../../ports/ingestion/IInvoiceRepository';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IUploadQuotaProvider } from '../../ports/quota/IUploadQuotaProvider';
import type { QuotaType } from '../../ports/quota/IQuotaRepository';
import type { UserRole } from '../../ports/identity/IAppUserRepository';
import type { IReverseGeocoder } from '../../ports/data-intelligence/IReverseGeocoder';
import type { IRegionReference } from '../../ports/data-intelligence/IRegionReference';
import type { QuotaService } from '../quota/QuotaService';
import { DuplicateInvoiceError } from '../../domain/errors';

const PRESIGN_TTL_SECONDS = 300; // hard invariant #10

export interface UploadCoordinates {
  lat: number;
  lon: number;
}

export interface PresignInput {
  tenantId: string;
  uploadedByUserId: string;
  role: UserRole;
  householdId: string | null;
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
  uploadUrl: string;
  s3Key: string;
}

export class PresignService {
  constructor(
    private readonly invoiceRepo: IInvoiceRepository,
    private readonly quotaService: QuotaService,
    private readonly quotaProvider: IUploadQuotaProvider,
    private readonly fileStorage: IS3FileStorage,
    private readonly reverseGeocoder: IReverseGeocoder,
    private readonly regionReference: IRegionReference,
  ) {}

  async presign(input: PresignInput): Promise<PresignResult> {
    const existing = await this.invoiceRepo.findSameTenantByHash(input.imageSha256);
    if (existing) throw new DuplicateInvoiceError(input.imageSha256);

    const isHousehold = input.householdId !== null;
    const counter: QuotaType = isHousehold ? 'HOUSEHOLD_UPLOADS' : 'UPLOADS';
    const cap = isHousehold
      ? await this.quotaProvider.getHouseholdUploadsCap()
      : await this.quotaProvider.getPersonalUploadsCap(input.role);

    // The household pool is shared, so its counter is keyed by household_id; a
    // personal upload draws from the uploader's own counter (Epic 09 mechanics).
    const quotaOwnerId = isHousehold ? input.householdId! : input.tenantId;
    await this.quotaService.reserveUpload(quotaOwnerId, counter, cap, new Date());

    const uploadGeo = await this.resolveUploadGeo(input.coordinates);

    const s3Key = `receipts/${input.tenantId}/${input.imageSha256}.jpg`;
    const invoiceId = await this.invoiceRepo.createPending({
      tenantId: input.tenantId,
      uploadedByUserId: input.uploadedByUserId,
      householdId: input.householdId,
      imageS3Key: s3Key,
      imageSha256: input.imageSha256,
      ...uploadGeo,
    });

    const uploadUrl = await this.fileStorage.presignPut(s3Key, input.contentType, PRESIGN_TTL_SECONDS);
    return { invoiceId, uploadUrl, s3Key };
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
