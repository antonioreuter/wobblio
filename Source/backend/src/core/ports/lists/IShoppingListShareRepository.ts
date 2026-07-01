export interface CreateListShareInput {
  listId: string;
  createdByUserId: string;
  tokenHash: string;
  tokenEnc: string;
  expiresAt: string; // ISO 8601
}

export interface ResolvedListShare {
  listId: string;
  tenantId: string;
}

export interface IShoppingListShareRepository {
  create(input: CreateListShareInput): Promise<string>;
  // Resolves an open (not revoked, not expired) share by token hash. Crosses RLS
  // via a SECURITY DEFINER function — the public viewer has no tenant context.
  resolve(tokenHash: string): Promise<ResolvedListShare | null>;
  // Returns false when no open share matches (already revoked or unknown).
  revoke(listId: string, shareId: string): Promise<boolean>;
}
