export interface CreateShareInput {
  invoiceId: string;
  createdByUserId: string;
  tokenHash: string;
  tokenEnc: string;
  expiresAt: string; // ISO 8601
}

export interface ResolvedShare {
  invoiceId: string;
  tenantId: string;
}

export interface IInvoiceShareRepository {
  create(input: CreateShareInput): Promise<string>;
  // Resolves an open (not revoked, not expired) share by token hash. Crosses RLS
  // via a SECURITY DEFINER function — the public viewer has no tenant context.
  resolve(tokenHash: string): Promise<ResolvedShare | null>;
}
