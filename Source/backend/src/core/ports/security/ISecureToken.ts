export interface ISecureToken {
  // URL-safe, high-entropy random token handed to the invitee.
  generate(): string;
  // Deterministic hash of a token for at-rest lookup (never store the raw token).
  hash(token: string): string;
}
