export interface PresignedPost {
  url: string;
  // Form fields (policy, signature, key, Content-Type, …) the client must submit with
  // the multipart POST, in addition to the file part.
  fields: Record<string, string>;
}

export interface IS3FileStorage {
  // Presigned multipart POST with a `content-length-range` condition so S3 rejects an
  // oversize upload before the bytes land (§06). ttlSeconds must be <= 300 (invariant #10).
  presignPost(key: string, contentType: string, maxBytes: number, ttlSeconds: number): Promise<PresignedPost>;
  presignGet(key: string, ttlSeconds: number): Promise<string>;
  // size is 0 when the object does not exist.
  headObject(key: string): Promise<{ exists: boolean; size: number }>;
  getObjectBytes(key: string): Promise<Uint8Array>;
  // Idempotent: succeeds whether or not the object exists.
  deleteObject(key: string): Promise<void>;
}
