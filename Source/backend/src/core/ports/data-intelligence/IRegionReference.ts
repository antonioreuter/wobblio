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

export interface IRegionReference {
  listCountries(): Promise<ReferenceCountry[]>;
  listSubdivisions(countryCode: string): Promise<ReferenceSubdivision[]>;
  isValidRegion(countryCode: string, regionCode: string): Promise<boolean>;
  // True when a location can anchor a shared price observation: the region is a
  // known subdivision of the country, or the country exists and has no subdivisions
  // at all (country-level is the finest mapped granularity). Drives the price
  // observation sharing gate (RESOLVED vs PENDING/HELD_UNMAPPED).
  isMappedLocation(countryCode: string, regionCode: string): Promise<boolean>;
}
