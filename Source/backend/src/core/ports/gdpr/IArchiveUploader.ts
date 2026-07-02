// Server-side write of a finished archive (§14 export worker: the built ZIP). Distinct from
// IS3FileStorage's presign-flow methods — this is a direct put with credentials the caller
// already holds, and is its own narrow capability rather than bolted onto the ingestion port.
export interface IArchiveUploader {
  putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
}
