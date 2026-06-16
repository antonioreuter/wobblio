// Region resolution for a price observation. Regions are ISO 3166-2 subnational
// codes (e.g. 'NL-NB', 'US-CA'), country-qualified by construction so they never
// collide across countries in the RLS-exempt price_observation store.
//
// Prefer the contributor's home region; fall back to the country code when none is
// set. Branch-location-derived region (from the merchant's resolved store address)
// is a future enhancement — the vision schema does not extract store addresses yet.
export function resolveObservationRegion(
  contributorRegion: string | null | undefined,
  countryCode: string,
): string {
  const region = contributorRegion?.trim();
  return region && region.length > 0 ? region : countryCode;
}
