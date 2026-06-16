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
}
