export interface CreateBillSplitShareInput {
  splitId: string;
  createdByUserId: string;
  tokenHash: string;
  tokenEnc: string;
  expiresAt: string; // ISO 8601
}

export interface ResolvedBillSplitShare {
  splitId: string;
  tenantId: string;
}

export interface IBillSplitShareRepository {
  create(input: CreateBillSplitShareInput): Promise<string>;
  // Resolves an open (not revoked, not expired) share by token hash. Crosses RLS
  // via a SECURITY DEFINER function — the public viewer has no tenant context.
  resolve(tokenHash: string): Promise<ResolvedBillSplitShare | null>;
}
