import type { IFaultAdminRepository } from '../../ports/ingestion/IFaultAdminRepository';
import type { IS3FileStorage } from '../../ports/ingestion/IS3FileStorage';
import type { IZipArchiver } from '../../ports/admin/IZipArchiver';
import type { IAdminAuditLog, AdminActor } from '../../ports/admin/IAdminAuditLog';
import { attachmentFormatFromKey } from '../../domain/uploadFormat';

// At most this many sample images per distinct root cause (§08 GDPR minimisation).
const MAX_SAMPLES_PER_REASON = 2;

export interface DebugSample {
  zip: Uint8Array;
  count: number;
}

// §08 debug-sample (GDPR-gated, SHIP-BLOCKED on DPO/counsel/ToS — see the spec). Returns a
// zip of OPAQUE image bytes for the quarantined invoices matching one root cause, so an
// operator can reproduce a parse failure. Hard minimisation + de-identification:
//  • only quarantined (system-fault) invoices, exact-matched to the given reason
//  • ≤2 images, named opaquely (sample-1.<ext>) — never the tenant-revealing S3 key/path
//  • bytes fetched SERVER-SIDE (getObjectBytes); no presigned URL or key leaves the server
//  • nothing persisted (the zip is ephemeral in the response → nothing to purge later)
//  • audited as actor + reason + count, never the tenant
export class AdminDebugSampleService {
  constructor(
    private readonly faults: IFaultAdminRepository,
    private readonly fileStorage: IS3FileStorage,
    private readonly zipper: IZipArchiver,
    private readonly audit: IAdminAuditLog,
  ) {}

  async buildSample(actor: AdminActor, reason: string): Promise<DebugSample> {
    const matches = (await this.faults.listBlocked())
      .filter((inv) => inv.systemFaultReason === reason)
      .slice(0, MAX_SAMPLES_PER_REASON);

    // Fetch server-side; tolerate a missing object (e.g. already purged) so one gone image
    // doesn't fail the whole sample. Names are assigned after, so they stay contiguous.
    const fetched = await Promise.allSettled(
      matches.map((inv) => this.fileStorage.getObjectBytes(inv.imageS3Key)),
    );
    const entries = matches
      .map((inv, i) => ({ inv, result: fetched[i] }))
      .filter((x): x is { inv: typeof x.inv; result: PromiseFulfilledResult<Uint8Array> } => x.result.status === 'fulfilled')
      .map(({ inv, result }, index) => ({
        // Opaque name — index + the file's format extension only, no key/path/tenant.
        name: `sample-${index + 1}.${attachmentFormatFromKey(inv.imageS3Key)}`,
        bytes: result.value,
      }));

    const zip = await this.zipper.archive(entries);

    // Audit the egress: who, which root cause, how many — but never the tenant/owner.
    await this.audit.record({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'fault.debug_sample',
      target: reason,
      after: { count: entries.length },
    });

    return { zip, count: entries.length };
  }
}
