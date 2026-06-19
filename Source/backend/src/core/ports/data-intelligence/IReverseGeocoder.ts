// Tier-2 upload geolocation (§6.5). The browser sends coarse coordinates at presign;
// this port turns them into a coarse country + raw region name. Raw coordinates are
// never persisted — only the resolved coarse location is stored on the invoice row.

export interface GeocodedLocation {
  countryCode: string; // ISO 3166-1 alpha-2
  regionText: string | null; // raw subdivision name, null when the provider can't give one
}

export interface IReverseGeocoder {
  // Best-effort: returns null on any failure (denied/unsupported/provider error), so
  // tier-2 geo is an optional prefill the worker can fall through, never a hard
  // dependency on the upload path.
  reverseGeocode(lat: number, lon: number): Promise<GeocodedLocation | null>;
}
