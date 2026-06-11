export interface ITenantContext {
  setTenantId(tenantId: string): Promise<void>;
}
