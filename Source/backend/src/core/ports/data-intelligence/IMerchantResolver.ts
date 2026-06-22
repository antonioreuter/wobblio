export interface MerchantResolution {
  merchantId: string | null;
  brandName: string | null; // resolved brand, for merchant-scoped tagging
  provisional: boolean; // true when a PROVISIONAL merchant was auto-created
  confidence: number; // 0..1
}

// §6.2 merchant canonicalization (alias → fuzzy → LLM fallback → provisional).
export interface IMerchantResolver {
  resolve(merchantRaw: string, countryCode: string): Promise<MerchantResolution>;
}
