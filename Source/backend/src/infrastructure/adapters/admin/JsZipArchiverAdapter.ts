import JSZip from 'jszip';
import type { IZipArchiver, ArchiveEntry } from '@core/ports/admin/IZipArchiver';

// In-memory zip via JSZip. Adds only the given opaque name + bytes per entry — no path,
// no original filename, no metadata (§08 GDPR: opaque bytes only).
export class JsZipArchiverAdapter implements IZipArchiver {
  async archive(entries: ArchiveEntry[]): Promise<Uint8Array> {
    const zip = new JSZip();
    for (const entry of entries) {
      zip.file(entry.name, entry.bytes);
    }
    return zip.generateAsync({ type: 'uint8array' });
  }
}
