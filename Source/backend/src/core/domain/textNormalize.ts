// Canonical receipt-text normalization for alias matching (§6.3). Used both when RESOLVING a line to
// a product (ProductNormalizer) and when WRITING aliases (product-split resolution). These two paths
// MUST normalize identically — if they diverge, a written alias won't match at read time and future
// receipts miss the intended product. Keeping one implementation here removes that drift risk.
export function normalizeProductText(raw: string): string {
  return raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}
