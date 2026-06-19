// ISO 3166 reference data (global, no RLS): drives the onboarding country/region
// dropdowns and validates a submitted region code belongs to the chosen country.

export interface ReferenceCountry {
  code: string;
  name: string;
}

export interface ReferenceSubdivision {
  code: string;
  countryCode: string;
  name: string;
}

// Raw store-address fragments transcribed from a receipt (tier 1) or returned by a
// reverse geocoder (tier 2), before they are mapped to canonical reference codes.
export interface RawLocation {
  countryCode?: string; // ISO 3166-1 alpha-2 as printed, may be unknown
  regionText?: string; // free-text province/state name, may be unknown
}

export interface ResolvedLocation {
  countryCode: string | null; // null when the country isn't in reference data
  regionCode: string | null; // ISO 3166-2 when the region maps, else null
}

export interface IRegionReference {
  listCountries(): Promise<ReferenceCountry[]>;
  listSubdivisions(countryCode: string): Promise<ReferenceSubdivision[]>;
  isValidRegion(countryCode: string, regionCode: string): Promise<boolean>;
  // Map a raw printed/geocoded address to canonical reference codes. The country is
  // validated against `country`; the region is resolved by exact ISO 3166-2 code then
  // pg_trgm name similarity against that country's subdivisions. Either part degrades
  // to null when it can't be mapped (the location gate then lets the user pick it).
  resolveReceiptLocation(input: RawLocation): Promise<ResolvedLocation>;
  // True when a location can anchor a shared price observation: the region is a
  // known subdivision of the country, or the country exists and has no subdivisions
  // at all (country-level is the finest mapped granularity). Drives the price
  // observation sharing gate (RESOLVED vs PENDING/HELD_UNMAPPED).
  isMappedLocation(countryCode: string, regionCode: string): Promise<boolean>;
}
