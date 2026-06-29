import type { IMerchantResolver, MerchantResolution } from '../../../../ports/data-intelligence/IMerchantResolver';

// Tool 2 (parent §3): canonical merchant resolution (alias → fuzzy → LLM fallback →
// provisional). Thin wrapper over the existing MerchantResolver — no logic of its own.
export class MerchantResolverTool {
  constructor(private readonly resolver: IMerchantResolver) {}

  run(merchantRaw: string, countryCode: string): Promise<MerchantResolution> {
    return this.resolver.resolve(merchantRaw, countryCode);
  }
}
