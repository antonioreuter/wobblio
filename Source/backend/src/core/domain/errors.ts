export class EncryptionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class AiSpendCapExceededError extends Error {
  constructor(
    readonly tenantId: string,
    readonly currentSpend: number,
    readonly cap: number,
  ) {
    super(`Daily AI spend cap exceeded for tenant ${tenantId}: ${currentSpend} >= ${cap}`);
    this.name = 'AiSpendCapExceededError';
  }
}

export class BedrockCallError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'BedrockCallError';
  }
}
