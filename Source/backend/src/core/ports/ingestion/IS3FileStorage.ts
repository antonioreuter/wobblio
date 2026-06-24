export interface IS3FileStorage {
  // ttlSeconds must be <= 300 (hard invariant #10).
  presignPut(key: string, contentType: string, ttlSeconds: number): Promise<string>;
  presignGet(key: string, ttlSeconds: number): Promise<string>;
  // size is 0 when the object does not exist.
  headObject(key: string): Promise<{ exists: boolean; size: number }>;
  getObjectBytes(key: string): Promise<Uint8Array>;
  // Idempotent: succeeds whether or not the object exists.
  deleteObject(key: string): Promise<void>;
}
