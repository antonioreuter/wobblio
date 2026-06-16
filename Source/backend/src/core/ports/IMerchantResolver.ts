export interface MerchantResolution {
  merchantId: string | null;
  branchId: string | null;
  confidence: number; // 0..1
}

// §6.2 merchant canonicalization. Real impl (alias → fuzzy → LLM) lands in Epic 08.
export interface IMerchantResolver {
  resolve(merchantRaw: string, countryCode: string): Promise<MerchantResolution>;
}
