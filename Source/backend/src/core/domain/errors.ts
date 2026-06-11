export class EncryptionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'EncryptionError';
  }
}
