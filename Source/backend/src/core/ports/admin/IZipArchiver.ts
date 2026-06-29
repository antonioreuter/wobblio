// A single file to place in an archive under an opaque name (never a tenant-revealing key).
export interface ArchiveEntry {
  name: string;
  bytes: Uint8Array;
}

// Bundles bytes into a zip in-memory. Used by the §08 debug-sample endpoint to deliver
// opaque image bytes only — the implementation must add nothing beyond name + bytes.
export interface IZipArchiver {
  archive(entries: ArchiveEntry[]): Promise<Uint8Array>;
}
